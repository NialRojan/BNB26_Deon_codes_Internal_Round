import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";
import { b2bMessages } from "@heirloom/shared";
import { createB2BRouter, type B2BChain } from "../src/routes/b2b.js";
import { prisma } from "../src/database/prisma.js";

const wallet = () => privateKeyToAccount(generatePrivateKey());
const firm = wallet();
const otherFirm = wallet();
const client = wallet();
const guardian = wallet();
const heir = wallet();
const VAULT = "0x00000000000000000000000000000000000000a1" as Address;

const relayed: string[] = [];
const chain: B2BChain = {
  creatorOf: async () => firm.address,
  ownerOf: async () => client.address,
  isGuardian: async (_v, who) => who.toLowerCase() === guardian.address.toLowerCase(),
  relayAttest: async (vault, g) => {
    relayed.push(`${vault}:${g}`);
    return "0xrelaytx";
  },
};
const app = express().use(express.json()).use("/b2b", createB2BRouter(chain));

async function login(acct = firm) {
  const issuedAt = new Date().toISOString();
  const signature = await acct.signMessage({ message: b2bMessages.firmLogin(acct.address, issuedAt) });
  const res = await request(app).post("/b2b/firm/login").send({ address: acct.address, issuedAt, signature });
  return res.body.data.token as string;
}

const clientBody = {
  vaultAddress: VAULT,
  clientName: "Rahul Sharma",
  clientEmail: "rahul@example.com",
  clientWallet: client.address,
  heirs: [{ name: "Asha", contact: "asha@example.com", wallet: heir.address, percentage: 100, relationship: "Wife" }],
  guardians: [{ name: "Vikram", contact: "+91 98200 44122", wallet: guardian.address, role: "Brother" }],
  executorLabel: "Mehta & Partners",
};

async function setupFirmWithClient() {
  const token = await login();
  await request(app).post("/b2b/firm/register").set("Authorization", `Bearer ${token}`).send({ name: "Mehta & Partners", lawyerName: "Adv. Rohit Mehta" });
  const res = await request(app).post("/b2b/firm/clients").set("Authorization", `Bearer ${token}`).send(clientBody);
  return { token, res };
}

