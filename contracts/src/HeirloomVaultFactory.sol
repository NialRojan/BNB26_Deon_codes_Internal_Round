// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {HeirloomVault} from "./HeirloomVault.sol";

/// @title HeirloomVaultFactory (v2)
/// @notice Creates HeirloomVaults as EIP-1167 clones of one implementation (~10x cheaper than full
///         deployments). The CREATE2 salt commits to the full vault config, so the address a law firm
///         writes into a will can only ever hold a vault with exactly that config. Usable directly or as an
///         ERC-4337 `initCode` factory.
contract HeirloomVaultFactory {
    HeirloomVault public immutable implementation;
    IEntryPoint public immutable entryPoint;

    mapping(address owner => address[]) internal _vaultsOf;
    mapping(address creator => address[]) internal _vaultsCreatedBy;
    mapping(address vault => address) public creatorOf;

    event VaultCreated(address indexed vault, address indexed owner, address indexed creator, uint256 salt);

    constructor(IEntryPoint anEntryPoint) {
        entryPoint = anEntryPoint;
        implementation = new HeirloomVault(anEntryPoint);
    }

    /// @notice Deploy a vault, or return the existing one if this (cfg, salt) was already deployed.
    ///         `msg.sender` is recorded as the creator (e.g. the law firm).
    function createVault(HeirloomVault.Config calldata cfg, uint256 salt) external returns (HeirloomVault vault) {
        bytes32 s = _salt(cfg, salt);
        address predicted = Clones.predictDeterministicAddress(address(implementation), s);
        if (predicted.code.length > 0) return HeirloomVault(payable(predicted));

        vault = HeirloomVault(payable(Clones.cloneDeterministic(address(implementation), s)));
        vault.initialize(cfg);
        _vaultsOf[cfg.owner].push(address(vault));
        _vaultsCreatedBy[msg.sender].push(address(vault));
        creatorOf[address(vault)] = msg.sender;
        emit VaultCreated(address(vault), cfg.owner, msg.sender, salt);
    }

    /// @notice Counterfactual address of the vault for (cfg, salt).
    function getAddress(HeirloomVault.Config calldata cfg, uint256 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(address(implementation), _salt(cfg, salt));
    }

    function getVaultsByOwner(address owner) external view returns (address[] memory) {
        return _vaultsOf[owner];
    }

    function getVaultsByCreator(address creator) external view returns (address[] memory) {
        return _vaultsCreatedBy[creator];
    }

    function _salt(HeirloomVault.Config calldata cfg, uint256 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(cfg, salt));
    }
}
