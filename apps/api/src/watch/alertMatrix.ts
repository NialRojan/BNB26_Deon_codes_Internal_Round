import { db } from "../db/schema.js";
import { logger } from "../config/logger.js";
import { AuditEventType } from "@heirloom/shared";

export interface WatchAlertDispatchConfig {
  ownerId: string;
  reason: string;
  email?: string;
  phone?: string;
}

export class AlertMatrix {
  /**
   * Dispatches alerts across all available channels (Email, SMS, Messaging, Push).
   * DEDUPLICATION GUARANTEE:
   * Checks whether an unresolved (PENDING) alert already exists for the owner, type,
   * and channel before enqueuing a new alert to prevent notification spam across sweeps.
   */
  static async dispatchWatchAlerts(config: WatchAlertDispatchConfig): Promise<number> {
    logger.info(`[AlertMatrix] Dispatching watch alert matrix for owner ${config.ownerId}`);

    const alertsToCreate: Array<{
      ownerId: string;
      type: string;
      severity: string;
      recipient: string;
      channel: string;
      status: string;
      metadata?: string;
    }> = [];

    // 1. Email Alert
    if (config.email) {
      alertsToCreate.push({
        ownerId: config.ownerId,
        type: "WATCH_ENTERED",
        severity: "WARNING",
        recipient: config.email,
        channel: "EMAIL",
        status: "PENDING",
        metadata: JSON.stringify({ reason: config.reason }),
      });
    }

    // 2. SMS Alert
    if (config.phone) {
      alertsToCreate.push({
        ownerId: config.ownerId,
        type: "WATCH_ENTERED",
        severity: "WARNING",
        recipient: config.phone,
        channel: "SMS",
        status: "PENDING",
        metadata: JSON.stringify({ reason: config.reason }),
      });

      // 3. WhatsApp / Messaging Bot Alert
      alertsToCreate.push({
        ownerId: config.ownerId,
        type: "WATCH_ENTERED",
        severity: "WARNING",
        recipient: config.phone,
        channel: "WHATSAPP",
        status: "PENDING",
        metadata: JSON.stringify({ reason: config.reason }),
      });
    }

    // 4. In-App / Push Alert
    alertsToCreate.push({
      ownerId: config.ownerId,
      type: "WATCH_ENTERED",
      severity: "CRITICAL",
      recipient: config.ownerId,
      channel: "PUSH",
      status: "PENDING",
      metadata: JSON.stringify({ reason: config.reason }),
    });

    let createdCount = 0;

    for (const alertData of alertsToCreate) {
      // Check for an existing unresolved (PENDING) alert for this owner, type, and channel
      const existing = await db.alert.findFirst({
        where: {
          ownerId: alertData.ownerId,
          type: alertData.type,
          channel: alertData.channel,
          status: "PENDING",
        },
      });

      if (existing) {
        logger.info(
          `[AlertMatrix] Suppressing duplicate unresolved ${alertData.channel} alert for owner ${alertData.ownerId}`
        );
        continue;
      }

      const created = await db.alert.create({ data: alertData });
      await db.auditEvent.create({
        data: {
          eventType: AuditEventType.ALERT_SENT,
          actorId: "ALERT_MATRIX",
          actorType: "SYSTEM",
          entityId: created.id,
          entityType: "Alert",
          metadata: JSON.stringify({ channel: alertData.channel, type: alertData.type }),
        },
      });
      createdCount++;
    }

    logger.info(`[AlertMatrix] ${createdCount} new alerts enqueued for owner ${config.ownerId}`);
    return createdCount;
  }
}
