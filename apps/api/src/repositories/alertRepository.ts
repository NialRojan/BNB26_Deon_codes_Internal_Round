import { PrismaClient, Alert } from "@prisma/client";
import { IAlertRepository } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class AlertRepository implements IAlertRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async create(data: {
    ownerId: string;
    recoveryAttemptId?: string | null;
    type: string;
    severity: string;
    recipient: string;
    channel: string;
    status?: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<Alert> {
    return this.db.alert.create({
      data: {
        ownerId: data.ownerId,
        recoveryAttemptId: data.recoveryAttemptId,
        type: data.type,
        severity: data.severity,
        recipient: data.recipient,
        channel: data.channel,
        status: data.status ?? "PENDING",
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async findManyByOwnerId(ownerId: string, limit = 50, offset = 0): Promise<Alert[]> {
    return this.db.alert.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string): Promise<Alert | null> {
    return this.db.alert.findUnique({
      where: { id },
    });
  }

  async updateStatus(id: string, status: string, sentAt?: Date): Promise<Alert> {
    return this.db.alert.update({
      where: { id },
      data: {
        status,
        ...(sentAt ? { sentAt } : {}),
      },
    });
  }
}
