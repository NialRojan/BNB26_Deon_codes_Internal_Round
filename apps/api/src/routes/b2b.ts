import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createWalletClient, http, isAddress, verifyMessage, type Address, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { z } from "zod";
import { b2bMessages, deployments, heirloomVaultAbi, heirloomVaultFactoryAbi } from "@heirloom/shared";
import { prisma } from "../database/prisma.js";
import { createChainClient } from "../chain/contractClient.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { config } from "../config/env.js";

/**
 * B2B2C (law-firm) API.
 *
 * - Firms sign in with their wallet (signed message -> short-lived HMAC token). No passwords.
 * - A firm can only register a client vault that the factory records it as having created.
 * - Death-certificate submissions and reviews go to the (on-chain anchored) audit log.
 * - The relayer submits guardians' EIP-712 votes and pays the gas; it cannot forge a vote because the
 *   vault itself verifies the guardian's signature.
 * The contract stays the source of truth for state, votes and balances; rows here are human metadata.
 */

export interface B2BChain {
  creatorOf(vault: Address): Promise<string>;
  ownerOf(vault: Address): Promise<string>;
  isGuardian(vault: Address, who: Address): Promise<boolean>;
  relayAttest(vault: Address, guardian: Address, deadline: bigint, signature: Hex): Promise<string>;
}

export function createB2BChain(client: PublicClient, factory: Address, relayerKey?: Hex, rpcUrl?: string): B2BChain {
  const relayer = relayerKey ? privateKeyToAccount(relayerKey) : null;
  const wallet = relayer ? createWalletClient({ account: relayer, chain: sepolia, transport: http(rpcUrl) }) : null;
  return {
    creatorOf: (vault) => client.readContract({ address: factory, abi: heirloomVaultFactoryAbi, functionName: "creatorOf", args: [vault] }),
    ownerOf: (vault) => client.readContract({ address: vault, abi: heirloomVaultAbi, functionName: "owner" }),
    isGuardian: (vault, who) => client.readContract({ address: vault, abi: heirloomVaultAbi, functionName: "isGuardian", args: [who] }),
    async relayAttest(vault, guardian, deadline, signature) {
      if (!relayer || !wallet) throw new HttpError(503, "Relayer is not configured (set RELAYER_PRIVATE_KEY or ANCHOR_PRIVATE_KEY)");
      // Simulate first: surfaces the vault's own revert reason (bad signature, owner still active, ...)
      const { request } = await client.simulateContract({
        account: relayer,
        address: vault,
        abi: heirloomVaultAbi,
        functionName: "attestGuardianWithSig",
        args: [guardian, deadline, signature],
      });
      const hash = await wallet.writeContract(request);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new HttpError(502, `Relay transaction ${hash} reverted`);
      return hash;
    },
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const addr = z.string().refine(isAddress, "invalid address").transform((a) => a.toLowerCase());
const sig = z.string().regex(/^0x[0-9a-fA-F]+$/);
const audit = new AuditRepository();

// ------------------------------------------------------------------ firm session tokens
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const secret = () => config.AUTH_SECRET;
const signToken = (wallet: string, exp: number) => {
  const body = `${wallet}.${exp}`;
  return `${body}.${createHmac("sha256", secret()).update(body).digest("hex")}`;
};
function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [wallet, exp, mac] = token.split(".");
  if (!wallet || !exp || !mac || Number(exp) < Date.now()) return null;
  const expected = createHmac("sha256", secret()).update(`${wallet}.${exp}`).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? wallet : null;
}

const firmWallet = (req: Request) => {
  const w = readToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
  if (!w) throw new HttpError(401, "Sign in with the law-firm wallet first");
  return w;
};

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch((e) => {
    if (e instanceof z.ZodError) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: e.errors[0]?.message } });
    if (e instanceof HttpError) return res.status(e.status).json({ success: false, error: { code: "B2B_DENIED", message: e.message } });
    const msg = String((e as { shortMessage?: string })?.shortMessage || (e as Error)?.message || e);
    if (/revert|execution reverted|ContractFunctionExecutionError/i.test(msg)) {
      return res.status(400).json({ success: false, error: { code: "CHAIN_REVERT", message: msg } });
    }
    next(e);
  });

