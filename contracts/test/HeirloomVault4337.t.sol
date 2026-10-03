// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {HeirloomBase} from "./HeirloomBase.t.sol";
import {HeirloomVault} from "../src/HeirloomVault.sol";
import {HeirloomVaultFactory} from "../src/HeirloomVaultFactory.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice End-to-end tests that route UserOperations through a real v0.7 EntryPoint.
contract HeirloomVault4337Test is HeirloomBase {
    address payable internal bundler = payable(makeAddr("bundler"));

    function _op(address sender, bytes memory callData, bytes memory initCode)
        internal
        view
        returns (PackedUserOperation memory op)
    {
        op.sender = sender;
        op.nonce = entryPoint.getNonce(sender, 0);
        op.initCode = initCode;
        op.callData = callData;
        op.accountGasLimits = bytes32((uint256(1_000_000) << 128) | uint256(300_000));
        op.preVerificationGas = 50_000;
        op.gasFees = bytes32((uint256(1 gwei) << 128) | uint256(1 gwei));
    }

    function _sign(PackedUserOperation memory op, uint256 key) internal view {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(entryPoint.getUserOpHash(op));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        op.signature = abi.encodePacked(r, s, v);
    }

    function _handle(PackedUserOperation memory op) internal {
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.prank(bundler, bundler);
        entryPoint.handleOps(ops, bundler);
    }

    function _expectSigFailure() internal {
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA24 signature error"));
    }

    // ------------------------------------------------------------------

    function test_OwnerUserOpExecutesAndPingsHeartbeat() public {
        _goInactive();
        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.execute, (stranger, 1 ether, "")), "");
        _sign(op, ownerKey);
        _handle(op);

        assertEq(stranger.balance, 1 ether);
        assertEq(vault.lastHeartbeat(), block.timestamp);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
    }

    function test_OwnerUserOpCancelsPendingTrigger() public {
        _goInactive();
        _attest(3);
        PackedUserOperation memory op = _op(address(vault), abi.encodeCall(HeirloomVault.vetoRecovery, ()), "");
        _sign(op, ownerKey);
        _handle(op);
        assertEq(uint8(vault.currentState()), uint8(HeirloomVault.VaultState.Active));
    }

    function test_RevertWhen_StrangerSignsUserOp() public {
        (, uint256 strangerKey) = makeAddrAndKey("stranger");
        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.execute, (stranger, 1 ether, "")), "");
        _sign(op, strangerKey);
        _expectSigFailure();
        _handle(op);
    }

    function test_RevertWhen_HeirSignsBeforeExecution() public {
        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.claim, (address(0), heirA)), "");
        _sign(op, heirAKey);
        _expectSigFailure();
        _handle(op);
    }

    function test_RevertWhen_OwnerSignsAfterExecution() public {
        _toExecuted();
        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.execute, (owner, 1 ether, "")), "");
        _sign(op, ownerKey);
        _expectSigFailure();
        _handle(op);
    }

    function test_HeirGaslessClaimPaidByVault() public {
        _toExecuted();
        assertEq(heirA.balance, 0);

        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.claim, (address(token), heirA)), "");
        _sign(op, heirAKey);
        _handle(op);

        assertEq(token.balanceOf(heirA), 600e18);
        assertEq(heirA.balance, 0, "heir spent no ETH");
        assertLt(address(vault).balance, 10 ether, "vault paid the gas");
    }

    function test_HeirGaslessEthClaimsDrainVaultExactly() public {
        _toExecuted();

        PackedUserOperation memory opA =
            _op(address(vault), abi.encodeCall(HeirloomVault.claim, (address(0), heirA)), "");
        _sign(opA, heirAKey);
        _handle(opA);

        PackedUserOperation memory opB =
            _op(address(vault), abi.encodeCall(HeirloomVault.claim, (address(0), heirB)), "");
        _sign(opB, heirBKey);
        _handle(opB);

        // Gas comes out of the vault before each claim, so shares are of the post-gas balance.
        assertGt(heirA.balance, 5.9 ether);
        assertGt(heirB.balance, 3.9 ether);
        assertGt(heirA.balance * 4, heirB.balance * 5); // roughly 60/40
        assertLt(address(vault).balance, 0.01 ether); // only the refund of unused gas remains
    }

    function test_RevertWhen_HeirClaimsForSomeoneElse() public {
        _toExecuted();
        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.claim, (address(0), heirB)), "");
        _sign(op, heirAKey);
        _expectSigFailure();
        _handle(op);
    }

    function test_RevertWhen_HeirTriesArbitraryCall() public {
        _toExecuted();
        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.execute, (heirA, 10 ether, "")), "");
        _sign(op, heirAKey);
        _expectSigFailure();
        _handle(op);
    }

    function test_RevertWhen_HeirClaimsTwiceViaUserOp() public {
        _toExecuted();
        vault.claim(address(token), heirA);
        PackedUserOperation memory op =
            _op(address(vault), abi.encodeCall(HeirloomVault.claim, (address(token), heirA)), "");
        _sign(op, heirAKey);
        _expectSigFailure();
        _handle(op);
    }

    function test_CounterfactualDeployViaInitCode() public {
        HeirloomVault.Config memory cfg = _config();
        address predicted = factory.getAddress(cfg, 42);
        assertEq(predicted.code.length, 0);
        vm.deal(predicted, 1 ether);

        bytes memory initCode =
            abi.encodePacked(address(factory), abi.encodeCall(HeirloomVaultFactory.createVault, (cfg, 42)));
        PackedUserOperation memory op = _op(predicted, abi.encodeCall(HeirloomVault.pingHeartbeat, ()), initCode);
        op.accountGasLimits = bytes32((uint256(5_000_000) << 128) | uint256(300_000));
        _sign(op, ownerKey);
        _handle(op);

        assertGt(predicted.code.length, 0);
        assertEq(HeirloomVault(payable(predicted)).owner(), owner);
        address[] memory owned = factory.getVaultsByOwner(owner);
        assertEq(owned[owned.length - 1], predicted);
    }

    function test_FactoryCreateIsIdempotent() public {
        HeirloomVault again = factory.createVault(_config(), 0);
        assertEq(address(again), address(vault));
    }
}
