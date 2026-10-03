/**
 * Audit-log anchoring (HeirloomAuditAnchor.sol). Same construction as OpenZeppelin MerkleProof:
 * leaf = keccak256(recordHash), parent = keccak256(sorted(a, b)), odd node carried up.
 */
import { concat, keccak256, stringToHex, type Hex } from "viem";

export interface AnchorableRecord {
  seq: number;
  id: string;
  eventType: string;
  actorId: string;
  actorType: string;
  entityId: string;
  entityType: string;
  timestamp: string; // ISO-8601
  metadata: string | null;
}

/** Canonical, field-ordered JSON so every party hashes a record identically. */
export function canonicalRecord(r: AnchorableRecord): string {
  return JSON.stringify([r.seq, r.id, r.eventType, r.actorId, r.actorType, r.entityId, r.entityType, r.timestamp, r.metadata]);
}

export const recordHash = (r: AnchorableRecord): Hex => keccak256(stringToHex(canonicalRecord(r)));
export const leafOf = (recordHash: Hex): Hex => keccak256(recordHash);
const hashPair = (a: Hex, b: Hex): Hex => (a.toLowerCase() < b.toLowerCase() ? keccak256(concat([a, b])) : keccak256(concat([b, a])));

/** Build all tree levels from leaves (level 0 = leaves, last = [root]). */
export function buildTree(leaves: Hex[]): Hex[][] {
  if (leaves.length === 0) throw new Error("Cannot build a Merkle tree with no leaves");
  const levels: Hex[][] = [leaves];
  while (levels[levels.length - 1]!.length > 1) {
    const prev = levels[levels.length - 1]!;
    const next: Hex[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(i + 1 < prev.length ? hashPair(prev[i]!, prev[i + 1]!) : prev[i]!);
    levels.push(next);
  }
  return levels;
}

export const merkleRoot = (leaves: Hex[]): Hex => buildTree(leaves).at(-1)![0]!;

/** Sibling path for leaf `index`. */
export function merkleProof(leaves: Hex[], index: number): Hex[] {
  const proof: Hex[] = [];
  const levels = buildTree(leaves);
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l]!;
    const sibling = index ^ 1;
    if (sibling < level.length) proof.push(level[sibling]!);
    index = Math.floor(index / 2);
  }
  return proof;
}

/** Recompute the root from a record hash and its proof (off-chain mirror of the contract's verify). */
export function verifyProof(recordHash: Hex, proof: Hex[], root: Hex): boolean {
  let node = leafOf(recordHash);
  for (const p of proof) node = hashPair(node, p);
  return node.toLowerCase() === root.toLowerCase();
}
