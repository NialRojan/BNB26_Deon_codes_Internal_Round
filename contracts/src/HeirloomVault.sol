// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "account-abstraction/core/Helpers.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HeirloomVault
/// @notice ERC-4337 smart account with a guardian-attested, veto-protected inheritance state machine.
///
/// Lifecycle:
///   Active --(owner inactive > inactivityThreshold)--> Watch            (computed, never stored)
///   Watch  --(requiredSignatures guardian attestations)--> TriggerPending (veto window opens)
///   TriggerPending --(owner veto / any owner activity)--> Active
///   TriggerPending --(vetoEndTime passed, executeRelease)--> Executed  (terminal)
///
/// Any owner action (UserOp, direct call, pingHeartbeat, vetoRecovery) is proof of life: it refreshes
/// the heartbeat, cancels a pending trigger and starts a new attestation epoch, so stale guardian
/// votes can never be reused.
///
/// Once Executed, the owner key is dead: owner UserOps fail validation and execute() reverts.
/// Beneficiaries can then claim gaslessly by signing a UserOp whose callData is exactly
/// `claim(token, theirAddress)`; gas is paid from the vault itself.
contract HeirloomVault is BaseAccount, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum VaultState {
        Active,
        Watch,
        TriggerPending,
        Executed
    }

    struct Beneficiary {
        address wallet;
        uint16 bps; // share in basis points; all shares sum to TOTAL_BPS
    }

    struct Config {
        address owner;
        address executor;
        address[] guardians;
        uint256 requiredSignatures;
        Beneficiary[] beneficiaries;
        uint64 inactivityThreshold;
        uint64 vetoGracePeriod;
        string assetMapCID;
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
        Beneficiary[] beneficiaries;
        uint256 ethBalance;
    }

    // ---------------------------------------------------------------------
    // Constants & immutables
    // ---------------------------------------------------------------------

    uint16 public constant TOTAL_BPS = 10_000;
    uint256 public constant MAX_GUARDIANS = 20;
    uint256 public constant MAX_BENEFICIARIES = 20;
    /// @notice Token address used to denote native ETH in claim().
    address public constant ETH = address(0);

    IEntryPoint private immutable _entryPoint;
    address public immutable owner;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

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

    Beneficiary[] internal _beneficiaries;
    mapping(address => uint16) public beneficiaryBps;
    /// @notice Sum of bps already paid out per token; used to split the live balance among remaining heirs.
    mapping(address token => uint256) public claimedBps;
    mapping(address token => mapping(address heir => bool)) public hasClaimed;

    /// @notice Off-chain activity reporters (e.g. a bank-transaction oracle) approved by the owner.
    ///         They can only prove liveness: refresh the heartbeat while no trigger is pending.
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
    event GuardiansUpdated(address[] guardians, uint256 requiredSignatures);
    event BeneficiariesUpdated(Beneficiary[] beneficiaries);
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
    error NotBeneficiary();
    error AlreadyClaimed();
    error NothingToClaim();
    error EthTransferFailed();
    error InvalidConfig(string reason);
    error ArrayLengthMismatch();
    error NotHeartbeatSource();
    error InvalidActivityTimestamp();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    /// @dev Owner directly, the vault itself (owner UserOp routed through execute()), or the EntryPoint
    ///      (owner UserOp calling the function directly). The EntryPoint is safe to trust here because
    ///      _validateSignature only admits owner-signed ops before execution, and afterwards only
    ///      `claim`, which is not owner-gated.
    modifier onlyOwner() {
        if (msg.sender != owner && msg.sender != address(this) && msg.sender != address(_entryPoint)) {
            revert NotOwner();
        }
        _;
    }

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor(IEntryPoint anEntryPoint, Config memory cfg) {
        if (cfg.owner == address(0)) revert InvalidConfig("owner=0");
        _entryPoint = anEntryPoint;
        owner = cfg.owner;

        _setTimings(cfg.inactivityThreshold, cfg.vetoGracePeriod);
        _setGuardians(cfg.guardians, cfg.requiredSignatures);
        _setBeneficiaries(cfg.beneficiaries);
        executor = cfg.executor;
        assetMapCID = cfg.assetMapCID;

        lastHeartbeat = uint64(block.timestamp);
        emit VaultInitialized(cfg.owner, anEntryPoint);
    }

    receive() external payable {}

    // ---------------------------------------------------------------------
    // ERC-4337
    // ---------------------------------------------------------------------

    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    /// @dev Before execution: only the owner may sign UserOps.
    ///      After execution: only beneficiaries may sign, and only a single unclaimed `claim(token, self)`.
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
        if (data.length != 4 + 64 || bytes4(data[:4]) != this.claim.selector) return SIG_VALIDATION_FAILED;
        (address token, address heir) = abi.decode(data[4:], (address, address));
        if (heir != signer || beneficiaryBps[heir] == 0 || hasClaimed[token][heir]) return SIG_VALIDATION_FAILED;
        return SIG_VALIDATION_SUCCESS;
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

    function setBeneficiaries(Beneficiary[] calldata beneficiaries_) external onlyOwner {
        _heartbeat();
        _setBeneficiaries(beneficiaries_);
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

    /// @notice Approve or remove an off-chain activity reporter (e.g. the bank-activity oracle).
    function setHeartbeatSource(address source, bool allowed) external onlyOwner {
        _heartbeat();
        if (source == address(0) || source == owner) revert InvalidConfig("heartbeat source");
        isHeartbeatSource[source] = allowed;
        emit HeartbeatSourceUpdated(source, allowed);
    }

    function setTimings(uint64 inactivityThreshold_, uint64 vetoGracePeriod_) external onlyOwner {
        _heartbeat();
        _setTimings(inactivityThreshold_, vetoGracePeriod_);
    }

    // ---------------------------------------------------------------------
    // Off-chain liveness (heartbeat sources)
    // ---------------------------------------------------------------------

    /// @notice Report that the owner did something only a living person can do (e.g. a PIN-authorised
    ///         UPI payment) at `activityTimestamp`. Refreshes the heartbeat and discards stale guardian
    ///         votes. Deliberately cannot cancel a pending trigger: once guardians reach the threshold,
    ///         only the owner's own veto counts, so a compromised source can delay but never block.
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

    /// @notice Attest that the owner is deceased/incapacitated. Only possible once the owner has been
    ///         inactive past the threshold. Reaching the threshold opens the veto window.
    function attestGuardian() external {
        if (!isGuardian[msg.sender]) revert NotGuardian();
        if (_storedState != VaultState.Active) revert InvalidState(_storedState);
        uint256 watchAt = uint256(lastHeartbeat) + inactivityThreshold;
        if (block.timestamp <= watchAt) revert OwnerStillActive(watchAt);

        uint256 e = epoch;
        if (hasAttested[e][msg.sender]) revert AlreadyAttested();
        hasAttested[e][msg.sender] = true;
        uint256 count = ++attestationCount[e];
        emit GuardianAttested(msg.sender, e, count);

        if (count >= requiredSignatures) {
            _storedState = VaultState.TriggerPending;
            vetoEndTime = uint64(block.timestamp + vetoGracePeriod);
            emit TriggerPending(e, vetoEndTime);
        }
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

    /// @notice Pay `heir` their share of `token` (address(0) = ETH). Callable by anyone, including a
    ///         gasless UserOp signed by the heir. The live balance is split among heirs who have not
    ///         yet claimed this token, so the last claimer receives the remainder.
    function claim(address token, address heir) external nonReentrant {
        if (_storedState != VaultState.Executed) revert InvalidState(currentState());
        uint16 bps = beneficiaryBps[heir];
        if (bps == 0) revert NotBeneficiary();
        if (hasClaimed[token][heir]) revert AlreadyClaimed();

        uint256 balance = token == ETH ? address(this).balance : IERC20(token).balanceOf(address(this));
        uint256 amount = (balance * bps) / (TOTAL_BPS - claimedBps[token]);
        if (amount == 0) revert NothingToClaim();

        hasClaimed[token][heir] = true;
        claimedBps[token] += bps;

        if (token == ETH) {
            (bool ok,) = payable(heir).call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else {
            IERC20(token).safeTransfer(heir, amount);
        }
        emit Claimed(heir, token, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Current lifecycle state, including the time-derived Watch state.
    ///         Returns uint8 0..3 over the ABI: Active, Watch, TriggerPending, Executed.
    function currentState() public view returns (VaultState) {
        VaultState s = _storedState;
        if (s != VaultState.Active) return s;
        if (block.timestamp > uint256(lastHeartbeat) + inactivityThreshold) return VaultState.Watch;
        return VaultState.Active;
    }

    /// @notice Single boolean gate for Lit Protocol access control conditions.
    function isExecuted() external view returns (bool) {
        return _storedState == VaultState.Executed;
    }

    /// @notice Stage-1 gate for Lit: true only for the executor, and only after execution.
    ///         Use with functionParams [":userAddress"].
    function canAccessAssetMap(address who) external view returns (bool) {
        return _storedState == VaultState.Executed && who == executor && who != address(0);
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

    function getBeneficiaries() external view returns (Beneficiary[] memory) {
        return _beneficiaries;
    }

    /// @notice Preview what `heir` would receive from claim(token, heir) right now.
    function claimable(address token, address heir) external view returns (uint256) {
        uint16 bps = beneficiaryBps[heir];
        if (_storedState != VaultState.Executed || bps == 0 || hasClaimed[token][heir]) return 0;
        uint256 balance = token == ETH ? address(this).balance : IERC20(token).balanceOf(address(this));
        return (balance * bps) / (TOTAL_BPS - claimedBps[token]);
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
        info.beneficiaries = _beneficiaries;
        info.ethBalance = address(this).balance;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

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

    function _setBeneficiaries(Beneficiary[] memory beneficiaries_) internal {
        uint256 n = beneficiaries_.length;
        if (n == 0 || n > MAX_BENEFICIARIES) revert InvalidConfig("beneficiary count");

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            beneficiaryBps[_beneficiaries[i].wallet] = 0;
        }
        delete _beneficiaries;

        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            Beneficiary memory b = beneficiaries_[i];
            if (b.wallet == address(0) || b.wallet == owner) revert InvalidConfig("beneficiary address");
            if (b.bps == 0) revert InvalidConfig("zero share");
            if (beneficiaryBps[b.wallet] != 0) revert InvalidConfig("duplicate beneficiary");
            beneficiaryBps[b.wallet] = b.bps;
            _beneficiaries.push(b);
            total += b.bps;
        }
        if (total != TOTAL_BPS) revert InvalidConfig("shares != 10000");
        emit BeneficiariesUpdated(beneficiaries_);
    }
}
