import { PrismaClient, AuditEvent } from "@prisma/client";
import { IAuditRepository } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class AuditRepository implements IAuditRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /**
   * Append-only event creation.
   * Modifying or deleting audit events is intentionally unsupported to preserve audit trail integrity.
   */
  async create(data: {
    eventType: string;
    actorId: string;
    actorType: string;
    timestamp?: Date;
    entityId: string;
    entityType: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<AuditEvent> {
    // Sanitize metadata to guarantee vault secrets/passwords are never written to audit logs
    let sanitizedMetadata: Record<string, unknown> | null = null;
    if (data.metadata) {
      sanitizedMetadata = { ...data.metadata };
      const secretKeys = ["secret", "password", "privatekey", "seed", "vault", "plaintext"];
      for (const k of Object.keys(sanitizedMetadata)) {
        if (secretKeys.some((s) => k.toLowerCase().includes(s))) {
          delete sanitizedMetadata[k];
        }
      }
    }

    return this.db.auditEvent.create({
      data: {
        eventType: data.eventType,
        actorId: data.actorId,
        actorType: data.actorType,
        timestamp: data.timestamp ?? new Date(),
        entityId: data.entityId,
        entityType: data.entityType,
        metadata: sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : null,
      },
    });
  }

  async findManyByEntityId(entityId: string, limit = 100, offset = 0): Promise<AuditEvent[]> {
    return this.db.auditEvent.findMany({
      where: { entityId },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async findManyByOwnerId(ownerId: string, limit = 100, offset = 0): Promise<AuditEvent[]> {
    return this.db.auditEvent.findMany({
      where: {
        OR: [
          { entityId: ownerId },
          { actorId: ownerId },
        ],
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });
  }
}
