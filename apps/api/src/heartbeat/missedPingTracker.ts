import { db } from "../db/schema.js";
import { logger } from "../config/logger.js";
import { AuditEventType } from "@heirloom/shared";

export interface MissedPingEvaluationResult {
  ownerId: string;
  previousMissedCount: number;
  newMissedCount: number;
  shouldEscalateToWatch: boolean;
  reason: string;
}

export class MissedPingTracker {
  private static readonly DEFAULT_MAX_MISSED_PINGS = 3;

  /**
   * Evaluates and records a missed check-in for a given owner.
   */
  static async recordMissedPing(
    ownerId: string,
    maxMissedPings = MissedPingTracker.DEFAULT_MAX_MISSED_PINGS
  ): Promise<MissedPingEvaluationResult> {
    const availability = await db.ownerAvailability.findUnique({
      where: { ownerId },
    });

    if (!availability) {
      throw new Error(`OwnerAvailability record not found for owner: ${ownerId}`);
    }

    if (availability.state === "WATCH" || availability.state === "Watch") {
      return {
        ownerId,
        previousMissedCount: availability.missedCount,
        newMissedCount: availability.missedCount,
        shouldEscalateToWatch: false,
        reason: "Owner is already in WATCH state; monitoring active",
      };
    }

    const previousMissedCount = availability.missedCount;
    const newMissedCount = previousMissedCount + 1;
    const shouldEscalateToWatch = newMissedCount >= maxMissedPings;

    const reason = `Check-in window expired without proof of life. Missed count: ${newMissedCount}/${maxMissedPings}`;

    await db.ownerAvailability.update({
      where: { ownerId },
      data: {
        state: shouldEscalateToWatch ? "WATCH" : "MISSED",
        missedCount: newMissedCount,
        stateReason: reason,
      },
    });

    // Record audit event for missed heartbeat
    await db.auditEvent.create({
      data: {
        eventType: AuditEventType.HEARTBEAT_MISSED,
        actorId: "SYSTEM",
        actorType: "SYSTEM",
        entityId: ownerId,
        entityType: "OwnerAvailability",
        metadata: JSON.stringify({
          previousMissedCount,
          newMissedCount,
          maxMissedPings,
          escalatedToWatch: shouldEscalateToWatch,
        }),
      },
    });

    logger.warn(`[MissedPingTracker] Missed ping recorded for owner ${ownerId}`, {
      newMissedCount,
      shouldEscalateToWatch,
    });

    return {
      ownerId,
      previousMissedCount,
      newMissedCount,
      shouldEscalateToWatch,
      reason,
    };
  }
}
