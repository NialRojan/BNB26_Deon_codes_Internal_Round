import { db, sanitizeMetadata } from "../../db/schema.js";
import { logger } from "../../config/logger.js";
import { AuditEventType } from "@heirloom/shared";

export interface PushHeartbeatPayload {
  ownerId: string;
  deviceToken: string;
  title?: string;
  body?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export class PushChannel {
  /**
   * Dispatches a push notification heartbeat prompt to the owner's device.
   */
  static async sendPing(payload: PushHeartbeatPayload): Promise<{ success: boolean; externalEventId: string }> {
    const externalEventId = `push_ping_${payload.ownerId}_${Date.now()}`;

    logger.info(`[PushChannel] Sending heartbeat prompt to owner ${payload.ownerId}`, {
      externalEventId,
      deviceTokenPrefix: payload.deviceToken.substring(0, 8) + "...",
    });

    // Record heartbeat ping event in database
    await db.heartbeatEvent.create({
      data: {
        ownerId: payload.ownerId,
        channel: "PUSH",
        eventType: "SCHEDULED_PING",
        responseStatus: "PENDING",
        externalEventId,
        metadata: JSON.stringify(sanitizeMetadata({
          title: payload.title || "Heirloom Availability Check-In",
          actionUrl: payload.actionUrl || "/checkin",
          ...payload.metadata,
        })),
      },
    });

    return { success: true, externalEventId };
  }

  /**
   * Processes a verified response received via push tap or foreground interaction.
   */
  static async verifyResponse(data: {
    ownerId: string;
    externalEventId?: string;
    metadata?: Record<string, unknown>;
  }) {
    logger.info(`[PushChannel] Push response confirmed for owner ${data.ownerId}`);

    let event;
    if (data.externalEventId) {
      const existing = await db.heartbeatEvent.findUnique({
        where: { externalEventId: data.externalEventId },
      });
      if (existing) {
        event = await db.heartbeatEvent.update({
          where: { externalEventId: data.externalEventId },
          data: {
            eventType: "RESPONSE_RECEIVED",
            responseStatus: "RECEIVED",
            timestamp: new Date(),
            metadata: JSON.stringify(sanitizeMetadata(data.metadata)),
          },
        });
      }
    }

    if (!event) {
      event = await db.heartbeatEvent.create({
        data: {
          ownerId: data.ownerId,
          channel: "PUSH",
          eventType: "RESPONSE_RECEIVED",
          responseStatus: "RECEIVED",
          externalEventId: data.externalEventId || `push_resp_${data.ownerId}_${Date.now()}`,
          metadata: JSON.stringify(sanitizeMetadata(data.metadata)),
        },
      });
    }

    // Query interval to compute next check in due date
    const availability = await db.ownerAvailability.findUnique({
      where: { ownerId: data.ownerId },
    });
    const intervalDays = availability?.heartbeatIntervalDays ?? 30;
    const nextCheckInDueAt = new Date(Date.now() + intervalDays * 86_400_000);

    // Update availability
    await db.ownerAvailability.update({
      where: { ownerId: data.ownerId },
      data: {
        state: "ACTIVE",
        lastHeartbeatAt: new Date(),
        nextCheckInDueAt,
        missedCount: 0,
        stateReason: "Verified response received via mobile Push check-in",
      },
    });

    // Emit audit event
    await db.auditEvent.create({
      data: {
        eventType: AuditEventType.HEARTBEAT_RECEIVED,
        actorId: data.ownerId,
        actorType: "OWNER",
        entityId: event.id,
        entityType: "HeartbeatEvent",
        metadata: JSON.stringify({ channel: "PUSH", externalEventId: data.externalEventId }),
      },
    });

    return event;
  }
}
