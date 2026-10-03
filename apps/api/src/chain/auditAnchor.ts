import { createWalletClient, http, parseEventLogs, type Address, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import type { AuditEvent, PrismaClient } from "@prisma/client";
import {
  heirloomAuditAnchorAbi,
  leafOf,
  merkleProof,
  merkleRoot,
  recordHash,
  verifyProof,
  type AnchorableRecord,
} from "@heirloom/shared";
import { prisma as defaultPrisma } from "../database/prisma.js";
import { logger } from "../config/logger.js";

/** Writes a batch root on-chain and returns the contract's batchId + tx hash. */
export interface AnchorWriter {
  readonly contract: string;
  readonly chainId: number;
  nextSeq(): Promise<number>;
  anchor(root: Hex, firstSeq: number, count: number): Promise<{ batchId: number; txHash: string }>;
}

export function toAnchorable(e: Pick<AuditEvent, "id" | "eventType" | "actorId" | "actorType" | "entityId" | "entityType" | "timestamp" | "metadata">, seq: number): AnchorableRecord {
  return {
    seq,
    id: e.id,
    eventType: e.eventType,
    actorId: e.actorId,
    actorType: e.actorType,
    entityId: e.entityId,
    entityType: e.entityType,
    timestamp: e.timestamp.toISOString(),
    metadata: e.metadata ?? null,
  };
}

/** viem-backed writer for the HeirloomAuditAnchor contract on Sepolia. */
export function createChainAnchorWriter(client: PublicClient, contract: Address, privateKey: Hex, rpcUrl: string): AnchorWriter {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  return {
    contract,
    chainId: sepolia.id,
    async nextSeq() {
      return Number(await client.readContract({ address: contract, abi: heirloomAuditAnchorAbi, functionName: "nextSeq" }));
    },
    async anchor(root, firstSeq, count) {
      const { request } = await client.simulateContract({
        account,
        address: contract,
        abi: heirloomAuditAnchorAbi,
        functionName: "anchor",
        args: [root, BigInt(firstSeq), BigInt(count)],
      });
      const txHash = await wallet.writeContract(request);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error(`Anchor tx ${txHash} reverted`);
      const [ev] = parseEventLogs({ abi: heirloomAuditAnchorAbi, eventName: "Anchored", logs: receipt.logs });
      if (!ev) throw new Error(`Anchor tx ${txHash} emitted no Anchored event`);
      return { batchId: Number(ev.args.batchId), txHash };
    },
  };
}

/**
 * Periodically commits the Merkle root of not-yet-anchored audit records on-chain, so any later
 * edit or deletion of a record in the database becomes detectable.
 */
export class AuditAnchorService {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly writer: AnchorWriter,
    private readonly db: PrismaClient = defaultPrisma,
    private readonly maxBatch = 500
  ) {}

  start(intervalMs: number) {
    logger.info(`[AuditAnchor] Anchoring audit log to ${this.writer.contract} every ${intervalMs}ms`);
    const tick = () => this.anchorPending().catch((e) => logger.error(`[AuditAnchor] ${(e as Error).message}`));
    tick();
    this.timer = setInterval(tick, intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Anchor everything not yet anchored (oldest first). Returns the batch, or null if nothing to do. */
  async anchorPending() {
    if (this.running) return null;
    this.running = true;
    try {
      const pending = await this.db.auditEvent.findMany({
        where: { anchorSeq: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: this.maxBatch,
      });
      if (pending.length === 0) return null;

      const firstSeq = await this.writer.nextSeq();
      const records = pending.map((e, i) => toAnchorable(e, firstSeq + i));
      const root = merkleRoot(records.map((r) => leafOf(recordHash(r))));
      const { batchId, txHash } = await this.writer.anchor(root, firstSeq, records.length);

      await this.db.$transaction([
        this.db.auditAnchorBatch.create({
          data: { id: batchId, root, firstSeq, count: records.length, txHash, contract: this.writer.contract, chainId: this.writer.chainId },
        }),
        ...pending.map((e, i) => this.db.auditEvent.update({ where: { id: e.id }, data: { anchorSeq: firstSeq + i, anchorBatchId: batchId } })),
      ]);
      logger.info(`[AuditAnchor] Batch ${batchId}: ${records.length} records anchored in ${txHash}`);
      return { batchId, root, firstSeq, count: records.length, txHash };
    } finally {
      this.running = false;
    }
  }
}

/** Build the inclusion proof for one audit record and check it against the stored root. */
export async function proofForRecord(eventId: string, db: PrismaClient = defaultPrisma) {
  const event = await db.auditEvent.findUnique({ where: { id: eventId }, include: { anchorBatch: true } });
  if (!event) return null;
  if (event.anchorSeq === null || !event.anchorBatch) return { anchored: false as const, eventId };

  const batch = event.anchorBatch;
  const members = await db.auditEvent.findMany({ where: { anchorBatchId: batch.id }, orderBy: { anchorSeq: "asc" } });
  const records = members.map((m) => toAnchorable(m, m.anchorSeq!));
  const hashes = records.map(recordHash);
  const index = event.anchorSeq - batch.firstSeq;
  const proof = merkleProof(hashes.map(leafOf), index);
  const hash = hashes[index]!;
  return {
    anchored: true as const,
    eventId,
    record: records[index]!,
    recordHash: hash,
    batchId: batch.id,
    root: batch.root,
    proof,
    // false here means the database no longer matches what was anchored, i.e. tampering
    matchesAnchoredRoot: verifyProof(hash, proof, batch.root as Hex),
    txHash: batch.txHash,
    contract: batch.contract,
    chainId: batch.chainId,
  };
}
