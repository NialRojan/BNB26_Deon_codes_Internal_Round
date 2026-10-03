// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {HeirloomBase, MockToken} from "./HeirloomBase.t.sol";
import {HeirloomVault} from "../src/HeirloomVault.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNft is ERC721 {
    constructor() ERC721("Art", "ART") {}

    function mint(address to, uint256 id) external {
        _mint(to, id);
    }
}

/// @notice Real-life estate wishes: per-asset heirs, conditions, staged payouts, NFTs, push distribution,
///         gasless guardian votes, and the factory's config-bound addresses.
contract EstatePlanTest is HeirloomBase {
    uint256 internal constant YEAR = 365 days;
    address internal wife = makeAddr("wife");
    address internal son = makeAddr("son");
    address internal daughter = makeAddr("daughter");
    MockToken internal usdc;
    MockNft internal nft;

    function setUp() public override {
        super.setUp();
        usdc = new MockToken();
        nft = new MockNft();
    }

    function _alloc(address who, uint16 bps) internal pure returns (HeirloomVault.Allocation memory) {
        return HeirloomVault.Allocation(who, bps, 0, 1, 0);
    }

    /// Vault: ETH -> son 100% (paid in 4 yearly installments, from his 21st birthday);
    ///        USDC -> wife 100%; everything else (default) -> wife 50 / daughter 50;
    ///        NFT #1 -> daughter; any other NFT -> son.
    function _estate(uint64 sonTurns21) internal returns (HeirloomVault v) {
        HeirloomVault.Config memory cfg = _config();
        cfg.defaultAllocations = new HeirloomVault.Allocation[](2);
        cfg.defaultAllocations[0] = _alloc(wife, 5_000);
        cfg.defaultAllocations[1] = _alloc(daughter, 5_000);

        cfg.tokenPlans = new HeirloomVault.TokenPlan[](2);
        cfg.tokenPlans[0].token = address(0);
        cfg.tokenPlans[0].allocations = new HeirloomVault.Allocation[](1);
        cfg.tokenPlans[0].allocations[0] = HeirloomVault.Allocation(son, 10_000, sonTurns21, 4, uint32(YEAR));
        cfg.tokenPlans[1].token = address(usdc);
        cfg.tokenPlans[1].allocations = new HeirloomVault.Allocation[](1);
        cfg.tokenPlans[1].allocations[0] = _alloc(wife, 10_000);

        cfg.nftRules = new HeirloomVault.NftRule[](1);
        cfg.nftRules[0] = HeirloomVault.NftRule(address(nft), 1, daughter, 0);
        cfg.nftFallback = son;

        v = factory.createVault(cfg, 7);
        vm.deal(address(v), 8 ether);
        usdc.mint(address(v), 1_000e18);
        token.mint(address(v), 100e18);
        nft.mint(address(v), 1);
        nft.mint(address(v), 2);
    }

    function _execute(HeirloomVault v) internal {
        vm.warp(block.timestamp + INACTIVITY + 1);
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(guardians[i]);
            v.attestGuardian();
        }
        vm.warp(block.timestamp + VETO + 1);
        v.executeRelease();
    }

    // ------------------------------------------------------------------ per-asset heirs

    function test_EachAssetFollowsItsOwnPlan() public {
        HeirloomVault v = _estate(0);
        _execute(v);

        v.claim(address(usdc), wife); // USDC plan: wife 100%
        assertEq(usdc.balanceOf(wife), 1_000e18);

        v.claim(address(token), wife); // no plan for this token: default 50/50
        v.claim(address(token), daughter);
        assertEq(token.balanceOf(wife), 50e18);
        assertEq(token.balanceOf(daughter), 50e18);

        vm.expectRevert(HeirloomVault.NothingToClaim.selector); // wife gets no ETH
        v.claim(address(0), wife);
        assertTrue(v.isBeneficiary(son));
    }

    function test_OwnerCanChangeAndRemoveATokenPlan() public {
        HeirloomVault v = _estate(0);
        HeirloomVault.Allocation[] memory a = new HeirloomVault.Allocation[](1);
        a[0] = _alloc(daughter, 10_000);
        vm.startPrank(owner);
        v.setTokenPlan(address(usdc), a);
        assertEq(v.getPlan(address(usdc))[0].beneficiary, daughter);
        v.removeTokenPlan(address(usdc)); // falls back to default 50/50
        vm.stopPrank();
        assertEq(v.getPlan(address(usdc)).length, 2);
        assertEq(v.getPlannedTokens().length, 1);
    }

    // ------------------------------------------------------------------ conditions + staged payouts

    function test_ConditionAndInstallments() public {
        uint64 birthday21 = uint64(block.timestamp + 3 * YEAR);
        HeirloomVault v = _estate(birthday21);
        _execute(v);

        // Before his 21st birthday: nothing, with a helpful unlock time.
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.NotYetUnlocked.selector, birthday21));
        v.claim(address(0), son);

        vm.warp(birthday21); // installment 1 of 4
        v.claim(address(0), son);
        assertEq(son.balance, 2 ether);
        assertEq(v.nextUnlock(address(0), son), birthday21 + YEAR);

        vm.warp(birthday21 + YEAR + 1); // installment 2
        v.claim(address(0), son);
        assertEq(son.balance, 4 ether);

        vm.warp(birthday21 + 10 * YEAR); // all remaining at once
        v.claim(address(0), son);
        assertEq(son.balance, 8 ether);
        assertEq(address(v).balance, 0);
        assertEq(v.nextUnlock(address(0), son), 0);
    }

    function test_RevertWhen_InstallmentsWithoutInterval() public {
        HeirloomVault.Config memory cfg = _config();
        cfg.defaultAllocations[0].installments = 3;
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidConfig.selector, "interval=0"));
        factory.createVault(cfg, 8);
    }

    // ------------------------------------------------------------------ NFTs

    function test_NftsGoToTheirNamedHeirOrTheFallback() public {
        HeirloomVault v = _estate(0);
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidState.selector, HeirloomVault.VaultState.Active));
        v.claimNft(address(nft), 1);

        _execute(v);
        v.claimNft(address(nft), 1);
        v.claimNft(address(nft), 2);
        assertEq(nft.ownerOf(1), daughter); // named rule
        assertEq(nft.ownerOf(2), son); // fallback

        vm.expectRevert(HeirloomVault.NftAlreadyClaimed.selector);
        v.claimNft(address(nft), 1);
        assertEq(v.getNftRules().length, 1);
    }

    function test_NftWithoutRuleOrFallbackStaysLocked() public {
        nft.mint(address(vault), 9);
        _toExecuted();
        vm.expectRevert(HeirloomVault.NoNftRule.selector);
        vault.claimNft(address(nft), 9);
    }

    // ------------------------------------------------------------------ distribute (push)

    function test_DistributePaysEveryHeirInOneCall() public {
        _toExecuted();
        vm.prank(stranger);
        uint256 paid = vault.distribute(address(0));
        assertEq(paid, 2);
        assertEq(heirA.balance, 6 ether);
        assertEq(heirB.balance, 4 ether);
        assertEq(vault.distribute(address(0)), 0); // nothing left
    }

    function test_DistributeSkipsAnHeirThatRejectsEth() public {
        RejectEth rejecter = new RejectEth();
        HeirloomVault.Config memory cfg = _config();
        cfg.defaultAllocations[1].beneficiary = address(rejecter);
        HeirloomVault v = factory.createVault(cfg, 11);
        vm.deal(address(v), 10 ether);
        _execute(v);

        assertEq(v.distribute(address(0)), 1);
        assertEq(heirA.balance, 6 ether);
        assertEq(v.claimable(address(0), address(rejecter)), 4 ether); // still owed, not lost
    }

    // ------------------------------------------------------------------ gasless guardian votes

    function _guardianKey(uint256 i) internal returns (address addr, uint256 key) {
        (addr, key) = makeAddrAndKey(string.concat("sig-guardian", vm.toString(i)));
    }

    function _sigVault() internal returns (HeirloomVault v, uint256[3] memory keys) {
        HeirloomVault.Config memory cfg = _config();
        for (uint256 i = 0; i < 3; i++) {
            (cfg.guardians[i], keys[i]) = _guardianKey(i);
        }
        cfg.guardians = _trim(cfg.guardians, 3);
        cfg.requiredSignatures = 2;
        v = factory.createVault(cfg, 12);
    }

    function _trim(address[] memory a, uint256 n) internal pure returns (address[] memory out) {
        out = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = a[i];
        }
    }

    function _signAttest(HeirloomVault v, uint256 key, uint256 deadline) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(key, v.attestDigest(deadline));
        return abi.encodePacked(r, s, vv);
    }

    function test_RelayerSubmitsGuardianSignatures() public {
        (HeirloomVault v, uint256[3] memory keys) = _sigVault();
        vm.warp(block.timestamp + INACTIVITY + 1);
        uint256 deadline = block.timestamp + 1 days;
        address[] memory g = v.getGuardians();

        vm.startPrank(stranger); // relayer pays the gas; guardians never hold ETH
        v.attestGuardianWithSig(g[0], deadline, _signAttest(v, keys[0], deadline));
        v.attestGuardianWithSig(g[1], deadline, _signAttest(v, keys[1], deadline));
        vm.stopPrank();
        assertEq(uint8(v.currentState()), uint8(HeirloomVault.VaultState.TriggerPending));
    }

    function test_RevertWhen_SignatureFromWrongGuardianOrExpired() public {
        (HeirloomVault v, uint256[3] memory keys) = _sigVault();
        vm.warp(block.timestamp + INACTIVITY + 1);
        uint256 deadline = block.timestamp + 1 days;
        address[] memory g = v.getGuardians();

        bytes memory wrong = _signAttest(v, keys[1], deadline);
        vm.expectRevert(HeirloomVault.InvalidSignature.selector); // guardian 1's sig claimed as guardian 0
        v.attestGuardianWithSig(g[0], deadline, wrong);

        bytes memory sig = _signAttest(v, keys[0], deadline);
        vm.warp(deadline + 1);
        vm.expectRevert(HeirloomVault.SignatureExpired.selector);
        v.attestGuardianWithSig(g[0], deadline, sig);
    }

    function test_SignatureCannotBeReplayedAfterVeto() public {
        (HeirloomVault v, uint256[3] memory keys) = _sigVault();
        vm.warp(block.timestamp + INACTIVITY + 1);
        uint256 deadline = block.timestamp + 2 * YEAR;
        address[] memory g = v.getGuardians();
        bytes memory sig0 = _signAttest(v, keys[0], deadline);
        v.attestGuardianWithSig(g[0], deadline, sig0);

        vm.prank(owner);
        v.vetoRecovery(); // new attestation round
        vm.warp(block.timestamp + INACTIVITY + 1);
        vm.expectRevert(HeirloomVault.InvalidSignature.selector); // old-round signature is dead
        v.attestGuardianWithSig(g[0], deadline, sig0);
    }

    // ------------------------------------------------------------------ factory (clones, B2B2C)

    function test_AddressIsBoundToTheExactConfig() public {
        HeirloomVault.Config memory cfg = _config();
        address predicted = factory.getAddress(cfg, 42);
        cfg.defaultAllocations[0].beneficiary = stranger; // attacker changes the heirs
        assertTrue(factory.getAddress(cfg, 42) != predicted);
    }

    function test_FactoryRecordsTheCreatingLawFirm() public {
        address lawFirm = makeAddr("lawFirm");
        vm.prank(lawFirm);
        HeirloomVault v = factory.createVault(_config(), 77);
        assertEq(factory.creatorOf(address(v)), lawFirm);
        assertEq(factory.getVaultsByCreator(lawFirm)[0], address(v));
        assertEq(v.owner(), owner); // the firm creates it but the client owns it
    }

    function test_RevertWhen_InitializingTheImplementationOrACloneTwice() public {
        HeirloomVault.Config memory cfg = _config();
        HeirloomVault impl = factory.implementation();
        vm.expectRevert();
        impl.initialize(cfg);
        vm.expectRevert();
        vault.initialize(cfg);
    }
}

contract RejectEth {
    receive() external payable {
        revert("no");
    }
}