type Row = Awaited<ReturnType<typeof prisma.firmClient.findFirst>> & {};
const toDto = (r: NonNullable<Row>, opts: { includeToken?: boolean; includeContacts?: boolean } = {}) => {
  const heirs = JSON.parse(r.heirs) as { name: string; contact?: string; wallet: string; percentage: number; relationship: string }[];
  const guardians = JSON.parse(r.guardians) as { name: string; contact?: string; wallet: string; role: string }[];
  const strip = <T extends { contact?: string }>(x: T) => (opts.includeContacts ? x : { ...x, contact: undefined });
  return {
    id: r.id,
    vaultAddress: r.vaultAddress,
    creationTx: r.creationTx,
    clientName: r.clientName,
    clientEmail: opts.includeContacts ? r.clientEmail : undefined,
    clientWallet: r.clientWallet,
    heirs: heirs.map(strip),
    guardians: guardians.map(strip),
    executorLabel: r.executorLabel,
    assets: JSON.parse(r.assets),
    certificate: {
      status: r.certStatus,
      fileName: r.certFileName,
      hash: r.certHash,
      uploadedBy: r.certUploadedBy,
      uploadedAt: r.certUploadedAt,
      reviewedBy: r.certReviewedBy,
      reviewedAt: r.certReviewedAt,
    },
    onboardingToken: opts.includeToken ? r.onboardingToken : undefined,
    createdAt: r.createdAt,
  };
};

const ClientBody = z.object({
  vaultAddress: addr,
  creationTx: z.string().optional(),
  clientName: z.string().min(1).max(120),
  clientEmail: z.string().max(200).optional(),
  clientWallet: addr,
  heirs: z.array(z.object({ name: z.string(), contact: z.string().optional(), wallet: addr, percentage: z.number(), relationship: z.string() })).min(1),
  guardians: z.array(z.object({ name: z.string(), contact: z.string().optional(), wallet: addr, role: z.string() })).min(1),
  executorLabel: z.string().max(200).optional(),
  assets: z.array(z.record(z.unknown())).max(100).default([]),
});

