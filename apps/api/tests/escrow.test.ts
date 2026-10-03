import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { escrowMessages } from "@heirloom/shared";
import { escrow, generateHeirKeyPair, serializePublicKey } from "@heirloom/crypto";
import { createEscrowRouter, type EscrowChain } from "../src/routes/escrow.js";

const VAULT = "0x8085f0ef193b9dd3f7501394bd3d054c045ab575";
const wallet = () => privateKeyToAccount(generatePrivateKey());
const owner = wallet();
const guardians = [wallet(), wallet(), wallet()];
const heir = wallet();
const stranger = wallet();

let executed = false;
const chain: EscrowChain = {
  isExecuted: async () => executed,
  isGuardian: async (_v: string, who: string) => guardians.some((g) => g.address.toLowerCase() === who.toLowerCase()),
  isBeneficiary: async (_v: string, who: string) => who.toLowerCase() === heir.address.toLowerCase(),
  ownerOf: async () => owner.address,
};
const app = express().use(express.json({ limit: "1mb" })).use("/escrow", createEscrowRouter(chain));

async function registerKey(acct: ReturnType<typeof wallet>, role: "GUARDIAN" | "HEIR") {
  const pair = await generateHeirKeyPair();
  const publicKey = await serializePublicKey(pair.publicKey);
  const signature = await acct.signMessage({ message: escrowMessages.registerKey(VAULT, role, publicKey) });
  const res = await request(app).post("/escrow/keys").send({ vaultAddress: VAULT, address: acct.address, role, publicKey, signature });
  return { res, pair, publicKey };
}

describe("Key escrow gated by HeirloomVault.isExecuted()", () => {
  beforeEach(() => {
    executed = false;
  });

  it("seals, refuses release before execution, then lets the heir decrypt with 2 of 3 guardian shares", async () => {
    // 1. Guardians and heir register keys (wallet-signed, role checked on-chain).
    const g = await Promise.all(guardians.map((acct) => registerKey(acct, "GUARDIAN")));
    g.forEach(({ res }) => expect(res.status).toBe(201));
    const h = await registerKey(heir, "HEIR");
    expect(h.res.status).toBe(201);

    // 2. Owner seals a secret in the browser; only ciphertext reaches the server.
    const keys = (await request(app).get(`/escrow/keys?vault=${VAULT}`)).body.data as { address: string; role: string; publicKey: string }[];
    const sealed = await escrow.sealSecret("gmail: hunter2", keys.filter((k) => k.role === "GUARDIAN"), 2);
    const sealSig = await owner.signMessage({ message: escrowMessages.sealSecret(VAULT, "Gmail", sealed.asset, sealed.shares) });
    const sealRes = await request(app).post("/escrow/secrets").send({ vaultAddress: VAULT, label: "Gmail", asset: sealed.asset, threshold: 2, shares: sealed.shares, signature: sealSig });
    expect(sealRes.status).toBe(201);
    expect(JSON.stringify(sealRes.body)).not.toContain("hunter2");
    const secretId = sealRes.body.data.id;

    // 3. Before the contract executes: release and heir download are refused.
    const list = (await request(app).get(`/escrow/secrets?vault=${VAULT}`)).body.data[0];
    const release = async (i: number) => {
      const held = list.held.find((s: { guardian: string }) => s.guardian === guardians[i]!.address.toLowerCase()).encryptedShare;
      const releases = await escrow.releaseShare(held, g[i]!.pair.privateKey, [{ address: heir.address, publicKey: h.publicKey }]);
      const signature = await guardians[i]!.signMessage({ message: escrowMessages.releaseShare(secretId, guardians[i]!.address, releases) });
      return request(app).post(`/escrow/secrets/${secretId}/release`).send({ guardian: guardians[i]!.address, releases, signature });
    };
    expect((await release(0)).status).toBe(403);
    expect((await request(app).get(`/escrow/released?vault=${VAULT}&heir=${heir.address}`)).status).toBe(403);

    // 4. Contract executes; two guardians release.
    executed = true;
    expect((await release(0)).status).toBe(201);
    let got = (await request(app).get(`/escrow/released?vault=${VAULT}&heir=${heir.address}`)).body.data[0];
    expect(got.shares).toHaveLength(1);
    await expect(escrow.recoverSecret(got.asset, got.shares.map((s: { encryptedShare: string }) => s.encryptedShare), h.pair.privateKey, 2)).rejects.toThrow();

    expect((await release(2)).status).toBe(201);
    got = (await request(app).get(`/escrow/released?vault=${VAULT}&heir=${heir.address}`)).body.data[0];
    const plaintext = await escrow.recoverSecret(got.asset, got.shares.map((s: { encryptedShare: string }) => s.encryptedShare), h.pair.privateKey, 2);
    expect(plaintext).toBe("gmail: hunter2");
  });

  it("rejects keys from wallets that are not guardians/heirs, and forged signatures", async () => {
    expect((await registerKey(stranger, "GUARDIAN")).res.status).toBe(403);
    const pair = await generateHeirKeyPair();
    const publicKey = await serializePublicKey(pair.publicKey);
    const forged = await stranger.signMessage({ message: escrowMessages.registerKey(VAULT, "HEIR", publicKey) });
    const res = await request(app).post("/escrow/keys").send({ vaultAddress: VAULT, address: heir.address, role: "HEIR", publicKey, signature: forged });
    expect(res.status).toBe(401);
  });

  it("only the vault owner can seal secrets", async () => {
    const keys = await Promise.all(guardians.map(async (acct) => ({ address: acct.address, publicKey: (await registerKey(acct, "GUARDIAN")).publicKey })));
    const sealed = await escrow.sealSecret("x", keys, 2);
    const sig = await stranger.signMessage({ message: escrowMessages.sealSecret(VAULT, "X", sealed.asset, sealed.shares) });
    const res = await request(app).post("/escrow/secrets").send({ vaultAddress: VAULT, label: "X", asset: sealed.asset, threshold: 2, shares: sealed.shares, signature: sig });
    expect(res.status).toBe(401);
  });
});
