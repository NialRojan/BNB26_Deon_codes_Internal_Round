import type { EncryptedAsset, KeyShare } from "../types";
import { rotateVaultKey } from "./rotateKeys";

/** Revocation requires rotating the vault key and replacing its ciphertext/share set. */
export async function revokeShares(asset: EncryptedAsset, currentShares: KeyShare[], threshold: number, retainedHolderIds: string[]) {
  return rotateVaultKey(asset, currentShares, threshold, retainedHolderIds);
}
