import { combineVaultShares, splitVaultKey } from "./shamir";
import type { KeyShare } from "../types";

/** Re-shares a reconstructed key with fresh randomness and new holder labels. */
export async function refreshShares(shares: KeyShare[], threshold: number, holderIds: string[]): Promise<KeyShare[]> {
  if (holderIds.length < threshold || new Set(holderIds).size !== holderIds.length) throw new Error("Unique holder IDs must meet the threshold");
  const secret = await combineVaultShares(shares, threshold);
  const fresh = await splitVaultKey(secret, holderIds.length, threshold);
  return fresh.map((share, index) => ({ ...share, holderId: holderIds[index]! }));
}
