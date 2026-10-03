import { toArrayBuffer } from "../encoding";

export async function generateVaultKey(): Promise<CryptoKey> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  try { return await vaultKeyFromBytes(bytes); } finally { bytes.fill(0); }
}

/** Generate a non-extractable AES key and the client-only bytes needed for Shamir sharing. */
export async function generateVaultKeyMaterial(): Promise<{ key: CryptoKey; keyBytes: Uint8Array }> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await vaultKeyFromBytes(keyBytes);
  return { key, keyBytes };
}

export async function vaultKeyFromBytes(bytes: Uint8Array): Promise<CryptoKey> {
  if (bytes.byteLength !== 32) throw new Error("AES-256 vault keys must be 32 bytes");
  return crypto.subtle.importKey("raw", toArrayBuffer(bytes), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function deriveKeyFromPassword(password: string, salt: Uint8Array, iterations = 310_000): Promise<CryptoKey> {
  if (iterations < 310_000) throw new Error("PBKDF2 iteration count is below the supported minimum");
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
