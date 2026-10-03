import { AuditEvent } from "@prisma/client";
import { IAuditService } from "./interfaces.js";
import { IAuditRepository } from "../repositories/interfaces.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AuditActorType, AuditEntityType, AuditEventType } from "../types/domain.js";
import { logger } from "../config/logger.js";

export class AuditService implements IAuditService {
  constructor(private readonly auditRepo: IAuditRepository = new AuditRepository()) {}

  async recordEvent(data: {
    eventType: AuditEventType;
    actorId: string;
    actorType: AuditActorType;
    entityId: string;
    entityType: AuditEntityType;
    metadata?: Record<string, unknown> | null;
  }): Promise<AuditEvent> {
    const event = await this.auditRepo.create({
      eventType: data.eventType,
      actorId: data.actorId,
      actorType: data.actorType,
      timestamp: new Date(),
      entityId: data.entityId,
      entityType: data.entityType,
      metadata: data.metadata,
    });

    logger.info(`Audit event recorded: ${data.eventType}`, {
      eventId: event.id,
      entityId: data.entityId,
      entityType: data.entityType,
      actorId: data.actorId,
    });

    return event;
  }

  async getAuditEventsByEntity(entityId: string, limit = 100, offset = 0): Promise<AuditEvent[]> {
    return this.auditRepo.findManyByEntityId(entityId, limit, offset);
  }

  async getAuditEventsByOwner(ownerId: string, limit = 100, offset = 0): Promise<AuditEvent[]> {
    return this.auditRepo.findManyByOwnerId(ownerId, limit, offset);
  }
}
