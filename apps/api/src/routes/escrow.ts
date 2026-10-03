import { Router, type Request, type Response, type NextFunction } from "express";
import { isAddress, verifyMessage, type Hex } from "viem";
import { z } from "zod";
import { escrowMessages } from "@heirloom/shared";
import { prisma } from "../database/prisma.js";
import { ContractClient } from "../chain/contractClient.js";

/**
 * Key escrow for sealed secrets (option B).
 *
 * The server stores ciphertext only. Every write is authorised by a wallet signature and by the
 * HeirloomVault contract: only guardians/heirs of the vault may register keys, only the vault owner
 * may seal secrets, and guardians may release shares (and heirs fetch them) only once
 * isExecuted() == true on-chain.
 */
export type EscrowChain = Pick<ContractClient, "isExecuted" | "isGuardian" | "isBeneficiary" | "ownerOf">;

const addr = z.string().refine(isAddress, "invalid address").transform((a) => a.toLowerCase());
const sig = z.string().regex(/^0x[0-9a-fA-F]+$/);

const KeyBody = z.object({ vaultAddress: addr, address: addr, role: z.enum(["GUARDIAN", "HEIR"]), publicKey: z.string().min(10), signature: sig });
const SealBody = z.object({
  vaultAddress: addr,
  label: z.string().min(1).max(120),
  asset: z.record(z.unknown()),
  threshold: z.number().int().min(2),
  shares: z.array(z.object({ guardian: addr, encryptedShare: z.string().min(10) })).min(2),
  signature: sig,
});
const ReleaseBody = z.object({
  guardian: addr,
  releases: z.array(z.object({ heir: addr, encryptedShare: z.string().min(10) })).min(1),
  signature: sig,
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function signedBy(message: string, signature: string, expected: string) {
  const ok = await verifyMessage({ address: expected as Hex, message, signature: signature as Hex }).catch(() => false);
  if (!ok) throw new HttpError(401, "Signature does not match the claimed wallet");
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch((e) => {
    if (e instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: e.errors[0]?.message } });
    if (e instanceof HttpError) return res.status(e.status).json({ success: false, error: { code: "ESCROW_DENIED", message: e.message } });
    next(e);
  });

export function createEscrowRouter(chain: EscrowChain = new ContractClient()) {
  const router = Router();

  // Register a guardian's or heir's public encryption key (wallet-signed, role checked on-chain).
  router.post("/keys", wrap(async (req, res) => {
    const b = KeyBody.parse(req.body);
    await signedBy(escrowMessages.registerKey(b.vaultAddress, b.role, b.publicKey), b.signature, b.address);
    const allowed = b.role === "GUARDIAN" ? await chain.isGuardian(b.vaultAddress, b.address) : await chain.isBeneficiary(b.vaultAddress, b.address);
    if (!allowed) throw new HttpError(403, `This wallet is not a ${b.role.toLowerCase()} of the vault`);
    const key = await prisma.escrowKey.upsert({
      where: { vaultAddress_address_role: { vaultAddress: b.vaultAddress, address: b.address, role: b.role } },
      create: b,
      update: { publicKey: b.publicKey, signature: b.signature },
    });
    res.status(201).json({ success: true, data: { address: key.address, role: key.role } });
  }));

  router.get("/keys", wrap(async (req, res) => {
    const vault = addr.parse(req.query.vault);
    const keys = await prisma.escrowKey.findMany({ where: { vaultAddress: vault }, select: { address: true, role: true, publicKey: true } });
    res.json({ success: true, data: keys });
  }));

  // Owner seals a secret: ciphertext + one encrypted Shamir share per guardian.
  router.post("/secrets", wrap(async (req, res) => {
    const b = SealBody.parse(req.body);
    const owner = await chain.ownerOf(b.vaultAddress);
    await signedBy(escrowMessages.sealSecret(b.vaultAddress, b.label, b.asset, b.shares), b.signature, owner);
    if (await chain.isExecuted(b.vaultAddress)) throw new HttpError(409, "The vault is already released");
    if (b.threshold > b.shares.length) throw new HttpError(400, "Threshold exceeds number of shares");
    for (const s of b.shares) {
      if (!(await chain.isGuardian(b.vaultAddress, s.guardian))) throw new HttpError(400, `${s.guardian} is not a guardian`);
    }
    const secret = await prisma.sealedSecret.create({
      data: {
        vaultAddress: b.vaultAddress,
        label: b.label,
        asset: JSON.stringify(b.asset),
        threshold: b.threshold,
        shares: { create: b.shares.map((s) => ({ guardian: s.guardian, recipient: s.guardian, kind: "HELD", encryptedShare: s.encryptedShare })) },
      },
    });
    res.status(201).json({ success: true, data: { id: secret.id } });
  }));

  // Sealed secrets for a vault, with each guardian's still-encrypted share.
  router.get("/secrets", wrap(async (req, res) => {
    const vault = addr.parse(req.query.vault);
    const secrets = await prisma.sealedSecret.findMany({
      where: { vaultAddress: vault },
      include: { shares: { where: { kind: "HELD" }, select: { guardian: true, encryptedShare: true } } },
      orderBy: { createdAt: "desc" },
    });
    const released = await prisma.escrowShare.findMany({ where: { secretId: { in: secrets.map((s) => s.id) }, kind: "RELEASED" }, select: { secretId: true, guardian: true } });
    res.json({
      success: true,
      data: secrets.map((s) => ({
        id: s.id,
        label: s.label,
        threshold: s.threshold,
        createdAt: s.createdAt,
        held: s.shares,
        releasedBy: [...new Set(released.filter((r) => r.secretId === s.id).map((r) => r.guardian))],
      })),
    });
  }));

  // A guardian re-encrypts their share to heirs. Only possible after the contract has executed.
  router.post("/secrets/:id/release", wrap(async (req, res) => {
    const b = ReleaseBody.parse(req.body);
    const secret = await prisma.sealedSecret.findUnique({ where: { id: req.params.id } });
    if (!secret) throw new HttpError(404, "Unknown secret");
    if (!(await chain.isExecuted(secret.vaultAddress))) throw new HttpError(403, "The vault has not been released on-chain");
    await signedBy(escrowMessages.releaseShare(secret.id, b.guardian, b.releases), b.signature, b.guardian);
    if (!(await chain.isGuardian(secret.vaultAddress, b.guardian))) throw new HttpError(403, "Not a guardian of this vault");
    for (const r of b.releases) {
      if (!(await chain.isBeneficiary(secret.vaultAddress, r.heir))) throw new HttpError(400, `${r.heir} is not a beneficiary`);
      await prisma.escrowShare.upsert({
        where: { secretId_guardian_recipient_kind: { secretId: secret.id, guardian: b.guardian, recipient: r.heir, kind: "RELEASED" } },
        create: { secretId: secret.id, guardian: b.guardian, recipient: r.heir, kind: "RELEASED", encryptedShare: r.encryptedShare },
        update: { encryptedShare: r.encryptedShare },
      });
    }
    res.status(201).json({ success: true, data: { released: b.releases.length } });
  }));

  // Everything an heir needs to decrypt: ciphertexts + shares released to them. Gated on-chain.
  router.get("/released", wrap(async (req, res) => {
    const vault = addr.parse(req.query.vault);
    const heir = addr.parse(req.query.heir);
    if (!(await chain.isExecuted(vault))) throw new HttpError(403, "The vault has not been released on-chain");
    const secrets = await prisma.sealedSecret.findMany({
      where: { vaultAddress: vault },
      include: { shares: { where: { kind: "RELEASED", recipient: heir }, select: { guardian: true, encryptedShare: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      data: secrets.map((s) => ({ id: s.id, label: s.label, threshold: s.threshold, asset: JSON.parse(s.asset), shares: s.shares })),
    });
  }));

  return router;
}

export default createEscrowRouter();
