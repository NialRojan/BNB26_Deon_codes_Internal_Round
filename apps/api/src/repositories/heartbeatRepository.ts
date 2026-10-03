import { PrismaClient, HeartbeatEvent } from "@prisma/client";
import { IHeartbeatRepository } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class HeartbeatRepository implements IHeartbeatRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async create(data: {
    ownerId: string;
    channel: string;
    eventType: string;
    timestamp?: Date;
    responseStatus?: string;
    externalEventId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<HeartbeatEvent> {
    return this.db.heartbeatEvent.create({
      data: {
        ownerId: data.ownerId,
        channel: data.channel,
        eventType: data.eventType,
        timestamp: data.timestamp ?? new Date(),
        responseStatus: data.responseStatus ?? "RECEIVED",
        externalEventId: data.externalEventId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async findByExternalEventId(externalEventId: string): Promise<HeartbeatEvent | null> {
    return this.db.heartbeatEvent.findUnique({
      where: { externalEventId },
    });
  }

  async findManyByOwnerId(ownerId: string, limit = 50, offset = 0): Promise<HeartbeatEvent[]> {
    return this.db.heartbeatEvent.findMany({
      where: { ownerId },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async findLatestByOwnerId(ownerId: string): Promise<HeartbeatEvent | null> {
    return this.db.heartbeatEvent.findFirst({
      where: { ownerId },
      orderBy: { timestamp: "desc" },
    });
  }
}
