// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {HeirloomVault} from "../src/HeirloomVault.sol";
import {HeirloomVaultFactory} from "../src/HeirloomVaultFactory.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract HeirloomBase is Test {
    uint64 internal constant INACTIVITY = 180 days;
    uint64 internal constant VETO = 14 days;

    EntryPoint internal entryPoint;
    HeirloomVaultFactory internal factory;
    HeirloomVault internal vault;
    MockToken internal token;

    address internal owner;
    uint256 internal ownerKey;
    address internal executor = makeAddr("executor");
    address[] internal guardians;
    address internal heirA;
    uint256 internal heirAKey;
    address internal heirB;
    uint256 internal heirBKey;
    address internal stranger = makeAddr("stranger");

    function setUp() public virtual {
        (owner, ownerKey) = makeAddrAndKey("owner");
        (heirA, heirAKey) = makeAddrAndKey("heirA");
        (heirB, heirBKey) = makeAddrAndKey("heirB");
        for (uint256 i = 0; i < 5; i++) {
            guardians.push(makeAddr(string.concat("guardian", vm.toString(i))));
        }

        entryPoint = new EntryPoint();
        factory = new HeirloomVaultFactory(IEntryPoint(address(entryPoint)));
        vault = factory.createVault(_config(), 0);
        token = new MockToken();

        vm.deal(address(vault), 10 ether);
        token.mint(address(vault), 1_000e18);
    }

    function _config() internal view returns (HeirloomVault.Config memory cfg) {
        cfg.owner = owner;
        cfg.executor = executor;
        cfg.guardians = guardians;
        cfg.requiredSignatures = 3;
        cfg.defaultAllocations = new HeirloomVault.Allocation[](2);
        cfg.defaultAllocations[0] = HeirloomVault.Allocation(heirA, 6_000, 0, 1, 0);
        cfg.defaultAllocations[1] = HeirloomVault.Allocation(heirB, 4_000, 0, 1, 0);
        cfg.inactivityThreshold = INACTIVITY;
        cfg.vetoGracePeriod = VETO;
        cfg.assetMapCID = "ipfs://bafy-asset-map";
    }

    function _goInactive() internal {
        vm.warp(block.timestamp + INACTIVITY + 1);
    }

    function _attest(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            vm.prank(guardians[i]);
            vault.attestGuardian();
        }
    }

    function _toExecuted() internal {
        _goInactive();
        _attest(3);
        vm.warp(block.timestamp + VETO + 1);
        vault.executeRelease();
    }
}
