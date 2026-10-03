import type { EncryptedAsset, KeyShare } from "../types";
import { generateVaultKeyMaterial, vaultKeyFromBytes } from "../encryption/keyDerivation";
import { decryptVaultBlob, encryptVaultBlob } from "../encryption/vaultCipher";
import { combineVaultShares, splitVaultKey } from "../sharding/shamir";

/** Re-encrypt an asset and create a fresh share set; callers replace the old envelope and shares atomically. */
export async function rotateVaultKey(asset: EncryptedAsset, shares: KeyShare[], threshold: number, holderIds: string[]): Promise<{ asset: EncryptedAsset; shares: KeyShare[] }> {
  if (holderIds.length < threshold || new Set(holderIds).size !== holderIds.length) throw new Error("Unique holder IDs must meet the threshold");
  const oldBytes = await combineVaultShares(shares, threshold);
  const newMaterial = await generateVaultKeyMaterial();
  try {
    const oldKey = await vaultKeyFromBytes(oldBytes);
    const plaintext = await decryptVaultBlob(asset, oldKey);
    const rotatedAsset = await encryptVaultBlob(plaintext, newMaterial.key, { assetId: asset.assetId, assetType: asset.assetType });
    const newShares = await splitVaultKey(newMaterial.keyBytes, holderIds.length, threshold);
    return { asset: rotatedAsset, shares: newShares.map((share, index) => ({ ...share, holderId: holderIds[index]! })) };
  } finally {
    oldBytes.fill(0);
    newMaterial.keyBytes.fill(0);
  }
}
