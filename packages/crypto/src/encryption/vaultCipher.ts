import type { EncryptedAsset } from "../types";
import { encryptBytes, decryptBytes } from "./aesGcm";

export async function encryptVaultBlob(data: ArrayBuffer | Uint8Array | File, vaultKey: CryptoKey, metadata: Pick<EncryptedAsset, "assetId" | "assetType"> = { assetId: crypto.randomUUID(), assetType: "legal-packet" }): Promise<EncryptedAsset> {
  const plaintext = data instanceof File ? new Uint8Array(await data.arrayBuffer()) : data instanceof Uint8Array ? data : new Uint8Array(data);
  return { ...await encryptBytes(plaintext, vaultKey), ...metadata, createdAt: new Date().toISOString() };
}

export async function decryptVaultBlob(envelope: EncryptedAsset, vaultKey: CryptoKey): Promise<Uint8Array> {
  return decryptBytes(envelope, vaultKey);
}

export const encryptAsset = encryptVaultBlob;
export const decryptAsset = decryptVaultBlob;
