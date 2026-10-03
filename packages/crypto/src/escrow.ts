/**
 * Guardian key escrow (integration of Member 1 crypto with Member 2's HeirloomVault gate).
 *
 * seal:    owner encrypts a secret with a fresh AES-256-GCM vault key, Shamir-splits the key
 *          (threshold = vault guardian threshold) and RSA-OAEP-encrypts one share to each guardian.
 * release: after HeirloomVault.isExecuted(), a guardian decrypts their share and re-encrypts it to each heir.
 * recover: an heir decrypts >= threshold released shares, rebuilds the vault key and decrypts the secret.
 *
 * No single party (server, guardian, heir) can decrypt before the contract releases the vault
 * and a quorum of guardians acts.
 */
import { generateVaultKeyMaterial, vaultKeyFromBytes } from "./encryption/keyDerivation";
import { encryptAsset, decryptAsset } from "./encryption/vaultCipher";
import { encryptForHeir, decryptForHeir, serializePublicKey } from "./encryption/heirKeys";
import { splitVaultKey, combineVaultShares } from "./sharding/shamir";
import type { EncryptedAsset, KeyShare } from "./types";

const enc = new TextEncoder();
const dec = new TextDecoder();

export { serializePublicKey };

export async function importPublicKey(jwk: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", JSON.parse(jwk), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}

export async function importPrivateKey(jwk: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", JSON.parse(jwk), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  return JSON.stringify(await crypto.subtle.exportKey("jwk", key));
}

/** Encrypt one serialized share to a holder's RSA public key. */
export async function encryptShareFor(share: KeyShare, publicKeyJwk: string): Promise<string> {
  const { ciphertext } = await encryptForHeir(enc.encode(JSON.stringify(share)), await importPublicKey(publicKeyJwk));
  return ciphertext;
}

/** Decrypt a share that was encrypted to us. */
export async function openShare(encryptedShare: string, privateKey: CryptoKey): Promise<KeyShare> {
  return JSON.parse(dec.decode(await decryptForHeir({ ciphertext: encryptedShare }, privateKey))) as KeyShare;
}

export async function sealSecret(
  secret: string,
  guardians: { address: string; publicKey: string }[],
  threshold: number,
): Promise<{ asset: EncryptedAsset; shares: { guardian: string; encryptedShare: string }[] }> {
  if (guardians.length < threshold) throw new Error(`Need at least ${threshold} guardian keys, have ${guardians.length}`);
  const { key, keyBytes } = await generateVaultKeyMaterial();
  const asset = await encryptAsset(enc.encode(secret), key, { assetId: crypto.randomUUID(), assetType: "access-kit" });
  const raw = await splitVaultKey(keyBytes, guardians.length, threshold);
  keyBytes.fill(0);
  const shares = await Promise.all(
    guardians.map(async (g, i) => ({
      guardian: g.address.toLowerCase(),
      encryptedShare: await encryptShareFor({ ...raw[i]!, holderId: g.address.toLowerCase(), holderType: "guardian" }, g.publicKey),
    })),
  );
  return { asset, shares };
}

/** Guardian: decrypt own held share and re-encrypt it to each heir. */
export async function releaseShare(
  heldShare: string,
  guardianPrivateKey: CryptoKey,
  heirs: { address: string; publicKey: string }[],
): Promise<{ heir: string; encryptedShare: string }[]> {
  const share = await openShare(heldShare, guardianPrivateKey);
  return Promise.all(heirs.map(async (h) => ({ heir: h.address.toLowerCase(), encryptedShare: await encryptShareFor(share, h.publicKey) })));
}

/** Heir: rebuild the vault key from released shares and decrypt the secret. */
export async function recoverSecret(asset: EncryptedAsset, releasedShares: string[], heirPrivateKey: CryptoKey, threshold: number): Promise<string> {
  const shares = await Promise.all(releasedShares.map((s) => openShare(s, heirPrivateKey)));
  const keyBytes = await combineVaultShares(shares, threshold);
  const key = await vaultKeyFromBytes(keyBytes);
  keyBytes.fill(0);
  return dec.decode(await decryptAsset(asset, key));
}