export function createB2BRouter(chain: B2BChain) {
  const router = Router();

  // ---- firm sign-in: sign b2bMessages.firmLogin(wallet, issuedAt) within 10 minutes
  router.post("/firm/login", wrap(async (req, res) => {
    const b = z.object({ address: addr, issuedAt: z.string(), signature: sig }).parse(req.body);
    const age = Date.now() - Date.parse(b.issuedAt);
    if (!(age >= -60_000 && age < 10 * 60_000)) throw new HttpError(401, "Sign-in message expired; try again");
    const ok = await verifyMessage({ address: b.address as Address, message: b2bMessages.firmLogin(b.address, b.issuedAt), signature: b.signature as Hex }).catch(() => false);
    if (!ok) throw new HttpError(401, "Signature does not match the wallet");
    const firm = await prisma.firm.findUnique({ where: { wallet: b.address } });
    res.json({ success: true, data: { token: signToken(b.address, Date.now() + TOKEN_TTL_MS), firm } });
  }));

  router.post("/firm/register", wrap(async (req, res) => {
    const wallet = firmWallet(req);
    const b = z.object({ name: z.string().min(2).max(120), lawyerName: z.string().min(2).max(120), license: z.string().max(60).optional() }).parse(req.body);
    const firm = await prisma.firm.upsert({ where: { wallet }, create: { wallet, ...b }, update: b });
    await audit.create({ eventType: "FIRM_REGISTERED", actorId: wallet, actorType: "ADMIN", entityId: firm.id, entityType: "Firm", metadata: { name: b.name } });
    res.status(201).json({ success: true, data: firm });
  }));

  router.get("/firm/me", wrap(async (req, res) => {
    const wallet = firmWallet(req);
    res.json({ success: true, data: await prisma.firm.findUnique({ where: { wallet } }) });
  }));

  // ---- client vaults of the signed-in firm
  router.get("/firm/clients", wrap(async (req, res) => {
    const wallet = firmWallet(req);
    const firm = await prisma.firm.findUnique({ where: { wallet } });
    if (!firm) return res.json({ success: true, data: [] });
    const rows = await prisma.firmClient.findMany({ where: { firmId: firm.id }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: rows.map((r) => toDto(r, { includeToken: true, includeContacts: true })) });
  }));

  // Register a vault the firm just created on-chain. The factory must record this firm as its creator.
  router.post("/firm/clients", wrap(async (req, res) => {
    const wallet = firmWallet(req);
    const firm = await prisma.firm.findUnique({ where: { wallet } });
    if (!firm) throw new HttpError(403, "Register the firm first");
    const b = ClientBody.parse(req.body);
    const creator = (await chain.creatorOf(b.vaultAddress as Address)).toLowerCase();
    if (creator !== wallet) throw new HttpError(403, "The factory does not record this firm as the vault's creator");
    const owner = (await chain.ownerOf(b.vaultAddress as Address)).toLowerCase();
    if (owner !== b.clientWallet) throw new HttpError(400, "clientWallet does not match the vault owner on-chain");
    const row = await prisma.firmClient.create({
      data: {
        firmId: firm.id,
        vaultAddress: b.vaultAddress,
        creationTx: b.creationTx,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        clientWallet: b.clientWallet,
        heirs: JSON.stringify(b.heirs),
        guardians: JSON.stringify(b.guardians),
        executorLabel: b.executorLabel,
        assets: JSON.stringify(b.assets),
        onboardingToken: randomBytes(18).toString("base64url"),
      },
    });
    await audit.create({ eventType: "CLIENT_VAULT_REGISTERED", actorId: wallet, actorType: "ADMIN", entityId: row.id, entityType: "FirmClient", metadata: { contract: b.vaultAddress, client: b.clientWallet, creationTx: b.creationTx } });
    res.status(201).json({ success: true, data: toDto(row, { includeToken: true, includeContacts: true }) });
  }));

  // ---- vaults a wallet is involved in (client, guardian or heir). Contacts are never exposed here.
  router.get("/vaults", wrap(async (req, res) => {
    const w = addr.parse(req.query.wallet);
    const rows = await prisma.firmClient.findMany({ orderBy: { createdAt: "desc" } });
    const mine = rows.filter((r) => r.clientWallet === w || r.heirs.toLowerCase().includes(w) || r.guardians.toLowerCase().includes(w));
    res.json({ success: true, data: mine.map((r) => toDto(r)) });
  }));

  router.get("/vaults/:address", wrap(async (req, res) => {
    const row = await prisma.firmClient.findUnique({ where: { vaultAddress: addr.parse(req.params.address) } });
    if (!row) throw new HttpError(404, "Unknown vault");
    res.json({ success: true, data: toDto(row) });
  }));

  // Client onboarding link (token from the firm). Shows the plan; contacts stay private.
  router.get("/onboard/:token", wrap(async (req, res) => {
    const row = await prisma.firmClient.findUnique({ where: { onboardingToken: req.params.token }, include: { firm: true } });
    if (!row) throw new HttpError(404, "This onboarding link is not valid");
    res.json({ success: true, data: { ...toDto(row), firm: { name: row.firm.name, lawyerName: row.firm.lawyerName } } });
  }));

  // Asset register (descriptions only). Signed by the client wallet or the creating firm.
  router.put("/vaults/:address/assets", wrap(async (req, res) => {
    const vault = addr.parse(req.params.address);
    const b = z.object({ signer: addr, assets: z.array(z.record(z.unknown())).max(100), signature: sig }).parse(req.body);
    const row = await prisma.firmClient.findUnique({ where: { vaultAddress: vault }, include: { firm: true } });
    if (!row) throw new HttpError(404, "Unknown vault");
    if (b.signer !== row.clientWallet && b.signer !== row.firm.wallet) throw new HttpError(403, "Only the client or their law firm can edit the asset register");
    const ok = await verifyMessage({ address: b.signer as Address, message: b2bMessages.updateAssets(vault, b.assets), signature: b.signature as Hex }).catch(() => false);
    if (!ok) throw new HttpError(401, "Signature does not match the wallet");
    if (JSON.stringify(b.assets).match(/"(secret|password|seed|plaintext)"\s*:/i)) throw new HttpError(400, "Never put secrets in the asset register; seal them instead");
    await prisma.firmClient.update({ where: { id: row.id }, data: { assets: JSON.stringify(b.assets) } });
    await audit.create({ eventType: "ASSET_REGISTER_UPDATED", actorId: b.signer, actorType: b.signer === row.clientWallet ? "OWNER" : "ADMIN", entityId: row.id, entityType: "FirmClient", metadata: { contract: vault, count: b.assets.length, signature: b.signature } });
    res.json({ success: true, data: { count: b.assets.length } });
  }));

  // ---- death certificate: an heir (or anyone) submits a document fingerprint; the firm reviews it.
  router.post("/vaults/:address/certificate", wrap(async (req, res) => {
    const vault = addr.parse(req.params.address);
    const b = z.object({ fileName: z.string().min(1).max(200), fileHash: z.string().regex(/^0x[0-9a-f]{64}$/i), uploadedBy: z.string().min(1).max(160) }).parse(req.body);
    const row = await prisma.firmClient.findUnique({ where: { vaultAddress: vault } });
    if (!row) throw new HttpError(404, "Unknown vault");
    await prisma.firmClient.update({
      where: { id: row.id },
      data: { certStatus: "Pending", certFileName: b.fileName, certHash: b.fileHash.toLowerCase(), certUploadedBy: b.uploadedBy, certUploadedAt: new Date(), certReviewedBy: null, certReviewedAt: null },
    });
    await audit.create({ eventType: "DEATH_CERTIFICATE_SUBMITTED", actorId: b.uploadedBy, actorType: "SYSTEM", entityId: row.id, entityType: "FirmClient", metadata: { contract: vault, fileName: b.fileName, fileHash: b.fileHash } });
    res.status(201).json({ success: true, data: { status: "Pending" } });
  }));

  router.post("/vaults/:address/certificate/review", wrap(async (req, res) => {
    const wallet = firmWallet(req);
    const vault = addr.parse(req.params.address);
    const b = z.object({ approve: z.boolean() }).parse(req.body);
    const row = await prisma.firmClient.findUnique({ where: { vaultAddress: vault }, include: { firm: true } });
    if (!row) throw new HttpError(404, "Unknown vault");
    if (row.firm.wallet !== wallet) throw new HttpError(403, "Only the client's law firm can review this certificate");
    if (row.certStatus !== "Pending") throw new HttpError(409, "No certificate awaiting review");
    const status = b.approve ? "Verified" : "Rejected";
    await prisma.firmClient.update({ where: { id: row.id }, data: { certStatus: status, certReviewedBy: wallet, certReviewedAt: new Date() } });
    await audit.create({ eventType: b.approve ? "DEATH_CERTIFICATE_VERIFIED" : "DEATH_CERTIFICATE_REJECTED", actorId: wallet, actorType: "ADMIN", entityId: row.id, entityType: "FirmClient", metadata: { contract: vault, fileHash: row.certHash } });
    res.json({ success: true, data: { status } });
  }));

  // ---- gasless guardian vote relay
  router.post("/relay/attest", wrap(async (req, res) => {
    const b = z.object({ vault: addr, guardian: addr, deadline: z.coerce.bigint(), signature: sig }).parse(req.body);
    if (!(await chain.isGuardian(b.vault as Address, b.guardian as Address))) throw new HttpError(403, "Not a guardian of this vault");
    const txHash = await chain.relayAttest(b.vault as Address, b.guardian as Address, b.deadline, b.signature as Hex);
    res.status(201).json({ success: true, data: { txHash } });
  }));

  return router;
}

export default createB2BRouter(
  createB2BChain(
    createChainClient(config.RPC_URL),
    (process.env.FACTORY_ADDRESS || deployments.sepolia.factory) as Address,
    (process.env.RELAYER_PRIVATE_KEY || process.env.ANCHOR_PRIVATE_KEY) as Hex | undefined,
    config.RPC_URL
  )
);
