// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {HeirloomAuditAnchor} from "../src/HeirloomAuditAnchor.sol";

contract HeirloomAuditAnchorTest is Test {
    HeirloomAuditAnchor internal anchorC;
    address internal admin = makeAddr("admin");
    address internal backend = makeAddr("backend");
    address internal stranger = makeAddr("stranger");

    // Four records -> leaves -> sorted-pair Merkle tree (same construction as the backend).
    bytes32[4] internal records;

    function setUp() public {
        anchorC = new HeirloomAuditAnchor(admin, backend);
        for (uint256 i = 0; i < 4; i++) {
            records[i] = keccak256(abi.encodePacked("audit-record-", vm.toString(i)));
        }
    }

    function _leaf(bytes32 r) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(r));
    }

    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function _root() internal view returns (bytes32) {
        return _pair(_pair(_leaf(records[0]), _leaf(records[1])), _pair(_leaf(records[2]), _leaf(records[3])));
    }

    function test_AnchorAndVerifyEveryRecord() public {
        vm.prank(backend);
        uint256 id = anchorC.anchor(_root(), 0, 4);
        assertEq(id, 0);
        assertEq(anchorC.nextSeq(), 4);

        bytes32 n01 = _pair(_leaf(records[0]), _leaf(records[1]));
        bytes32 n23 = _pair(_leaf(records[2]), _leaf(records[3]));
        bytes32[] memory proof = new bytes32[](2);

        proof[0] = _leaf(records[1]);
        proof[1] = n23;
        assertTrue(anchorC.verify(0, records[0], proof));

        proof[0] = _leaf(records[2]);
        proof[1] = n01;
        assertTrue(anchorC.verify(0, records[3], proof));
    }

    function test_TamperedRecordFailsVerification() public {
        vm.prank(backend);
        anchorC.anchor(_root(), 0, 4);
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = _leaf(records[1]);
        proof[1] = _pair(_leaf(records[2]), _leaf(records[3]));
        bytes32 tampered = keccak256("audit-record-0 (edited)");
        assertFalse(anchorC.verify(0, tampered, proof));
    }

    function test_BatchesMustBeContiguous() public {
        vm.startPrank(backend);
        anchorC.anchor(_root(), 0, 4);
        vm.expectRevert(abi.encodeWithSelector(HeirloomAuditAnchor.NonContiguous.selector, 4));
        anchorC.anchor(_root(), 2, 4); // overlaps / rewrites history
        anchorC.anchor(_root(), 4, 4);
        vm.stopPrank();
        assertEq(anchorC.batchCount(), 2);
        assertEq(anchorC.getBatch(1).firstSeq, 4);
    }

    function test_RevertWhen_NotAnchorer() public {
        vm.prank(stranger);
        vm.expectRevert(HeirloomAuditAnchor.NotAnchorer.selector);
        anchorC.anchor(_root(), 0, 4);
    }

    function test_RevertWhen_EmptyOrZero() public {
        vm.startPrank(backend);
        vm.expectRevert(HeirloomAuditAnchor.EmptyBatch.selector);
        anchorC.anchor(_root(), 0, 0);
        vm.expectRevert(HeirloomAuditAnchor.ZeroRoot.selector);
        anchorC.anchor(bytes32(0), 0, 1);
        vm.stopPrank();
    }

    function test_AdminManagesAnchorers() public {
        vm.prank(stranger);
        vm.expectRevert(HeirloomAuditAnchor.NotAdmin.selector);
        anchorC.setAnchorer(stranger, true);

        vm.prank(admin);
        anchorC.setAnchorer(backend, false);
        vm.prank(backend);
        vm.expectRevert(HeirloomAuditAnchor.NotAnchorer.selector);
        anchorC.anchor(_root(), 0, 4);
    }

    function test_RevertWhen_UnknownBatch() public {
        vm.expectRevert(HeirloomAuditAnchor.UnknownBatch.selector);
        anchorC.verify(0, records[0], new bytes32[](0));
    }
}
