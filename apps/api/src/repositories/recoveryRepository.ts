import { PrismaClient, RecoveryAttempt } from "@prisma/client";
import { IRecoveryRepository } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class RecoveryRepository implements IRecoveryRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async create(data: {
    ownerId: string;
    reason: string;
    source: string;
    initiatedAt?: Date;
    riskScore?: number;
    riskLevel?: string;
  }): Promise<RecoveryAttempt> {
    return this.db.recoveryAttempt.create({
      data: {
        ownerId: data.ownerId,
        reason: data.reason,
        source: data.source,
        initiatedAt: data.initiatedAt ?? new Date(),
        status: "PENDING",
        riskScore: data.riskScore ?? 0.0,
        riskLevel: data.riskLevel ?? "UNKNOWN",
      },
      include: {
        attestations: true,
        riskEvents: true,
      },
    });
  }

  async findById(id: string): Promise<RecoveryAttempt | null> {
    return this.db.recoveryAttempt.findUnique({
      where: { id },
      include: {
        attestations: true,
        riskEvents: true,
      },
    });
  }

  async findManyByOwnerId(ownerId: string, limit = 50, offset = 0): Promise<RecoveryAttempt[]> {
    return this.db.recoveryAttempt.findMany({
      where: { ownerId },
      orderBy: { initiatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        attestations: true,
        riskEvents: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    options?: {
      cancelledAt?: Date;
      cancelReason?: string;
      riskScore?: number;
      riskLevel?: string;
    }
  ): Promise<RecoveryAttempt> {
    return this.db.recoveryAttempt.update({
      where: { id },
      data: {
        status,
        ...(options?.cancelledAt !== undefined ? { cancelledAt: options.cancelledAt } : {}),
        ...(options?.cancelReason !== undefined ? { cancelReason: options.cancelReason } : {}),
        ...(options?.riskScore !== undefined ? { riskScore: options.riskScore } : {}),
        ...(options?.riskLevel !== undefined ? { riskLevel: options.riskLevel } : {}),
      },
      include: {
        attestations: true,
        riskEvents: true,
      },
    });
  }

  async findActiveByOwnerId(ownerId: string): Promise<RecoveryAttempt | null> {
    return this.db.recoveryAttempt.findFirst({
      where: {
        ownerId,
        status: {
          in: ["PENDING", "UNDER_REVIEW", "APPROVED"],
        },
      },
      orderBy: { initiatedAt: "desc" },
    });
  }
}
