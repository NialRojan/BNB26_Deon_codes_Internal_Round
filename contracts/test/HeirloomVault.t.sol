// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {HeirloomBase, MockToken} from "./HeirloomBase.t.sol";
import {HeirloomVault} from "../src/HeirloomVault.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";

contract HeirloomVaultTest is HeirloomBase {
    // ------------------------------------------------------------------
    // Construction & config validation
    // ------------------------------------------------------------------

    function test_InitialState() public view {
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
        assertEq(vault.owner(), owner);
        assertEq(vault.executor(), executor);
        assertEq(vault.requiredSignatures(), 3);
        assertEq(vault.getGuardians().length, 5);
        assertTrue(vault.isBeneficiary(heirA));
        assertEq(vault.getPlan(address(0))[0].bps, 6_000);
        assertEq(vault.lastHeartbeat(), block.timestamp);
        assertFalse(vault.isExecuted());
    }

    function test_RevertWhen_SharesDoNotSumTo10000() public {
        HeirloomVault.Config memory cfg = _config();
        cfg.defaultAllocations[1].bps = 3_999;
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidConfig.selector, "shares != 10000"));
        factory.createVault(cfg, 99);
    }

    function test_RevertWhen_ThresholdAboveGuardianCount() public {
        HeirloomVault.Config memory cfg = _config();
        cfg.requiredSignatures = 6;
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidConfig.selector, "threshold"));
        factory.createVault(cfg, 99);
    }

    function test_RevertWhen_DuplicateGuardian() public {
        HeirloomVault.Config memory cfg = _config();
        cfg.guardians[1] = cfg.guardians[0];
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidConfig.selector, "duplicate guardian"));
        factory.createVault(cfg, 99);
    }

    function test_RevertWhen_OwnerIsGuardian() public {
        HeirloomVault.Config memory cfg = _config();
        cfg.guardians[0] = owner;
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidConfig.selector, "guardian address"));
        factory.createVault(cfg, 99);
    }

    function test_RevertWhen_OwnerIsBeneficiary() public {
        HeirloomVault.Config memory cfg = _config();
        cfg.defaultAllocations[0].beneficiary = owner;
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidConfig.selector, "beneficiary address"));
        factory.createVault(cfg, 99);
    }

    function test_RevertWhen_ZeroTiming() public {
        HeirloomVault.Config memory cfg = _config();
        cfg.vetoGracePeriod = 0;
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidConfig.selector, "timing=0"));
        factory.createVault(cfg, 99);
    }

    function test_OwnerCanUpdateGuardiansAndOldOnesLoseRole() public {
        address[] memory newGuardians = new address[](2);
        newGuardians[0] = makeAddr("g-new-0");
        newGuardians[1] = makeAddr("g-new-1");
        vm.prank(owner);
        vault.setGuardians(newGuardians, 2);
        assertFalse(vault.isGuardian(guardians[0]));
        assertTrue(vault.isGuardian(newGuardians[1]));
        assertEq(vault.requiredSignatures(), 2);
    }

    function test_OwnerCanUpdateBeneficiariesAndOldOnesLoseShare() public {
        HeirloomVault.Allocation[] memory bs = new HeirloomVault.Allocation[](1);
        bs[0] = HeirloomVault.Allocation(heirB, 10_000, 0, 1, 0);
        vm.prank(owner);
        vault.setDefaultPlan(bs);
        assertFalse(vault.isBeneficiary(heirA));
        assertEq(vault.getPlan(address(0))[0].bps, 10_000);
    }

    function test_RevertWhen_StrangerConfigures() public {
        vm.prank(stranger);
        vm.expectRevert(HeirloomVault.NotOwner.selector);
        vault.setExecutor(stranger);
    }

    // ------------------------------------------------------------------
    // Heartbeat & Watch
    // ------------------------------------------------------------------

    function test_WatchStateIsDerivedFromTime() public {
        vm.warp(block.timestamp + INACTIVITY);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
        vm.warp(block.timestamp + 1);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Watch));
    }

    function test_PingHeartbeatReturnsToActive() public {
        _goInactive();
        vm.prank(owner);
        vault.pingHeartbeat();
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
        assertEq(vault.lastHeartbeat(), block.timestamp);
    }

    function test_OwnerExecuteCountsAsHeartbeat() public {
        _goInactive();
        vm.prank(owner);
        vault.execute(stranger, 1 ether, "");
        assertEq(stranger.balance, 1 ether);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
    }

    function test_RevertWhen_StrangerPings() public {
        vm.prank(stranger);
        vm.expectRevert(HeirloomVault.NotOwner.selector);
        vault.pingHeartbeat();
    }

    // ------------------------------------------------------------------
    // Guardian attestation
    // ------------------------------------------------------------------

    function test_RevertWhen_AttestBeforeInactivity() public {
        vm.prank(guardians[0]);
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.OwnerStillActive.selector, block.timestamp + INACTIVITY));
        vault.attestGuardian();
    }

    function test_RevertWhen_NonGuardianAttests() public {
        _goInactive();
        vm.prank(stranger);
        vm.expectRevert(HeirloomVault.NotGuardian.selector);
        vault.attestGuardian();
    }

    function test_RevertWhen_GuardianAttestsTwice() public {
        _goInactive();
        _attest(1);
        vm.prank(guardians[0]);
        vm.expectRevert(HeirloomVault.AlreadyAttested.selector);
        vault.attestGuardian();
    }

    function test_ThresholdOpensVetoWindow() public {
        _goInactive();
        _attest(2);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Watch));
        assertEq(vault.currentSignatures(), 2);

        vm.expectEmit(address(vault));
        emit HeirloomVault.TriggerPending(0, block.timestamp + VETO);
        vm.prank(guardians[2]);
        vault.attestGuardian();

        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.TriggerPending));
        assertEq(vault.vetoEndTime(), block.timestamp + VETO);
    }

    function test_RevertWhen_AttestDuringTriggerPending() public {
        _goInactive();
        _attest(3);
        vm.prank(guardians[3]);
        vm.expectRevert(
            abi.encodeWithSelector(HeirloomVault.InvalidState.selector, HeirloomVault.VaultState.TriggerPending)
        );
        vault.attestGuardian();
    }

    function test_RevokeAttestation() public {
        _goInactive();
        _attest(2);
        vm.prank(guardians[1]);
        vault.revokeAttestation();
        assertEq(vault.currentSignatures(), 1);
        assertFalse(vault.hasAttestedThisRound(guardians[1]));

        vm.prank(guardians[1]);
        vm.expectRevert(HeirloomVault.NotAttested.selector);
        vault.revokeAttestation();
    }

    function test_HeartbeatInvalidatesStaleVotes() public {
        _goInactive();
        _attest(2);
        vm.prank(owner);
        vault.pingHeartbeat();
        assertEq(vault.currentSignatures(), 0);

        // Much later the owner is inactive again; one more vote must NOT trigger with the 2 stale ones.
        _goInactive();
        vm.prank(guardians[2]);
        vault.attestGuardian();
        assertEq(vault.currentSignatures(), 1);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Watch));
    }

    // ------------------------------------------------------------------
    // Veto
    // ------------------------------------------------------------------

    function test_VetoCancelsTriggerAndGuardiansCanReattest() public {
        _goInactive();
        _attest(3);

        vm.expectEmit(address(vault));
        emit HeirloomVault.RecoveryVetoed(0, block.timestamp);
        vm.prank(owner);
        vault.vetoRecovery();

        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
        assertEq(vault.vetoEndTime(), 0);
        assertEq(vault.currentSignatures(), 0);

        // The same guardians can run a fresh round later.
        _goInactive();
        _attest(3);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.TriggerPending));
    }

    function test_RevertWhen_StrangerVetoes() public {
        _goInactive();
        _attest(3);
        vm.prank(guardians[0]);
        vm.expectRevert(HeirloomVault.NotOwner.selector);
        vault.vetoRecovery();
    }

    // ------------------------------------------------------------------
    // Execution
    // ------------------------------------------------------------------

    function test_RevertWhen_ExecuteDuringVetoWindow() public {
        _goInactive();
        _attest(3);
        uint256 end = vault.vetoEndTime();
        vm.warp(end);
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.VetoWindowOpen.selector, end));
        vault.executeRelease();
    }

    function test_RevertWhen_ExecuteWithoutTrigger() public {
        _goInactive();
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidState.selector, HeirloomVault.VaultState.Watch));
        vault.executeRelease();
    }

    function test_AnyoneCanExecuteAfterVetoWindow() public {
        _goInactive();
        _attest(3);
        vm.warp(block.timestamp + VETO + 1);
        vm.prank(stranger);
        vault.executeRelease();
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Executed));
        assertTrue(vault.isExecuted());
        assertEq(vault.executedAt(), block.timestamp);
    }

    function test_AssetMapGateOnlyOpensForExecutorAfterExecution() public {
        assertFalse(vault.canAccessAssetMap(executor));
        _toExecuted();
        assertTrue(vault.canAccessAssetMap(executor));
        assertFalse(vault.canAccessAssetMap(heirA));
    }

    function test_OwnerIsLockedOutAfterExecution() public {
        _toExecuted();

        vm.startPrank(owner);
        vm.expectRevert(HeirloomVault.VaultAlreadyExecuted.selector);
        vault.execute(owner, 1 ether, "");
        vm.expectRevert(HeirloomVault.VaultAlreadyExecuted.selector);
        vault.vetoRecovery();
        vm.expectRevert(HeirloomVault.VaultAlreadyExecuted.selector);
        vault.pingHeartbeat();
        vm.expectRevert(HeirloomVault.VaultAlreadyExecuted.selector);
        vault.setExecutor(owner);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Claims
    // ------------------------------------------------------------------

    function test_RevertWhen_ClaimBeforeExecution() public {
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidState.selector, HeirloomVault.VaultState.Active));
        vault.claim(address(0), heirA);
    }

    function test_ClaimSplitsEthAndTokens() public {
        _toExecuted();

        assertEq(vault.claimable(address(0), heirA), 6 ether);
        vault.claim(address(0), heirA);
        vault.claim(address(0), heirB);
        assertEq(heirA.balance, 6 ether);
        assertEq(heirB.balance, 4 ether);
        assertEq(address(vault).balance, 0);

        vault.claim(address(token), heirB);
        vault.claim(address(token), heirA);
        assertEq(token.balanceOf(heirA), 600e18);
        assertEq(token.balanceOf(heirB), 400e18);
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function test_RevertWhen_ClaimTwice() public {
        _toExecuted();
        vault.claim(address(0), heirA);
        vm.expectRevert(HeirloomVault.NothingToClaim.selector);
        vault.claim(address(0), heirA);
    }

    function test_RevertWhen_NonBeneficiaryClaims() public {
        _toExecuted();
        vm.expectRevert(HeirloomVault.NothingToClaim.selector);
        vault.claim(address(0), stranger);
    }

    function test_RevertWhen_NothingToClaim() public {
        _toExecuted();
        MockToken empty = new MockToken();
        vm.expectRevert(HeirloomVault.NothingToClaim.selector);
        vault.claim(address(empty), heirA);
    }

    function test_LateDepositsAreSplitByThePlan() public {
        _toExecuted();
        vault.claim(address(0), heirA); // 6 of 10 ether
        vm.deal(address(vault), 5 ether); // 4 left + 1 ether arrives after the first claim
        vault.claim(address(0), heirB); // 40% of the 11 ether ever held
        assertEq(heirB.balance, 4.4 ether);
        assertEq(vault.claimable(address(0), heirA), 0.6 ether); // 60% of 11 = 6.6, 6 already paid
        vault.claim(address(0), heirA);
        assertEq(address(vault).balance, 0);
    }

    function testFuzz_ClaimsNeverExceedBalance(uint16 bpsA, uint96 ethAmount, uint96 tokenAmount) public {
        bpsA = uint16(bound(bpsA, 1, 9_999));
        HeirloomVault.Config memory cfg = _config();
        cfg.defaultAllocations[0].bps = bpsA;
        cfg.defaultAllocations[1].bps = 10_000 - bpsA;
        vault = factory.createVault(cfg, 1);
        vm.deal(address(vault), ethAmount);
        token.mint(address(vault), tokenAmount);
        _toExecuted();

        if (vault.claimable(address(0), heirA) > 0) vault.claim(address(0), heirA);
        if (vault.claimable(address(0), heirB) > 0) vault.claim(address(0), heirB);
        if (vault.claimable(address(token), heirA) > 0) vault.claim(address(token), heirA);
        if (vault.claimable(address(token), heirB) > 0) vault.claim(address(token), heirB);

        assertLe(heirA.balance + heirB.balance, ethAmount);
        assertLe(token.balanceOf(heirA) + token.balanceOf(heirB), tokenAmount);
        // Rounding dust left in the vault is at most 1 wei per heir.
        assertLe(address(vault).balance, 1);
        assertLe(token.balanceOf(address(vault)), 1);
        assertEq(heirA.balance, uint256(ethAmount) * bpsA / 10_000);
    }
}
