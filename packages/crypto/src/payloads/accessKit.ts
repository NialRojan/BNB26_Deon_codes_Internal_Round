import type { EncryptedAsset } from "../types";
import { decryptVaultBlob, encryptVaultBlob } from "../encryption/vaultCipher";

export type AccessKitPayload = EncryptedAsset & { assetType: "access-kit" };
export async function packageAccessKit(data: ArrayBuffer | Uint8Array | File, key: CryptoKey, assetId = crypto.randomUUID()): Promise<AccessKitPayload> {
  return encryptVaultBlob(data, key, { assetId, assetType: "access-kit" }) as Promise<AccessKitPayload>;
}
export const openAccessKit = decryptVaultBlob;
