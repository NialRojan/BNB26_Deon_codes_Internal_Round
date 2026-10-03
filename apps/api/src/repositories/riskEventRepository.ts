import { PrismaClient, RiskEvent } from "@prisma/client";
import { IRiskEventRepository } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class RiskEventRepository implements IRiskEventRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async create(data: {
    recoveryAttemptId: string;
    type: string;
    severity: string;
    score: number;
    timestamp?: Date;
    metadata?: Record<string, unknown> | null;
  }): Promise<RiskEvent> {
    return this.db.riskEvent.create({
      data: {
        recoveryAttemptId: data.recoveryAttemptId,
        type: data.type,
        severity: data.severity,
        score: data.score,
        timestamp: data.timestamp ?? new Date(),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async findManyByRecoveryId(recoveryAttemptId: string): Promise<RiskEvent[]> {
    return this.db.riskEvent.findMany({
      where: { recoveryAttemptId },
      orderBy: { timestamp: "desc" },
    });
  }
}
