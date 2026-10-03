import { toArrayBuffer, toBase64url, fromBase64url } from "../encoding";
import type { HeirKeyPair } from "../types";

export async function generateHeirKeyPair(): Promise<HeirKeyPair> {
  return crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
}
export async function encryptForHeir(vaultKey: Uint8Array, publicKey: CryptoKey): Promise<{ algorithm: "RSA-OAEP"; ciphertext: string }> {
  const ciphertext = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, toArrayBuffer(vaultKey));
  return { algorithm: "RSA-OAEP", ciphertext: toBase64url(new Uint8Array(ciphertext)) };
}
export async function decryptForHeir(encrypted: { ciphertext: string }, privateKey: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, toArrayBuffer(fromBase64url(encrypted.ciphertext))));
}
export async function serializePublicKey(publicKey: CryptoKey): Promise<string> {
  return JSON.stringify(await crypto.subtle.exportKey("jwk", publicKey));
}
export async function createHeirKeyPair(): Promise<HeirKeyPair> { return generateHeirKeyPair(); }
export async function heirEncrypt(key: Uint8Array, publicKey: CryptoKey) { return encryptForHeir(key, publicKey); }
export async function heirDecrypt(encrypted: { ciphertext: string }, privateKey: CryptoKey) { return decryptForHeir(encrypted, privateKey); }
