import type { EncryptedAsset } from "../types";
import { decryptVaultBlob, encryptVaultBlob } from "../encryption/vaultCipher";

export type LegalPacketPayload = EncryptedAsset & { assetType: "legal-packet" };
export async function packageLegalPacket(data: ArrayBuffer | Uint8Array | File, key: CryptoKey, assetId = crypto.randomUUID()): Promise<LegalPacketPayload> {
  return encryptVaultBlob(data, key, { assetId, assetType: "legal-packet" }) as Promise<LegalPacketPayload>;
}
export const openLegalPacket = decryptVaultBlob;
