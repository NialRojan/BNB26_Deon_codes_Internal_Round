// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {HeirloomBase} from "./HeirloomBase.t.sol";
import {HeirloomVault} from "../src/HeirloomVault.sol";

/// @notice Off-chain liveness: an owner-approved oracle (e.g. bank activity feed) refreshing the heartbeat.
contract HeartbeatSourceTest is HeirloomBase {
    address internal bankOracle = makeAddr("bankOracle");

    function setUp() public override {
        super.setUp();
        vm.prank(owner);
        vault.setHeartbeatSource(bankOracle, true);
    }

    function test_BankActivityRefreshesHeartbeat() public {
        vm.warp(block.timestamp + 100 days);
        uint64 upiPaymentAt = uint64(block.timestamp - 1 hours);

        vm.expectEmit(address(vault));
        emit HeirloomVault.ActivityRecorded(bankOracle, upiPaymentAt, vault.epoch() + 1);
        vm.prank(bankOracle);
        vault.recordActivity(upiPaymentAt);

        assertEq(vault.lastHeartbeat(), upiPaymentAt);
        assertEq(vault.watchStartsAt(), upiPaymentAt + INACTIVITY);
    }

    function test_BankActivityPullsVaultOutOfWatchAndWipesVotes() public {
        _goInactive();
        _attest(2);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Watch));

        vm.prank(bankOracle);
        vault.recordActivity(uint64(block.timestamp));

        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
        assertEq(vault.currentSignatures(), 0);
    }

    function test_RevertWhen_SourceTriesToCancelPendingTrigger() public {
        _goInactive();
        _attest(3);
        vm.prank(bankOracle);
        vm.expectRevert(
            abi.encodeWithSelector(HeirloomVault.InvalidState.selector, HeirloomVault.VaultState.TriggerPending)
        );
        vault.recordActivity(uint64(block.timestamp));
    }

    function test_RevertWhen_SourceReportsAfterExecution() public {
        _toExecuted();
        vm.prank(bankOracle);
        vm.expectRevert(abi.encodeWithSelector(HeirloomVault.InvalidState.selector, HeirloomVault.VaultState.Executed));
        vault.recordActivity(uint64(block.timestamp));
    }

    function test_RevertWhen_NotASource() public {
        vm.prank(stranger);
        vm.expectRevert(HeirloomVault.NotHeartbeatSource.selector);
        vault.recordActivity(uint64(block.timestamp));
    }

    function test_RevertWhen_FutureTimestamp() public {
        vm.prank(bankOracle);
        vm.expectRevert(HeirloomVault.InvalidActivityTimestamp.selector);
        vault.recordActivity(uint64(block.timestamp + 1));
    }

    function test_RevertWhen_ActivityOlderThanLastHeartbeat() public {
        vm.warp(block.timestamp + 10 days);
        vm.prank(owner);
        vault.pingHeartbeat();
        vm.prank(bankOracle);
        vm.expectRevert(HeirloomVault.InvalidActivityTimestamp.selector);
        vault.recordActivity(uint64(block.timestamp - 1 days));
    }

    function test_OwnerCanRemoveSource() public {
        vm.prank(owner);
        vault.setHeartbeatSource(bankOracle, false);
        vm.prank(bankOracle);
        vm.expectRevert(HeirloomVault.NotHeartbeatSource.selector);
        vault.recordActivity(uint64(block.timestamp));
    }

    function test_RevertWhen_StrangerAddsSource() public {
        vm.prank(stranger);
        vm.expectRevert(HeirloomVault.NotOwner.selector);
        vault.setHeartbeatSource(stranger, true);
    }

    function test_SourceCannotMoveFundsOrVote() public {
        _goInactive();
        vm.startPrank(bankOracle);
        vm.expectRevert(HeirloomVault.NotOwnerOrEntryPoint.selector);
        vault.execute(bankOracle, 1 ether, "");
        vm.expectRevert(HeirloomVault.NotGuardian.selector);
        vault.attestGuardian();
        vm.stopPrank();
    }
}
