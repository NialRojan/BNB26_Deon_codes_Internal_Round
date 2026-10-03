// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title HeirloomAuditAnchor
/// @notice Makes Heirloom's off-chain audit log tamper-evident. The backend periodically commits the
///         Merkle root of a batch of audit records; anyone can later prove a record was part of a batch
///         (and therefore existed, unchanged, at that time) with a Merkle proof.
///
/// Leaves are double-hashed (keccak256(keccak256(record))) and pairs are sorted, matching
/// OpenZeppelin's MerkleProof.
contract HeirloomAuditAnchor {
    struct Batch {
        bytes32 root;
        uint64 firstSeq; // sequence number of the first record in the batch
        uint64 count; // number of records in the batch
        uint64 anchoredAt;
        address anchorer;
    }

    address public admin;
    mapping(address => bool) public isAnchorer;
    Batch[] internal _batches;
    /// @notice Next expected record sequence number; batches must be contiguous and non-overlapping.
    uint64 public nextSeq;

    event Anchored(
        uint256 indexed batchId, bytes32 indexed root, uint64 firstSeq, uint64 count, address indexed anchorer
    );
    event AnchorerUpdated(address indexed anchorer, bool allowed);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    error NotAdmin();
    error NotAnchorer();
    error EmptyBatch();
    error ZeroRoot();
    error NonContiguous(uint64 expectedFirstSeq);
    error UnknownBatch();

    constructor(address admin_, address firstAnchorer) {
        admin = admin_;
        emit AdminTransferred(address(0), admin_);
        if (firstAnchorer != address(0)) {
            isAnchorer[firstAnchorer] = true;
            emit AnchorerUpdated(firstAnchorer, true);
        }
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function setAnchorer(address anchorer, bool allowed) external onlyAdmin {
        isAnchorer[anchorer] = allowed;
        emit AnchorerUpdated(anchorer, allowed);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice Commit the Merkle root of audit records [firstSeq, firstSeq + count).
    function anchor(bytes32 root, uint64 firstSeq, uint64 count) external returns (uint256 batchId) {
        if (!isAnchorer[msg.sender]) revert NotAnchorer();
        if (root == bytes32(0)) revert ZeroRoot();
        if (count == 0) revert EmptyBatch();
        if (firstSeq != nextSeq) revert NonContiguous(nextSeq);

        batchId = _batches.length;
        _batches.push(Batch(root, firstSeq, count, uint64(block.timestamp), msg.sender));
        nextSeq = firstSeq + count;
        emit Anchored(batchId, root, firstSeq, count, msg.sender);
    }

    /// @notice True if `recordHash` (keccak256 of the canonical record) is in batch `batchId`.
    function verify(uint256 batchId, bytes32 recordHash, bytes32[] calldata proof) external view returns (bool) {
        if (batchId >= _batches.length) revert UnknownBatch();
        bytes32 leaf = keccak256(abi.encodePacked(recordHash));
        return MerkleProof.verifyCalldata(proof, _batches[batchId].root, leaf);
    }

    function batchCount() external view returns (uint256) {
        return _batches.length;
    }

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        if (batchId >= _batches.length) revert UnknownBatch();
        return _batches[batchId];
    }
}
