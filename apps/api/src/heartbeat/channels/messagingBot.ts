import { db, sanitizeMetadata } from "../../db/schema.js";
import { logger } from "../../config/logger.js";
import { AuditEventType } from "@heirloom/shared";
import { ValidationError } from "../../errors/AppError.js";

export interface MessagingBotPayload {
  ownerId: string;
  recipientHandle: string; // E.g. phone number or telegram ID
  platform: "WHATSAPP" | "TELEGRAM" | "SIGNAL";
  messageText?: string;
  metadata?: Record<string, unknown>;
}

export interface MessagingProviderAdapter {
  dispatchMessage(payload: MessagingBotPayload): Promise<{ success: boolean; externalMessageId: string }>;
  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): Promise<boolean>;
}

/**
 * Local/Mock adapter for WhatsApp and messaging providers.
 * Simulates provider transport without requiring real Meta/Twilio secrets during development.
 */
export class MockMessagingProvider implements MessagingProviderAdapter {
  async dispatchMessage(payload: MessagingBotPayload): Promise<{ success: boolean; externalMessageId: string }> {
    logger.info(`[MockMessagingProvider] Simulated message dispatch via ${payload.platform} to ${payload.recipientHandle}`);
    return {
      success: true,
      externalMessageId: `mock_${payload.platform.toLowerCase()}_${Date.now()}`,
    };
  }

  async verifyWebhook(headers: Record<string, string | undefined>, _rawBody: string): Promise<boolean> {
    if (process.env.NODE_ENV === "production") {
      // Production must verify HMAC signature header (e.g., X-Hub-Signature-256)
      const sig = headers["x-hub-signature-256"] || headers["x-webhook-signature"];
      return !!sig;
    }
    // Dev/Test: allow unless explicitly simulated as invalid
    return headers["x-webhook-signature"] !== "invalid_signature";
  }
}

let activeProvider: MessagingProviderAdapter = new MockMessagingProvider();

export function setMessagingProvider(provider: MessagingProviderAdapter) {
  activeProvider = provider;
}

export class MessagingBotChannel {
  /**
   * Dispatches a check-in ping via messaging bot.
   */
  static async dispatchBotPing(payload: MessagingBotPayload): Promise<{ success: boolean; externalEventId: string }> {
    const externalEventId = `msg_bot_${payload.platform.toLowerCase()}_${payload.ownerId}_${Date.now()}`;

    logger.info(`[MessagingBotChannel] Dispatching ping via ${payload.platform} to ${payload.recipientHandle}`, {
      externalEventId,
    });

    const dispatchResult = await activeProvider.dispatchMessage(payload);
    if (!dispatchResult.success) {
      throw new Error(`Failed to dispatch message via ${payload.platform} transport`);
    }

    await db.heartbeatEvent.create({
      data: {
        ownerId: payload.ownerId,
        channel: payload.platform,
        eventType: "SCHEDULED_PING",
        responseStatus: "PENDING",
        externalEventId,
        metadata: JSON.stringify(sanitizeMetadata({
          platform: payload.platform,
          recipientHandle: payload.recipientHandle,
          externalMessageId: dispatchResult.externalMessageId,
          ...payload.metadata,
        })),
      },
    });

    return { success: true, externalEventId };
  }

  /**
   * Ingests verified webhook callback from messaging bot.
   * Proof of life signal only — never marks death or incapacity.
   */
  static async handleInboundReply(data: {
    ownerId: string;
    platform: "WHATSAPP" | "TELEGRAM" | "SIGNAL";
    externalEventId?: string;
    inboundText?: string;
    metadata?: Record<string, unknown>;
    headers?: Record<string, string | undefined>;
    rawBody?: string;
  }) {
    logger.info(`[MessagingBotChannel] Inbound reply received via ${data.platform} for owner ${data.ownerId}`);

    // Verify webhook signature if headers/body provided
    if (data.headers) {
      const isValid = await activeProvider.verifyWebhook(data.headers, data.rawBody || "");
      if (!isValid) {
        throw new ValidationError("Invalid messaging webhook signature");
      }
    }

    // Deduplication check
    if (data.externalEventId) {
      const existing = await db.heartbeatEvent.findUnique({
        where: { externalEventId: data.externalEventId },
      });
      if (existing) {
        logger.warn(`[MessagingBotChannel] Duplicate inbound bot event ignored: ${data.externalEventId}`);
        return existing;
      }
    }

    const event = await db.heartbeatEvent.create({
      data: {
        ownerId: data.ownerId,
        channel: data.platform,
        eventType: "RESPONSE_RECEIVED",
        responseStatus: "RECEIVED",
        externalEventId: data.externalEventId,
        metadata: JSON.stringify(sanitizeMetadata({
          platform: data.platform,
          inboundText: data.inboundText,
          ...data.metadata,
        })),
      },
    });

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
        stateReason: `Proof-of-life confirmed via ${data.platform} bot reply`,
      },
    });

    // Record audit event
    await db.auditEvent.create({
      data: {
        eventType: AuditEventType.HEARTBEAT_RECEIVED,
        actorId: data.ownerId,
        actorType: "OWNER",
        entityId: event.id,
        entityType: "HeartbeatEvent",
        metadata: JSON.stringify({ platform: data.platform, externalEventId: data.externalEventId }),
      },
    });

    return event;
  }
}
