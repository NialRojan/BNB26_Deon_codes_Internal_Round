import { describe, it, expect } from "vitest";
import { createHeirKeyPair, heirEncrypt, heirDecrypt } from "../src/index";

describe("heir key pairs", () => {
  it("encrypt with public key, decrypt with matching private key -> original", async () => {
    const key = await createHeirKeyPair();
    const vaultKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) vaultKey[i] = i;

    const ct = await heirEncrypt(vaultKey, key.publicKey);
    const recovered = await heirDecrypt(ct, key.privateKey);

    expect(recovered).toEqual(vaultKey);
  });

  it("wrong private key must fail", async () => {
    const keyA = await createHeirKeyPair();
    const keyB = await createHeirKeyPair();
    const vaultKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) vaultKey[i] = i;

    const ct = await heirEncrypt(vaultKey, keyA.publicKey);
    await expect(heirDecrypt(ct, keyB.privateKey)).rejects.toThrow();
  });
});
