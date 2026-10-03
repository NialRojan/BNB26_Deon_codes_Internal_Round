import { db } from "../db/schema.js";
import { logger } from "../config/logger.js";
import { AlertMatrix } from "./alertMatrix.js";
import { AuditEventType, VaultState } from "@heirloom/shared";

export interface WatchTransitionRequest {
  ownerId: string;
  reason: string;
  actor?: string;
  recipientEmail?: string;
  recipientPhone?: string;
}

export class WatchTransition {
  /**
   * Transitions an owner's vault availability to WATCH state.
   *
   * IMPORTANT DOMAIN RULE:
   * WATCH does NOT mean the owner is deceased or that inheritance is to be released.
   * It indicates that proof-of-life heartbeats are missing, placing the vault under
   * heightened monitoring and initiating the multi-channel alert matrix.
   *
   * IDEMPOTENCY GUARANTEE:
   * If the owner is already in WATCH state, repeated calls return the existing state
   * without creating duplicate audit events, resetting state, or dispatching duplicate alerts.
   */
  static async moveToWatch(req: WatchTransitionRequest) {
    const existing = await db.ownerAvailability.findUnique({
      where: { ownerId: req.ownerId },
    });

    if (existing && (existing.state === "WATCH" || existing.state === VaultState.WATCH)) {
      logger.info(`[WatchTransition] Owner ${req.ownerId} is already in WATCH state. Idempotent return.`);
      return { ...existing, state: VaultState.WATCH };
    }

    logger.warn(`[WatchTransition] Transitioning owner ${req.ownerId} to WATCH state`, {
      reason: req.reason,
    });

    const updated = await db.ownerAvailability.update({
      where: { ownerId: req.ownerId },
      data: {
        state: "WATCH",
        stateReason: req.reason,
      },
    });

    // 1. Record immutable audit event
    await db.auditEvent.create({
      data: {
        eventType: AuditEventType.VAULT_ENTERED_WATCH,
        actorId: req.actor || "WATCH_CONTROLLER",
        actorType: "SYSTEM",
        entityId: req.ownerId,
        entityType: "OwnerAvailability",
        metadata: JSON.stringify({
          state: VaultState.WATCH,
          reason: req.reason,
          rule: "WATCH does NOT mean deceased. Escalated monitoring active.",
        }),
      },
    });

    // 2. Dispatch multi-channel notification barrage via AlertMatrix
    await AlertMatrix.dispatchWatchAlerts({
      ownerId: req.ownerId,
      reason: req.reason,
      email: req.recipientEmail,
      phone: req.recipientPhone,
    });

    return { ...updated, state: VaultState.WATCH };
  }
}
