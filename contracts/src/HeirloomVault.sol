// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "account-abstraction/core/Helpers.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HeirloomVault (v2)
/// @notice ERC-4337 smart account with a guardian-attested, veto-protected inheritance state machine and
///         a programmable estate plan. Deployed as EIP-1167 clones by HeirloomVaultFactory.
///
/// Lifecycle:
///   Active --(owner inactive > inactivityThreshold)--> Watch            (computed, never stored)
///   Watch  --(requiredSignatures guardian attestations)--> TriggerPending (veto window opens)
///   TriggerPending --(owner veto / any owner activity)--> Active
///   TriggerPending --(vetoEndTime passed, executeRelease)--> Executed  (terminal)
///
/// Estate plan (owner-configurable until execution):
///   - a default split plus optional per-token splits ("my USDC to my wife, my ETH to my son")
///   - per-heir conditions: unlockAt (e.g. a 21st birthday) and staged payouts (N installments every X seconds)
///   - specific NFTs to specific people, plus an optional fallback heir for any other NFT
///
/// Payout accounting follows OpenZeppelin's PaymentSplitter: an heir is entitled to
/// (balance + already released) * bps * vestedFraction, minus what they already received. This stays correct
/// with staged payouts, late deposits and partial claims.
contract HeirloomVault is BaseAccount, Initializable, ReentrancyGuard, EIP712, IERC721Receiver {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum VaultState {
        Active,
        Watch,
        TriggerPending,
        Executed
    }

    /// @notice One heir's share of an asset, with optional conditions.
    struct Allocation {
        address beneficiary;
        uint16 bps; // share of the asset in basis points; a plan's shares sum to 10_000
        uint64 unlockAt; // absolute unix time before which nothing is paid (0 = no condition)
        uint16 installments; // number of equal payouts (>= 1)
        uint32 interval; // seconds between payouts (required when installments > 1)
    }

    /// @notice Split for one specific token (address(0) = native ETH).
    struct TokenPlan {
        address token;
        Allocation[] allocations;
    }

    /// @notice A specific NFT left to a specific person.
    struct NftRule {
        address collection;
        uint256 tokenId;
        address beneficiary;
        uint64 unlockAt;
    }

    struct Config {
        address owner;
        address executor;
        address[] guardians;
        uint256 requiredSignatures;
        uint64 inactivityThreshold;
        uint64 vetoGracePeriod;
        string assetMapCID;
        Allocation[] defaultAllocations; // used for any token without its own plan
        TokenPlan[] tokenPlans;
        NftRule[] nftRules;
        address nftFallback; // receives NFTs without a specific rule (address(0) = none)
    }

    struct VaultInfo {
        VaultState state;
        address owner;
        address executor;
        string assetMapCID;
        uint64 lastHeartbeat;
        uint64 inactivityThreshold;
        uint64 vetoGracePeriod;
        uint64 watchStartsAt;
        uint64 vetoEndTime;
        uint64 executedAt;
        uint256 epoch;
        uint256 currentSignatures;
        uint256 requiredSignatures;
        address[] guardians;
        Allocation[] defaultAllocations;
        address[] plannedTokens;
        uint256 nftRuleCount;
        address nftFallback;
        uint256 ethBalance;
    }

    // ---------------------------------------------------------------------
    // Constants & immutables
    // ---------------------------------------------------------------------

    uint16 public constant TOTAL_BPS = 10_000;
    uint256 public constant MAX_GUARDIANS = 20;
    uint256 public constant MAX_ALLOCATIONS = 20;
    uint256 public constant MAX_TOKEN_PLANS = 20;
    uint256 public constant MAX_NFT_RULES = 50;
    /// @notice Token address denoting native ETH.
    address public constant ETH = address(0);
    /// @notice Key used in PlanUpdated events for the default plan.
    address public constant DEFAULT_PLAN = address(type(uint160).max);

    bytes32 public constant ATTEST_TYPEHASH = keccak256("Attest(address vault,uint256 epoch,uint256 deadline)");

    IEntryPoint private immutable _entryPoint;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address public owner;
    /// @dev Only Active, TriggerPending or Executed are ever stored. Watch is derived from time.
    VaultState internal _storedState;

    address public executor;
    string public assetMapCID;

    uint64 public lastHeartbeat;
    uint64 public inactivityThreshold;
    uint64 public vetoGracePeriod;
    uint64 public vetoEndTime;
    uint64 public executedAt;

    address[] internal _guardians;
    mapping(address => bool) public isGuardian;
    uint256 public requiredSignatures;

    /// @notice Attestation round. Bumped on every owner heartbeat, invalidating all earlier votes.
    uint256 public epoch;
    mapping(uint256 epoch => mapping(address guardian => bool)) public hasAttested;
    mapping(uint256 epoch => uint256) public attestationCount;

    // Estate plan
    Allocation[] internal _defaultPlan;
    mapping(address token => Allocation[]) internal _tokenPlans;
    address[] internal _plannedTokens;
    mapping(address token => bool) public hasTokenPlan;
    /// @dev How many allocations / NFT rules name an address (an address is a beneficiary while > 0).
    mapping(address => uint256) internal _beneficiaryRefs;

    mapping(address collection => mapping(uint256 tokenId => NftRule)) internal _nftRules;
    NftRule[] internal _nftRuleList;
    address public nftFallback;
    mapping(address collection => mapping(uint256 tokenId => bool)) public nftClaimed;

    // Payout accounting (per token)
    mapping(address token => uint256) public totalReleased;
    mapping(address token => mapping(address heir => uint256)) public released;

    /// @notice Off-chain activity reporters approved by the owner. They can only prove liveness.
    mapping(address => bool) public isHeartbeatSource;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event VaultInitialized(address indexed owner, IEntryPoint indexed entryPoint);
    event HeartbeatPinged(uint256 timestamp, uint256 indexed epoch);
    event GuardianAttested(address indexed guardian, uint256 indexed epoch, uint256 count);
    event AttestationRevoked(address indexed guardian, uint256 indexed epoch, uint256 count);
    event TriggerPending(uint256 indexed epoch, uint256 vetoEndTime);
    event RecoveryVetoed(uint256 indexed epoch, uint256 timestamp);
    event ReleaseExecuted(uint256 timestamp);
    event Claimed(address indexed heir, address indexed token, uint256 amount);
    event NftClaimed(address indexed heir, address indexed collection, uint256 indexed tokenId);
    event GuardiansUpdated(address[] guardians, uint256 requiredSignatures);
    event PlanUpdated(address indexed token, Allocation[] allocations);
    event PlanRemoved(address indexed token);
    event NftRuleUpdated(address indexed collection, uint256 indexed tokenId, address beneficiary, uint64 unlockAt);
    event NftFallbackUpdated(address indexed beneficiary);
    event ExecutorUpdated(address indexed executor);
    event AssetMapUpdated(string cid);
    event TimingsUpdated(uint64 inactivityThreshold, uint64 vetoGracePeriod);
    event HeartbeatSourceUpdated(address indexed source, bool allowed);
    event ActivityRecorded(address indexed source, uint256 activityTimestamp, uint256 indexed epoch);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotOwnerOrEntryPoint();
    error NotGuardian();
    error VaultAlreadyExecuted();
    error InvalidState(VaultState current);
    error OwnerStillActive(uint256 watchStartsAt);
    error AlreadyAttested();
    error NotAttested();
    error VetoWindowOpen(uint256 vetoEndTime);
    error NothingToClaim();
    error NotYetUnlocked(uint256 unlockAt);
    error NoNftRule();
    error NftAlreadyClaimed();
    error EthTransferFailed();
    error InvalidConfig(string reason);
    error ArrayLengthMismatch();
    error NotHeartbeatSource();
    error InvalidActivityTimestamp();
    error SignatureExpired();
    error InvalidSignature();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    /// @dev Owner directly, the vault itself (owner UserOp routed through execute()), or the EntryPoint
    ///      (owner UserOp calling the function directly). The EntryPoint is safe to trust here because
    ///      _validateSignature only admits owner-signed ops before execution, and afterwards only claims.
    modifier onlyOwner() {
        if (msg.sender != owner && msg.sender != address(this) && msg.sender != address(_entryPoint)) {
            revert NotOwner();
        }
        _;
    }

    // ---------------------------------------------------------------------
    // Construction (implementation) & initialization (each clone)
    // ---------------------------------------------------------------------

    constructor(IEntryPoint anEntryPoint) EIP712("HeirloomVault", "2") {
        _entryPoint = anEntryPoint;
        _disableInitializers();
    }

    function initialize(Config calldata cfg) external initializer {
        if (cfg.owner == address(0)) revert InvalidConfig("owner=0");
        owner = cfg.owner;
        _setTimings(cfg.inactivityThreshold, cfg.vetoGracePeriod);
        _setGuardians(cfg.guardians, cfg.requiredSignatures);
        _setPlan(ETH, cfg.defaultAllocations, true);
        if (cfg.tokenPlans.length > MAX_TOKEN_PLANS) revert InvalidConfig("too many token plans");
        for (uint256 i = 0; i < cfg.tokenPlans.length; i++) {
            _setPlan(cfg.tokenPlans[i].token, cfg.tokenPlans[i].allocations, false);
        }
        for (uint256 i = 0; i < cfg.nftRules.length; i++) {
            NftRule calldata r = cfg.nftRules[i];
            _setNftRule(r.collection, r.tokenId, r.beneficiary, r.unlockAt);
        }
        _setNftFallback(cfg.nftFallback);
        executor = cfg.executor;
        assetMapCID = cfg.assetMapCID;
        lastHeartbeat = uint64(block.timestamp);
        emit VaultInitialized(cfg.owner, _entryPoint);
    }

    receive() external payable {}

    /// @inheritdoc IERC721Receiver
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ---------------------------------------------------------------------
    // ERC-4337
    // ---------------------------------------------------------------------

    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    /// @dev Before execution: only the owner may sign UserOps.
    ///      After execution: only a beneficiary may sign, and only a claim for themselves
    ///      (`claim(token, self)` or `claimNft(collection, tokenId)` for an NFT ruled to them).
    ///      Reads only this account's own storage and never uses block.timestamp (ERC-7562 safe).
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        override
        returns (uint256)
    {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, userOp.signature);
        if (err != ECDSA.RecoverError.NoError) return SIG_VALIDATION_FAILED;

        if (_storedState != VaultState.Executed) {
            return signer == owner ? SIG_VALIDATION_SUCCESS : SIG_VALIDATION_FAILED;
        }

        bytes calldata data = userOp.callData;
        if (data.length != 4 + 64) return SIG_VALIDATION_FAILED;
        bytes4 selector = bytes4(data[:4]);
        if (selector == this.claim.selector) {
            (, address heir) = abi.decode(data[4:], (address, address));
            return heir == signer && _beneficiaryRefs[heir] > 0 ? SIG_VALIDATION_SUCCESS : SIG_VALIDATION_FAILED;
        }
        if (selector == this.claimNft.selector) {
            (address collection, uint256 tokenId) = abi.decode(data[4:], (address, uint256));
            if (nftClaimed[collection][tokenId]) return SIG_VALIDATION_FAILED;
            address to = _nftRules[collection][tokenId].beneficiary;
            if (to == address(0)) to = nftFallback;
            return to == signer && to != address(0) ? SIG_VALIDATION_SUCCESS : SIG_VALIDATION_FAILED;
        }
        return SIG_VALIDATION_FAILED;
    }

    /// @notice Execute a call from the vault. Counts as an owner heartbeat.
    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPointOrOwner();
        _heartbeat();
        _call(dest, value, func);
    }

    /// @notice Execute a batch of calls from the vault. Counts as an owner heartbeat.
    /// @dev A zero-length `value` array means zero value for every call.
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external {
        _requireFromEntryPointOrOwner();
        if (dest.length != func.length || (value.length != 0 && value.length != func.length)) {
            revert ArrayLengthMismatch();
        }
        _heartbeat();
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value.length == 0 ? 0 : value[i], func[i]);
        }
    }

    /// @notice Pre-fund gas for future UserOps (e.g. heirs' gasless claims) in the EntryPoint.
    function addDeposit() external payable {
        _entryPoint.depositTo{value: msg.value}(address(this));
    }

    function getDeposit() external view returns (uint256) {
        return _entryPoint.balanceOf(address(this));
    }

    function withdrawDepositTo(address payable to, uint256 amount) external onlyOwner {
        _heartbeat();
        _entryPoint.withdrawTo(to, amount);
    }

    // ---------------------------------------------------------------------
    // Owner: liveness
    // ---------------------------------------------------------------------

    /// @notice Explicit "I'm alive" check-in.
    function pingHeartbeat() external onlyOwner {
        _heartbeat();
    }

    /// @notice Cancel a pending inheritance trigger. Equivalent to a heartbeat.
    function vetoRecovery() external onlyOwner {
        _heartbeat();
    }

    // ---------------------------------------------------------------------
    // Owner: configuration (only while not executed; each call is also a heartbeat)
    // ---------------------------------------------------------------------

    function setGuardians(address[] calldata guardians_, uint256 requiredSignatures_) external onlyOwner {
        _heartbeat();
        _setGuardians(guardians_, requiredSignatures_);
    }

    /// @notice Replace the default split (used by every token without its own plan).
    function setDefaultPlan(Allocation[] calldata allocations) external onlyOwner {
        _heartbeat();
        _setPlan(ETH, allocations, true);
    }

    /// @notice Give a specific token its own split (token = address(0) for ETH).
    function setTokenPlan(address token, Allocation[] calldata allocations) external onlyOwner {
        _heartbeat();
        _setPlan(token, allocations, false);
    }

    /// @notice Remove a token's own split; it falls back to the default split.
    function removeTokenPlan(address token) external onlyOwner {
        _heartbeat();
        if (!hasTokenPlan[token]) revert InvalidConfig("no plan");
        _clearPlan(_tokenPlans[token]);
        hasTokenPlan[token] = false;
        for (uint256 i = 0; i < _plannedTokens.length; i++) {
            if (_plannedTokens[i] == token) {
                _plannedTokens[i] = _plannedTokens[_plannedTokens.length - 1];
                _plannedTokens.pop();
                break;
            }
        }
        emit PlanRemoved(token);
    }

    /// @notice Leave a specific NFT to a specific person (beneficiary = address(0) removes the rule).
    function setNftRule(address collection, uint256 tokenId, address beneficiary, uint64 unlockAt) external onlyOwner {
        _heartbeat();
        _setNftRule(collection, tokenId, beneficiary, unlockAt);
    }

    function setNftFallback(address beneficiary) external onlyOwner {
        _heartbeat();
        _setNftFallback(beneficiary);
    }

    function setExecutor(address executor_) external onlyOwner {
        _heartbeat();
        executor = executor_;
        emit ExecutorUpdated(executor_);
    }

    function setAssetMapCID(string calldata cid) external onlyOwner {
        _heartbeat();
        assetMapCID = cid;
        emit AssetMapUpdated(cid);
    }

    function setTimings(uint64 inactivityThreshold_, uint64 vetoGracePeriod_) external onlyOwner {
        _heartbeat();
        _setTimings(inactivityThreshold_, vetoGracePeriod_);
    }

    /// @notice Approve or remove an off-chain activity reporter (e.g. a bank-activity oracle).
    function setHeartbeatSource(address source, bool allowed) external onlyOwner {
        _heartbeat();
        if (source == address(0) || source == owner) revert InvalidConfig("heartbeat source");
        isHeartbeatSource[source] = allowed;
        emit HeartbeatSourceUpdated(source, allowed);
    }

    // ---------------------------------------------------------------------
    // Off-chain liveness (heartbeat sources)
    // ---------------------------------------------------------------------

    /// @notice Report owner activity at `activityTimestamp`. Cannot cancel a pending trigger.
    function recordActivity(uint64 activityTimestamp) external {
        if (!isHeartbeatSource[msg.sender]) revert NotHeartbeatSource();
        if (_storedState != VaultState.Active) revert InvalidState(currentState());
        if (activityTimestamp <= lastHeartbeat || activityTimestamp > block.timestamp) {
            revert InvalidActivityTimestamp();
        }
        lastHeartbeat = activityTimestamp;
        uint256 newEpoch = ++epoch;
        emit ActivityRecorded(msg.sender, activityTimestamp, newEpoch);
    }

    // ---------------------------------------------------------------------
    // Guardians
    // ---------------------------------------------------------------------

    /// @notice Attest that the owner has died or is incapacitated (guardian pays gas).
    function attestGuardian() external {
        _attest(msg.sender);
    }

    /// @notice Gasless attestation: the guardian signs EIP-712 `Attest(vault, epoch, deadline)` off-chain and
    ///         anyone (e.g. the law firm or a relayer) submits it. Bound to this vault and to the current
    ///         attestation round, so it cannot be replayed after a veto.
    function attestGuardianWithSig(address guardian, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(attestDigest(deadline), signature);
        if (err != ECDSA.RecoverError.NoError || signer != guardian) revert InvalidSignature();
        _attest(guardian);
    }

    /// @notice EIP-712 digest a guardian signs for attestGuardianWithSig in the current round.
    function attestDigest(uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ATTEST_TYPEHASH, address(this), epoch, deadline)));
    }

    /// @notice Withdraw an attestation cast in the current round before the threshold is reached.
    function revokeAttestation() external {
        if (_storedState != VaultState.Active) revert InvalidState(_storedState);
        uint256 e = epoch;
        if (!hasAttested[e][msg.sender]) revert NotAttested();
        hasAttested[e][msg.sender] = false;
        uint256 count = --attestationCount[e];
        emit AttestationRevoked(msg.sender, e, count);
    }

    // ---------------------------------------------------------------------
    // Release & claims
    // ---------------------------------------------------------------------

    /// @notice Finalize inheritance once the veto window has passed. Callable by anyone.
    function executeRelease() external {
        if (_storedState != VaultState.TriggerPending) revert InvalidState(currentState());
        if (block.timestamp <= vetoEndTime) revert VetoWindowOpen(vetoEndTime);
        _storedState = VaultState.Executed;
        executedAt = uint64(block.timestamp);
        emit ReleaseExecuted(block.timestamp);
    }

    /// @notice Pay `heir` everything currently due to them in `token` (address(0) = ETH). Callable by anyone,
    ///         including a gasless UserOp signed by the heir. Funds always go to `heir`.
    function claim(address token, address heir) external nonReentrant {
        if (_storedState != VaultState.Executed) revert InvalidState(currentState());
        uint256 amount = _claimable(token, heir);
        if (amount == 0) {
            uint64 unlock = _nextUnlock(token, heir);
            if (unlock != 0) revert NotYetUnlocked(unlock);
            revert NothingToClaim();
        }
        _release(token, heir, amount);
        if (!_send(token, heir, amount)) revert EthTransferFailed();
        emit Claimed(heir, token, amount);
    }

    /// @notice Push everything currently due in `token` to every heir of its plan. Callable by anyone
    ///         (e.g. the executor). An heir whose transfer fails is skipped and can still claim later.
    function distribute(address token) external nonReentrant returns (uint256 paid) {
        if (_storedState != VaultState.Executed) revert InvalidState(currentState());
        Allocation[] storage plan = _planFor(token);
        for (uint256 i = 0; i < plan.length; i++) {
            address heir = plan[i].beneficiary;
            uint256 amount = _claimable(token, heir);
            if (amount == 0) continue;
            _release(token, heir, amount);
            if (_send(token, heir, amount)) {
                paid++;
                emit Claimed(heir, token, amount);
            } else {
                // undo bookkeeping so the heir can still claim later
                released[token][heir] -= amount;
                totalReleased[token] -= amount;
            }
        }
    }

    /// @notice Transfer an NFT to the heir its rule names (or the fallback heir). Callable by anyone.
    function claimNft(address collection, uint256 tokenId) external nonReentrant {
        if (_storedState != VaultState.Executed) revert InvalidState(currentState());
        if (nftClaimed[collection][tokenId]) revert NftAlreadyClaimed();
        NftRule memory r = _nftRules[collection][tokenId];
        address to = r.beneficiary != address(0) ? r.beneficiary : nftFallback;
        if (to == address(0)) revert NoNftRule();
        uint256 unlock = r.unlockAt > executedAt ? r.unlockAt : executedAt;
        if (block.timestamp < unlock) revert NotYetUnlocked(unlock);
        nftClaimed[collection][tokenId] = true;
        IERC721(collection).safeTransferFrom(address(this), to, tokenId);
        emit NftClaimed(to, collection, tokenId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Current lifecycle state, including the time-derived Watch state (0..3 over the ABI).
    function currentState() public view returns (VaultState) {
        VaultState s = _storedState;
        if (s != VaultState.Active) return s;
        if (block.timestamp > uint256(lastHeartbeat) + inactivityThreshold) return VaultState.Watch;
        return VaultState.Active;
    }

    /// @notice Single boolean gate for off-chain release conditions (escrow, Lit, ...).
    function isExecuted() external view returns (bool) {
        return _storedState == VaultState.Executed;
    }

    /// @notice Stage-1 gate: true only for the executor, and only after execution.
    function canAccessAssetMap(address who) external view returns (bool) {
        return _storedState == VaultState.Executed && who == executor && who != address(0);
    }

    /// @notice True if `who` is named in any split or NFT rule (or is the NFT fallback heir).
    function isBeneficiary(address who) external view returns (bool) {
        return _beneficiaryRefs[who] > 0 || (who != address(0) && who == nftFallback);
    }

    function currentSignatures() external view returns (uint256) {
        return attestationCount[epoch];
    }

    function hasAttestedThisRound(address guardian) external view returns (bool) {
        return hasAttested[epoch][guardian];
    }

    function watchStartsAt() public view returns (uint64) {
        return lastHeartbeat + inactivityThreshold;
    }

    function getGuardians() external view returns (address[] memory) {
        return _guardians;
    }

    /// @notice The split that applies to `token` (its own plan, or the default).
    function getPlan(address token) external view returns (Allocation[] memory) {
        return _planFor(token);
    }

    function getPlannedTokens() external view returns (address[] memory) {
        return _plannedTokens;
    }

    function getNftRules() external view returns (NftRule[] memory rules) {
        uint256 n;
        for (uint256 i = 0; i < _nftRuleList.length; i++) {
            if (_nftRules[_nftRuleList[i].collection][_nftRuleList[i].tokenId].beneficiary != address(0)) n++;
        }
        rules = new NftRule[](n);
        uint256 j;
        for (uint256 i = 0; i < _nftRuleList.length; i++) {
            NftRule memory r = _nftRules[_nftRuleList[i].collection][_nftRuleList[i].tokenId];
            if (r.beneficiary != address(0)) rules[j++] = r;
        }
    }

    /// @notice What `heir` could receive from claim(token, heir) right now.
    function claimable(address token, address heir) external view returns (uint256) {
        if (_storedState != VaultState.Executed) return 0;
        return _claimable(token, heir);
    }

    /// @notice Earliest future unlock / installment time for `heir` in `token` (0 = nothing pending).
    function nextUnlock(address token, address heir) external view returns (uint64) {
        return _nextUnlock(token, heir);
    }

    /// @notice Full share of `heir` in `token` once every condition and installment has passed.
    function entitlement(address token, address heir) external view returns (uint256 total) {
        Allocation[] storage plan = _planFor(token);
        uint256 pot = _balanceOf(token) + totalReleased[token];
        for (uint256 i = 0; i < plan.length; i++) {
            if (plan[i].beneficiary == heir) total += (pot * plan[i].bps) / TOTAL_BPS;
        }
    }

    /// @notice Everything a dashboard needs in one call.
    function getVaultInfo() external view returns (VaultInfo memory info) {
        info.state = currentState();
        info.owner = owner;
        info.executor = executor;
        info.assetMapCID = assetMapCID;
        info.lastHeartbeat = lastHeartbeat;
        info.inactivityThreshold = inactivityThreshold;
        info.vetoGracePeriod = vetoGracePeriod;
        info.watchStartsAt = watchStartsAt();
        info.vetoEndTime = vetoEndTime;
        info.executedAt = executedAt;
        info.epoch = epoch;
        info.currentSignatures = attestationCount[epoch];
        info.requiredSignatures = requiredSignatures;
        info.guardians = _guardians;
        info.defaultAllocations = _defaultPlan;
        info.plannedTokens = _plannedTokens;
        info.nftRuleCount = _nftRuleList.length;
        info.nftFallback = nftFallback;
        info.ethBalance = address(this).balance;
    }

    // ---------------------------------------------------------------------
    // Internal: lifecycle
    // ---------------------------------------------------------------------

    function _attest(address guardian) internal {
        if (!isGuardian[guardian]) revert NotGuardian();
        if (_storedState != VaultState.Active) revert InvalidState(_storedState);
        uint256 watchAt = uint256(lastHeartbeat) + inactivityThreshold;
        if (block.timestamp <= watchAt) revert OwnerStillActive(watchAt);

        uint256 e = epoch;
        if (hasAttested[e][guardian]) revert AlreadyAttested();
        hasAttested[e][guardian] = true;
        uint256 count = ++attestationCount[e];
        emit GuardianAttested(guardian, e, count);

        if (count >= requiredSignatures) {
            _storedState = VaultState.TriggerPending;
            vetoEndTime = uint64(block.timestamp + vetoGracePeriod);
            emit TriggerPending(e, vetoEndTime);
        }
    }

    /// @dev Proof of life: refresh heartbeat, cancel any pending trigger, start a new attestation round.
    function _heartbeat() internal {
        VaultState s = _storedState;
        if (s == VaultState.Executed) revert VaultAlreadyExecuted();
        uint256 newEpoch = ++epoch;
        if (s == VaultState.TriggerPending) {
            _storedState = VaultState.Active;
            vetoEndTime = 0;
            emit RecoveryVetoed(newEpoch - 1, block.timestamp);
        }
        lastHeartbeat = uint64(block.timestamp);
        emit HeartbeatPinged(block.timestamp, newEpoch);
    }

    function _requireFromEntryPointOrOwner() internal view {
        if (msg.sender != address(_entryPoint) && msg.sender != owner) revert NotOwnerOrEntryPoint();
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    // ---------------------------------------------------------------------
    // Internal: payouts
    // ---------------------------------------------------------------------

    function _planFor(address token) internal view returns (Allocation[] storage) {
        return hasTokenPlan[token] ? _tokenPlans[token] : _defaultPlan;
    }

    function _balanceOf(address token) internal view returns (uint256) {
        return token == ETH ? address(this).balance : IERC20(token).balanceOf(address(this));
    }

    /// @dev Vested entitlement minus what was already released (PaymentSplitter-style).
    function _claimable(address token, address heir) internal view returns (uint256) {
        Allocation[] storage plan = _planFor(token);
        uint256 pot = _balanceOf(token) + totalReleased[token];
        uint256 vested;
        for (uint256 i = 0; i < plan.length; i++) {
            Allocation storage a = plan[i];
            if (a.beneficiary != heir) continue;
            uint256 start = a.unlockAt > executedAt ? a.unlockAt : executedAt;
            if (block.timestamp < start) continue;
            uint256 n = a.installments;
            if (n > 1) {
                uint256 done = 1 + (block.timestamp - start) / a.interval;
                if (done < n) n = done;
            }
            vested += (pot * a.bps * n) / (uint256(TOTAL_BPS) * a.installments);
        }
        uint256 already = released[token][heir];
        if (vested <= already) return 0;
        // Gas for gasless (ERC-4337) claims is paid from the shared ETH balance, so the last claimer's
        // computed share can exceed what is left by a few wei of gas; never promise more than the vault holds.
        uint256 due = vested - already;
        uint256 bal = pot - totalReleased[token];
        return due < bal ? due : bal;
    }

    /// @dev Earliest future unlock/installment time for `heir` in `token` (0 if none pending).
    function _nextUnlock(address token, address heir) internal view returns (uint64 next) {
        if (_storedState != VaultState.Executed) return 0;
        Allocation[] storage plan = _planFor(token);
        for (uint256 i = 0; i < plan.length; i++) {
            Allocation storage a = plan[i];
            if (a.beneficiary != heir) continue;
            uint64 start = a.unlockAt > executedAt ? a.unlockAt : executedAt;
            uint64 t = start;
            if (block.timestamp >= start) {
                if (a.installments <= 1) continue;
                uint256 done = 1 + (block.timestamp - start) / a.interval;
                if (done >= a.installments) continue;
                t = uint64(start + done * a.interval);
            }
            if (next == 0 || t < next) next = t;
        }
    }

    function _release(address token, address heir, uint256 amount) internal {
        released[token][heir] += amount;
        totalReleased[token] += amount;
    }

    function _send(address token, address to, uint256 amount) internal returns (bool ok) {
        if (token == ETH) {
            (ok,) = payable(to).call{value: amount}("");
        } else {
            (bool success, bytes memory ret) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
            ok = success && token.code.length > 0 && (ret.length == 0 || abi.decode(ret, (bool)));
        }
    }

    // ---------------------------------------------------------------------
    // Internal: configuration
    // ---------------------------------------------------------------------

    function _setTimings(uint64 inactivityThreshold_, uint64 vetoGracePeriod_) internal {
        if (inactivityThreshold_ == 0 || vetoGracePeriod_ == 0) revert InvalidConfig("timing=0");
        inactivityThreshold = inactivityThreshold_;
        vetoGracePeriod = vetoGracePeriod_;
        emit TimingsUpdated(inactivityThreshold_, vetoGracePeriod_);
    }

    function _setGuardians(address[] memory guardians_, uint256 required) internal {
        uint256 n = guardians_.length;
        if (n == 0 || n > MAX_GUARDIANS) revert InvalidConfig("guardian count");
        if (required == 0 || required > n) revert InvalidConfig("threshold");

        for (uint256 i = 0; i < _guardians.length; i++) {
            isGuardian[_guardians[i]] = false;
        }
        delete _guardians;

        for (uint256 i = 0; i < n; i++) {
            address g = guardians_[i];
            if (g == address(0) || g == owner) revert InvalidConfig("guardian address");
            if (isGuardian[g]) revert InvalidConfig("duplicate guardian");
            isGuardian[g] = true;
            _guardians.push(g);
        }
        requiredSignatures = required;
        emit GuardiansUpdated(guardians_, required);
    }

    function _clearPlan(Allocation[] storage plan) internal {
        for (uint256 i = 0; i < plan.length; i++) {
            _beneficiaryRefs[plan[i].beneficiary]--;
        }
        while (plan.length > 0) plan.pop();
    }

    /// @dev isDefault = true writes the default plan; otherwise the plan for `token`.
    function _setPlan(address token, Allocation[] memory allocations, bool isDefault) internal {
        uint256 n = allocations.length;
        if (n == 0 || n > MAX_ALLOCATIONS) revert InvalidConfig("allocation count");
        if (!isDefault && !hasTokenPlan[token] && _plannedTokens.length >= MAX_TOKEN_PLANS) {
            revert InvalidConfig("too many token plans");
        }
        Allocation[] storage plan = isDefault ? _defaultPlan : _tokenPlans[token];
        _clearPlan(plan);

        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            Allocation memory a = allocations[i];
            if (a.beneficiary == address(0) || a.beneficiary == owner) revert InvalidConfig("beneficiary address");
            if (a.bps == 0) revert InvalidConfig("zero share");
            if (a.installments == 0) revert InvalidConfig("installments=0");
            if (a.installments > 1 && a.interval == 0) revert InvalidConfig("interval=0");
            for (uint256 j = 0; j < i; j++) {
                if (allocations[j].beneficiary == a.beneficiary) revert InvalidConfig("duplicate beneficiary");
            }
            plan.push(a);
            _beneficiaryRefs[a.beneficiary]++;
            total += a.bps;
        }
        if (total != TOTAL_BPS) revert InvalidConfig("shares != 10000");

        if (!isDefault && !hasTokenPlan[token]) {
            hasTokenPlan[token] = true;
            _plannedTokens.push(token);
        }
        emit PlanUpdated(isDefault ? DEFAULT_PLAN : token, allocations);
    }

    function _setNftRule(address collection, uint256 tokenId, address beneficiary, uint64 unlockAt) internal {
        if (collection == address(0)) revert InvalidConfig("collection=0");
        if (beneficiary != address(0) && beneficiary == owner) revert InvalidConfig("beneficiary address");
        NftRule storage r = _nftRules[collection][tokenId];
        if (r.beneficiary != address(0)) {
            _beneficiaryRefs[r.beneficiary]--;
        } else if (beneficiary != address(0) && r.collection == address(0)) {
            if (_nftRuleList.length >= MAX_NFT_RULES) revert InvalidConfig("too many nft rules");
            _nftRuleList.push(NftRule(collection, tokenId, address(0), 0));
        }
        r.collection = collection;
        r.tokenId = tokenId;
        r.beneficiary = beneficiary;
        r.unlockAt = unlockAt;
        if (beneficiary != address(0)) _beneficiaryRefs[beneficiary]++;
        emit NftRuleUpdated(collection, tokenId, beneficiary, unlockAt);
    }

    function _setNftFallback(address beneficiary) internal {
        if (beneficiary != address(0) && beneficiary == owner) revert InvalidConfig("beneficiary address");
        nftFallback = beneficiary;
        emit NftFallbackUpdated(beneficiary);
    }
}