describe("B2B2C law-firm API", () => {
  it("signs a firm in by wallet signature and rejects forged or stale ones", async () => {
    const issuedAt = new Date().toISOString();
    const forged = await otherFirm.signMessage({ message: b2bMessages.firmLogin(firm.address, issuedAt) });
    expect((await request(app).post("/b2b/firm/login").send({ address: firm.address, issuedAt, signature: forged })).status).toBe(401);
    const old = new Date(Date.now() - 3600e3).toISOString();
    const stale = await firm.signMessage({ message: b2bMessages.firmLogin(firm.address, old) });
    expect((await request(app).post("/b2b/firm/login").send({ address: firm.address, issuedAt: old, signature: stale })).status).toBe(401);
    expect(await login()).toMatch(/^0x[0-9a-f]{40}\.\d+\.[0-9a-f]{64}$/);
    expect((await request(app).get("/b2b/firm/clients").set("Authorization", "Bearer 0xabc.9999999999999.deadbeef")).status).toBe(401);
  });

  it("registers a client vault only if the factory says this firm created it", async () => {
    const { token, res } = await setupFirmWithClient();
    expect(res.status).toBe(201);
    expect(res.body.data.onboardingToken).toBeTruthy();

    const list = await request(app).get("/b2b/firm/clients").set("Authorization", `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].clientEmail).toBe("rahul@example.com");

    // A different firm cannot claim the same vault.
    const other = await login(otherFirm);
    await request(app).post("/b2b/firm/register").set("Authorization", `Bearer ${other}`).send({ name: "Other LLP", lawyerName: "Adv. X" });
    const steal = await request(app).post("/b2b/firm/clients").set("Authorization", `Bearer ${other}`).send({ ...clientBody, vaultAddress: "0x00000000000000000000000000000000000000b2" });
    expect(steal.status).toBe(403);
  });

  it("lets guardians/heirs find their vaults and the client open the onboarding link, without contacts leaking", async () => {
    const { res } = await setupFirmWithClient();
    const g = await request(app).get(`/b2b/vaults?wallet=${guardian.address}`);
    expect(g.body.data).toHaveLength(1);
    expect(g.body.data[0].guardians[0].contact).toBeUndefined();
    expect(g.body.data[0].clientEmail).toBeUndefined();
    expect((await request(app).get(`/b2b/vaults?wallet=${otherFirm.address}`)).body.data).toHaveLength(0);

    const onboard = await request(app).get(`/b2b/onboard/${res.body.data.onboardingToken}`);
    expect(onboard.body.data.firm.name).toBe("Mehta & Partners");
    expect((await request(app).get("/b2b/onboard/not-a-token")).status).toBe(404);
  });

  it("asset register: client-signed edits accepted, strangers and secrets refused", async () => {
    await setupFirmWithClient();
    const assets = [{ id: "a1", category: "Crypto", name: "ETH", detail: "Vault balance" }];
    const sig = await client.signMessage({ message: b2bMessages.updateAssets(VAULT, assets) });
    expect((await request(app).put(`/b2b/vaults/${VAULT}/assets`).send({ signer: client.address, assets, signature: sig })).status).toBe(200);

    const strangerSig = await heir.signMessage({ message: b2bMessages.updateAssets(VAULT, assets) });
    expect((await request(app).put(`/b2b/vaults/${VAULT}/assets`).send({ signer: heir.address, assets, signature: strangerSig })).status).toBe(403);

    const leaky = [{ id: "a2", name: "Gmail", password: "hunter2" }];
    const leakySig = await client.signMessage({ message: b2bMessages.updateAssets(VAULT, leaky) });
    expect((await request(app).put(`/b2b/vaults/${VAULT}/assets`).send({ signer: client.address, assets: leaky, signature: leakySig })).status).toBe(400);
  });

  it("death certificate: heir submits, only the client's firm reviews, and both are audited", async () => {
    const { token } = await setupFirmWithClient();
    const hash = `0x${"ab".repeat(32)}`;
    expect((await request(app).post(`/b2b/vaults/${VAULT}/certificate`).send({ fileName: "cert.pdf", fileHash: hash, uploadedBy: "Asha (wife)" })).status).toBe(201);

    const other = await login(otherFirm);
    expect((await request(app).post(`/b2b/vaults/${VAULT}/certificate/review`).set("Authorization", `Bearer ${other}`).send({ approve: true })).status).toBe(403);
    const ok = await request(app).post(`/b2b/vaults/${VAULT}/certificate/review`).set("Authorization", `Bearer ${token}`).send({ approve: true });
    expect(ok.body.data.status).toBe("Verified");
    expect((await request(app).post(`/b2b/vaults/${VAULT}/certificate/review`).set("Authorization", `Bearer ${token}`).send({ approve: true })).status).toBe(409);

    const events = await prisma.auditEvent.findMany({ where: { eventType: { startsWith: "DEATH_CERTIFICATE_" } } });
    expect(events.map((e) => e.eventType).sort()).toEqual(["DEATH_CERTIFICATE_SUBMITTED", "DEATH_CERTIFICATE_VERIFIED"]);
  });

  it("relays a guardian's signed vote, refusing non-guardians", async () => {
    const deadline = String(Math.floor(Date.now() / 1000) + 3600);
    const ok = await request(app).post("/b2b/relay/attest").send({ vault: VAULT, guardian: guardian.address, deadline, signature: "0x1234" });
    expect(ok.status).toBe(201);
    expect(relayed).toContain(`${VAULT.toLowerCase()}:${guardian.address.toLowerCase()}`);
    expect((await request(app).post("/b2b/relay/attest").send({ vault: VAULT, guardian: heir.address, deadline, signature: "0x1234" })).status).toBe(403);
  });
});
