// Placeholder for Member 1's package. Swap for: import { encryptVault } from '@heirloom/crypto'
// Uses the real Web Crypto API so the secret never leaves the browser as plaintext.
export async function encryptLocal(secret: string) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret))
  return { ciphertextBytes: data.byteLength }
}

// The legal packet is unencrypted by design, so it must never carry credentials.
export const SECRET_WORDS = /(password|passcode|\bpin\b|\botp\b|\bcvv\b)/i
