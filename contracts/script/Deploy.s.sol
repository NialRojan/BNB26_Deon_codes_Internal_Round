// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {HeirloomVault} from "../src/HeirloomVault.sol";
import {HeirloomVaultFactory} from "../src/HeirloomVaultFactory.sol";

/// @notice Deploys the factory (and, optionally, a demo vault with short timers).
///
/// Env:
///   PRIVATE_KEY              deployer key (optional; otherwise use --account/--sender)
///   DEPLOY_DEMO_VAULT        "true" to also deploy a demo vault (default false)
///   DEMO_OWNER               vault owner                         (default: deployer)
///   DEMO_EXECUTOR            executor address                    (default: address(0))
///   DEMO_GUARDIANS           comma-separated guardian addresses
///   DEMO_REQUIRED_SIGS       guardian threshold                  (default 2)
///   DEMO_HEIRS               comma-separated beneficiary addresses
///   DEMO_SHARES              comma-separated bps, summing to 10000
///   DEMO_INACTIVITY_SECONDS  inactivity threshold                (default 120)
///   DEMO_VETO_SECONDS        veto window                         (default 180)
///   DEMO_ASSET_MAP_CID       IPFS CID of the encrypted asset map (default "")
///
/// On a local chain (31337) a fresh EntryPoint is deployed; elsewhere the canonical v0.7 one is used.
/// Writes deployments/<chainId>.json.
contract Deploy is Script {
    address internal constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        // Either PRIVATE_KEY in env, or an encrypted keystore via `--account <name> --sender <address>`.
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer;
        if (pk != 0) {
            deployer = vm.addr(pk);
            vm.startBroadcast(pk);
        } else {
            deployer = msg.sender;
            vm.startBroadcast();
        }

        IEntryPoint ep = block.chainid == 31337 ? IEntryPoint(address(new EntryPoint())) : IEntryPoint(ENTRYPOINT_V07);
        require(address(ep).code.length > 0, "EntryPoint not deployed on this chain");

        HeirloomVaultFactory factory = new HeirloomVaultFactory(ep);
        address demoVault;
        if (vm.envOr("DEPLOY_DEMO_VAULT", false)) {
            demoVault = address(factory.createVault(_demoConfig(deployer), 0));
        }

        vm.stopBroadcast();

        console.log("EntryPoint:", address(ep));
        console.log("HeirloomVaultFactory:", address(factory));
        if (demoVault != address(0)) console.log("Demo HeirloomVault:", demoVault);

        // Update only the keys this run produced, keeping other addresses (audit anchor, older vaults, ...).
        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        if (!vm.exists(path)) vm.writeJson(string.concat('{"chainId":', vm.toString(block.chainid), "}"), path);
        vm.writeJson(vm.toString(address(ep)), path, ".entryPoint");
        vm.writeJson(vm.toString(address(factory)), path, ".factory");
        vm.writeJson(vm.toString(address(factory.implementation())), path, ".vaultImplementation");
        if (demoVault != address(0)) vm.writeJson(vm.toString(demoVault), path, ".demoVault");
    }

    function _demoConfig(address deployer) internal view returns (HeirloomVault.Config memory cfg) {
        cfg.owner = vm.envOr("DEMO_OWNER", deployer);
        cfg.executor = vm.envOr("DEMO_EXECUTOR", address(0));
        cfg.guardians = vm.envAddress("DEMO_GUARDIANS", ",");
        cfg.requiredSignatures = vm.envOr("DEMO_REQUIRED_SIGS", uint256(2));

        address[] memory heirs = vm.envAddress("DEMO_HEIRS", ",");
        uint256[] memory shares = vm.envUint("DEMO_SHARES", ",");
        require(heirs.length == shares.length, "DEMO_HEIRS / DEMO_SHARES length mismatch");
        cfg.defaultAllocations = new HeirloomVault.Allocation[](heirs.length);
        for (uint256 i = 0; i < heirs.length; i++) {
            cfg.defaultAllocations[i] = HeirloomVault.Allocation(heirs[i], uint16(shares[i]), 0, 1, 0);
        }

        cfg.inactivityThreshold = uint64(vm.envOr("DEMO_INACTIVITY_SECONDS", uint256(120)));
        cfg.vetoGracePeriod = uint64(vm.envOr("DEMO_VETO_SECONDS", uint256(180)));
        cfg.assetMapCID = vm.envOr("DEMO_ASSET_MAP_CID", string(""));
    }
}
