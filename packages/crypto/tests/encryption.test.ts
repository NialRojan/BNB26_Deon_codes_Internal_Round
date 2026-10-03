import { describe, it, expect } from "vitest";
import {
  generateVaultKey,
  generateVaultKeyMaterial,
  vaultKeyFromBytes,
  encryptAsset,
  decryptAsset,
  splitVaultKey,
  combineVaultShares,
  generateHeirKeyPair,
  encryptForHeir,
  decryptForHeir,
  signReleasePolicy,
  verifyReleasePolicy,
  generateOwnerSigningKeyPair,
} from "../src/index";
import type { KeyShare, ReleasePolicy } from "../src/index";

describe("client-side asset encryption", () => {
  it("encrypt -> decrypt -> original data", async () => {
    const vaultKey = await generateVaultKey();
    const plaintext = new TextEncoder().encode("secret document");
    const envelope = await encryptAsset(plaintext, vaultKey);
    expect(envelope.algorithm).toBe("AES-256-GCM");
    expect(envelope.iv).toBeTruthy();
      expect(envelope.ciphertext).toBeTruthy();
      expect(envelope).not.toHaveProperty("vaultKey");
    const recovered = await decryptAsset(envelope, vaultKey);
    expect(new TextDecoder().decode(recovered)).toBe("secret document");
  });

  it("wrong key -> failure", async () => {
    const vaultKey = await generateVaultKey();
    const wrongKey = await generateVaultKey();
    const envelope = await encryptAsset(
      new TextEncoder().encode("secret document"),
      vaultKey,
    );
    await expect(decryptAsset(envelope, wrongKey)).rejects.toThrow();
  });

  it("modified ciphertext -> failure", async () => {
    const vaultKey = await generateVaultKey();
    const envelope = await encryptAsset(
      new TextEncoder().encode("secret document"),
      vaultKey,
    );
    const bad =
      envelope.ciphertext.slice(0, envelope.ciphertext.length - 1) + "A";
    await expect(
      decryptAsset({ ...envelope, ciphertext: bad }, vaultKey),
    ).rejects.toThrow();
  });

  it("modified IV -> failure", async () => {
    const vaultKey = await generateVaultKey();
    const envelope = await encryptAsset(
      new TextEncoder().encode("secret document"),
      vaultKey,
    );
    const bad = envelope.iv.slice(0, envelope.iv.length - 1) + "A";
    await expect(
      decryptAsset({ ...envelope, iv: bad }, vaultKey),
    ).rejects.toThrow();
  });

  it("File input path also round-trips", async () => {
    const vaultKey = await generateVaultKey();
    const txt = new TextEncoder().encode("file content");
    const file = new File([txt], "notes.txt", { type: "text/plain" });
    const envelope = await encryptAsset(file, vaultKey);
    const recovered = await decryptAsset(envelope, vaultKey);
    expect(new TextDecoder().decode(recovered)).toBe("file content");
  });
});

describe("Shamir k-of-n", () => {
  it("3 of 5 reconstructs the original key; 2 of 5 does not", async () => {
    const original = new Uint8Array(32);
    for (let i = 0; i < 32; i++) original[i] = i % 251;
    const shares = await splitVaultKey(original, 5, 3);
    expect(shares).toHaveLength(5);

    const combos: KeyShare[][] = [
      [shares[0], shares[1], shares[2]],
      [shares[0], shares[2], shares[3]],
      [shares[1], shares[3], shares[4]],
      [shares[0], shares[2], shares[4]],
    ];
    for (const combo of combos) {
      const recovered = await combineVaultShares(combo, 3);
      expect(recovered).toEqual(original);
    }

    const two: KeyShare[] = [shares[0], shares[1]];
    await expect(combineVaultShares(two, 3)).rejects.toThrow();
  });
});

describe("full vault recovery milestone", () => {
  it("encrypts, splits 3-of-5, reconstructs from any 3, and decrypts the original", async () => {
    const plaintext = new TextEncoder().encode("member 1 recovery milestone");
    const { key: vaultKey, keyBytes } = await generateVaultKeyMaterial();
    const envelope = await encryptAsset(plaintext, vaultKey);
    const shares = await splitVaultKey(keyBytes, 5, 3);
    keyBytes.fill(0);
    const recoveredBytes = await combineVaultShares([shares[0]!, shares[2]!, shares[4]!], 3);
    const recoveredKey = await vaultKeyFromBytes(recoveredBytes);
    expect(await decryptAsset(envelope, recoveredKey)).toEqual(plaintext);
  });
});

describe("heir key pairs", () => {
  it("encrypt with public key, decrypt with matching private key -> original", async () => {
    const vaultKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const pair = await generateHeirKeyPair();
    const ct = await encryptForHeir(vaultKeyBytes, pair.publicKey);
    const recovered = await decryptForHeir(ct, pair.privateKey);
    expect(recovered).toEqual(vaultKeyBytes);
  });

  it("wrong private key must fail", async () => {
    const vp = await generateHeirKeyPair();
    const wp = await generateHeirKeyPair();
    const vaultKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const ct = await encryptForHeir(vaultKeyBytes, vp.publicKey);
    await expect(decryptForHeir(ct, wp.privateKey)).rejects.toThrow();
  });
});

describe("owner-signed release policy", () => {
  const policy: ReleasePolicy = {
    owner: "owner-alice",
    assetId: "asset-doc-001",
    beneficiary: "heir-bob",
    checkIn: { gracePeriodSeconds: 300 },
    guardianThreshold: 2,
    requiredEvidence: "two-notarized-identity-cards",
    delay: { seconds: 0 },
    beneficiaryTier: "standard",
    assetType: "legal-packet",
  };

  it("valid policy + valid signature -> passes", async () => {
    const pair = await generateOwnerSigningKeyPair();
    const sig = await signReleasePolicy(policy, pair.privateKey);
    const ok = await verifyReleasePolicy(policy, sig, pair.publicKey);
    expect(ok).toBe(true);
  });

  it("modified policy -> fails", async () => {
    const pair = await generateOwnerSigningKeyPair();
    const sig = await signReleasePolicy(policy, pair.privateKey);
    const modified = { ...policy, owner: "owner-evil" };
    const ok = await verifyReleasePolicy(modified, sig, pair.publicKey);
    expect(ok).toBe(false);
  });

  it("modified signature -> fails", async () => {
    const pair = await generateOwnerSigningKeyPair();
    const sig = await signReleasePolicy(policy, pair.privateKey);
    const bad = new Uint8Array(sig).slice(0, sig.byteLength - 1).buffer;
    const ok = await verifyReleasePolicy(policy, bad as ArrayBuffer, pair.publicKey);
    expect(ok).toBe(false);
  });

  it("wrong public key -> fails", async () => {
    const kpA = await generateOwnerSigningKeyPair();
    const kpB = await generateOwnerSigningKeyPair();
    const sig = await signReleasePolicy(policy, kpA.privateKey);
    const ok = await verifyReleasePolicy(policy, sig, kpB.publicKey);
    expect(ok).toBe(false);
  });
});
