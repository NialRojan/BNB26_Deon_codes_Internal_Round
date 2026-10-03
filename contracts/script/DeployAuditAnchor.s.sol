// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HeirloomAuditAnchor} from "../src/HeirloomAuditAnchor.sol";

/// @notice Deploys HeirloomAuditAnchor (admin = deployer) and funds the backend's anchoring wallet.
/// Env: ANCHORER (backend wallet address, required), ANCHORER_FUNDING_WEI (default 0.02 ether).
/// Run with --account/--sender (keystore) like Deploy.s.sol.
contract DeployAuditAnchor is Script {
    function run() external {
        address anchorer = vm.envAddress("ANCHORER");
        uint256 funding = vm.envOr("ANCHORER_FUNDING_WEI", uint256(0.02 ether));

        vm.startBroadcast();
        HeirloomAuditAnchor anchorC = new HeirloomAuditAnchor(msg.sender, anchorer);
        if (funding > 0 && anchorer.balance < funding) payable(anchorer).transfer(funding - anchorer.balance);
        vm.stopBroadcast();

        console.log("HeirloomAuditAnchor:", address(anchorC));
        console.log("admin:", msg.sender);
        console.log("anchorer:", anchorer, "balance:", anchorer.balance);

        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(vm.toString(address(anchorC)), path, ".auditAnchor");
    }
}
