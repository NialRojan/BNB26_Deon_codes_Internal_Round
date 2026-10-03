import type { Address, PublicClient } from "viem";
import { heirloomVaultAbi } from "@heirloom/shared";
import { logger } from "../config/logger.js";
import { AlertService } from "../services/alertService.js";
import { AuditService } from "../services/auditService.js";
import { OwnerService } from "../services/ownerService.js";
import type { AlertSeverity } from "../types/domain.js";

export interface VaultChainEvent {
  eventName: string;
  args: Record<string, unknown>;
  transactionHash: string | null;
  logIndex: number | null;
  blockNumber: bigint | null;
}

interface Reaction {
  audit: string;
  alert?: { type: string; severity: AlertSeverity; message: (a: Record<string, unknown>) => string };
}

const fmtTime = (s: unknown) => new Date(Number(s) * 1000).toISOString();

/** What the backend does for each HeirloomVault event (Member 2 contract -> Member 3 alerts/audit). */
export const REACTIONS: Record<string, Reaction> = {
  HeartbeatPinged: { audit: "HEARTBEAT_RECEIVED" },
  ActivityRecorded: { audit: "HEARTBEAT_RECEIVED" },
  GuardianAttested: {
    audit: "GUARDIAN_ATTESTATION_RECEIVED",
    alert: {
      type: "GUARDIAN_ACTION_REQUIRED",
      severity: "WARNING",
      message: (a) => `A guardian confirmed your passing (${a.count} so far). If you are safe, check in to cancel.`,
    },
  },
  TriggerPending: {
    audit: "RECOVERY_INITIATED",
    alert: {
      type: "RECOVERY_INITIATED",
      severity: "CRITICAL",
      message: (a) => `URGENT: Guardians reached the threshold. Your vault releases at ${fmtTime(a.vetoEndTime)} unless you log in and VETO.`,
    },
  },
  RecoveryVetoed: {
    audit: "OWNER_VETO_RECEIVED",
    alert: { type: "RECOVERY_CANCELLED", severity: "INFO", message: () => "Recovery cancelled by the owner. The vault is Active again." },
  },
  ReleaseExecuted: {
    audit: "VAULT_FULLY_RELEASED",
    alert: { type: "VAULT_RELEASED", severity: "CRITICAL", message: () => "The vault has been released. Heirs can now claim and decrypt." },
  },
  Claimed: { audit: "STAGE_RELEASED" },
};

/**
 * Polls a HeirloomVault for events and feeds them into the alert + audit services.
 * Polling getLogs (instead of RPC filters) works with any public Sepolia RPC.
 */
export class VaultEventWatcher {
  private timer: NodeJS.Timeout | undefined;
  private nextBlock: bigint | undefined;
  private readonly seen = new Set<string>();

  constructor(
    private readonly client: PublicClient,
    private readonly vaultAddress: Address,
    private readonly opts: { pollMs?: number; fromBlock?: bigint; recipient?: string; channel?: string } = {},
    private readonly alerts = new AlertService(),
    private readonly audit = new AuditService(),
    private readonly owners = new OwnerService()
  ) {}

  start() {
    const pollMs = this.opts.pollMs ?? 12_000;
    logger.info(`[VaultEventWatcher] Watching ${this.vaultAddress} every ${pollMs}ms`);
    const tick = () => this.poll().catch((e) => logger.error(`[VaultEventWatcher] poll failed: ${(e as Error).message}`));
    tick();
    this.timer = setInterval(tick, pollMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async poll() {
    const latest = await this.client.getBlockNumber();
    if (this.nextBlock === undefined) this.nextBlock = this.opts.fromBlock ?? latest;
    if (this.nextBlock > latest) return;

    const logs = await this.client.getContractEvents({
      address: this.vaultAddress,
      abi: heirloomVaultAbi,
      fromBlock: this.nextBlock,
      toBlock: latest,
    });
    for (const log of logs) {
      await this.handle({
        eventName: log.eventName,
        args: (log.args ?? {}) as Record<string, unknown>,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
      });
    }
    this.nextBlock = latest + 1n;
  }

  /** Map one contract event to an audit record and, when relevant, an owner alert. */
  async handle(ev: VaultChainEvent) {
    const reaction = REACTIONS[ev.eventName];
    if (!reaction) return;
    const key = `${ev.transactionHash}:${ev.logIndex}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);

    const owner = await this.ownerForVault();
    const metadata = {
      vault: this.vaultAddress,
      event: ev.eventName,
      txHash: ev.transactionHash,
      blockNumber: ev.blockNumber?.toString(),
      args: Object.fromEntries(Object.entries(ev.args).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])),
    };

    await this.audit.recordEvent({
      eventType: reaction.audit,
      actorId: this.vaultAddress,
      actorType: "SYSTEM",
      entityId: owner.id,
      entityType: "Owner",
      metadata,
    });

    if (reaction.alert) {
      await this.alerts.createAlert({
        ownerId: owner.id,
        type: reaction.alert.type,
        severity: reaction.alert.severity,
        recipient: this.opts.recipient ?? "owner@heirloom.local",
        channel: this.opts.channel ?? "EMAIL",
        metadata: { ...metadata, message: reaction.alert.message(ev.args) },
      });
    }
    logger.info(`[VaultEventWatcher] ${ev.eventName} -> ${reaction.audit}${reaction.alert ? ` + ${reaction.alert.type} alert` : ""}`);
  }

  /** Each vault maps to one backend Owner, keyed by the lowercase vault address. */
  private async ownerForVault() {
    const ref = this.vaultAddress.toLowerCase();
    try {
      return await this.owners.getOwnerByExternalReference(ref);
    } catch {
      return this.owners.createOwner({ externalReference: ref });
    }
  }
}
