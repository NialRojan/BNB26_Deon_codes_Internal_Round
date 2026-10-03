import { fromBase64url, toArrayBuffer, toBase64url } from "../encoding";

export type EncryptedBlob = { algorithm: "AES-256-GCM"; iv: string; ciphertext: string };

export async function encryptBytes(plaintext: Uint8Array, key: CryptoKey, additionalData?: Uint8Array): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv), ...(additionalData ? { additionalData: toArrayBuffer(additionalData) } : {}) }, key, toArrayBuffer(plaintext));
  return { algorithm: "AES-256-GCM", iv: toBase64url(iv), ciphertext: toBase64url(new Uint8Array(ciphertext)) };
}

export async function decryptBytes(blob: EncryptedBlob, key: CryptoKey, additionalData?: Uint8Array): Promise<Uint8Array> {
  if (blob.algorithm !== "AES-256-GCM") throw new Error("Unsupported encryption algorithm");
  const iv = fromBase64url(blob.iv);
  if (iv.length !== 12) throw new Error("AES-GCM IV must be 12 bytes");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv), ...(additionalData ? { additionalData: toArrayBuffer(additionalData) } : {}) }, key, toArrayBuffer(fromBase64url(blob.ciphertext)));
  return new Uint8Array(plaintext);
}
