// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {HeirloomVault} from "./HeirloomVault.sol";

/// @title HeirloomVaultFactory
/// @notice Deterministic (CREATE2) deployer for HeirloomVaults. Usable directly or as an ERC-4337
///         `initCode` factory, so a vault address is known before it is deployed.
contract HeirloomVaultFactory {
    IEntryPoint public immutable entryPoint;

    mapping(address owner => address[]) internal _vaultsOf;

    event VaultCreated(address indexed vault, address indexed owner, uint256 salt);

    constructor(IEntryPoint anEntryPoint) {
        entryPoint = anEntryPoint;
    }

    /// @notice Deploy a vault, or return the existing one if this (cfg, salt) was already deployed.
    function createVault(HeirloomVault.Config calldata cfg, uint256 salt) external returns (HeirloomVault vault) {
        address predicted = getAddress(cfg, salt);
        if (predicted.code.length > 0) return HeirloomVault(payable(predicted));

        vault = new HeirloomVault{salt: bytes32(salt)}(entryPoint, cfg);
        _vaultsOf[cfg.owner].push(address(vault));
        emit VaultCreated(address(vault), cfg.owner, salt);
    }

    /// @notice Counterfactual address of the vault for (cfg, salt).
    function getAddress(HeirloomVault.Config calldata cfg, uint256 salt) public view returns (address) {
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(HeirloomVault).creationCode, abi.encode(entryPoint, cfg)));
        return Create2.computeAddress(bytes32(salt), initCodeHash);
    }

    function getVaultsByOwner(address owner) external view returns (address[] memory) {
        return _vaultsOf[owner];
    }
}
