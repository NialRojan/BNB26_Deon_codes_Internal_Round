import { HeartbeatEvent } from "@prisma/client";
import { IHeartbeatService, IOwnerService, IAuditService } from "./interfaces.js";
import { IHeartbeatRepository, IOwnerRepository } from "../repositories/interfaces.js";
import { HeartbeatRepository } from "../repositories/heartbeatRepository.js";
import { OwnerRepository } from "../repositories/ownerRepository.js";
import { OwnerService } from "./ownerService.js";
import { AuditService } from "./auditService.js";
import { HeartbeatChannel, HeartbeatEventType } from "../types/domain.js";
import { ValidationError, ConflictError } from "../errors/AppError.js";
import { logger } from "../config/logger.js";

const VALID_CHANNELS = ["WHATSAPP", "PUSH", "EMAIL", "APP_CHECKIN", "BIOMETRIC", "CUSTOM"];

export class HeartbeatService implements IHeartbeatService {
  constructor(
    private readonly heartbeatRepo: IHeartbeatRepository = new HeartbeatRepository(),
    private readonly ownerRepo: IOwnerRepository = new OwnerRepository(),
    private readonly ownerService: IOwnerService = new OwnerService(),
    private readonly auditService: IAuditService = new AuditService()
  ) {}

  async recordHeartbeat(data: {
    ownerId: string;
    channel: HeartbeatChannel;
    eventType: HeartbeatEventType;
    timestamp?: Date;
    responseStatus?: string;
    externalEventId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<HeartbeatEvent> {
    // 1. Validate owner exists
    await this.ownerService.getOwner(data.ownerId);

    // 2. Validate channel
    if (!data.channel || typeof data.channel !== "string" || data.channel.trim() === "") {
      throw new ValidationError("Heartbeat channel is required");
    }
    const channelUpper = data.channel.toUpperCase();
    if (!VALID_CHANNELS.includes(channelUpper)) {
      throw new ValidationError(
        `Invalid channel '${data.channel}'. Allowed channels: ${VALID_CHANNELS.join(", ")}`
      );
    }

    // 3. Validate eventType
    if (!data.eventType || typeof data.eventType !== "string" || data.eventType.trim() === "") {
      throw new ValidationError("Heartbeat eventType is required");
    }

    // 4. Duplicate event protection (idempotency)
    if (data.externalEventId) {
      const existing = await this.heartbeatRepo.findByExternalEventId(data.externalEventId);
      if (existing) {
        logger.warn(`Duplicate heartbeat event ignored for externalEventId: ${data.externalEventId}`);
        return existing;
      }
    }

    // 5. Create heartbeat event
    const timestamp = data.timestamp ?? new Date();
    const responseStatus = data.responseStatus ?? "RECEIVED";

    const event = await this.heartbeatRepo.create({
      ownerId: data.ownerId,
      channel: channelUpper,
      eventType: data.eventType,
      timestamp,
      responseStatus,
      externalEventId: data.externalEventId,
      metadata: data.metadata,
    });

    // 6. Update Owner Availability if valid proof of life received
    if (responseStatus === "RECEIVED") {
      const currentAvailability = await this.ownerRepo.getAvailability(data.ownerId);
      const intervalDays = currentAvailability?.heartbeatIntervalDays ?? 30;
      const nextCheckInDueAt = new Date(timestamp.getTime() + intervalDays * 86_400_000);

      await this.ownerRepo.updateAvailability(data.ownerId, {
        state: "ACTIVE",
        lastHeartbeatAt: timestamp,
        nextCheckInDueAt,
        missedCount: 0,
        stateReason: `Proof-of-life signal received via ${channelUpper} (${data.eventType})`,
      });
    }

    // 7. Audit log
    await this.auditService.recordEvent({
      eventType: "HEARTBEAT_RECEIVED",
      actorId: data.ownerId,
      actorType: "OWNER",
      entityId: event.id,
      entityType: "HeartbeatEvent",
      metadata: {
        channel: channelUpper,
        eventType: data.eventType,
        responseStatus,
        externalEventId: data.externalEventId,
      },
    });

    logger.info(`Heartbeat recorded for owner ${data.ownerId} via ${channelUpper}`);
    return event;
  }

  async getHeartbeatEvents(ownerId: string, limit = 50, offset = 0): Promise<HeartbeatEvent[]> {
    // Validate owner exists
    await this.ownerService.getOwner(ownerId);
    return this.heartbeatRepo.findManyByOwnerId(ownerId, limit, offset);
  }
}
