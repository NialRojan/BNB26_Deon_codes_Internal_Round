import { PrismaClient, GuardianAttestation } from "@prisma/client";
import { IAttestationRepository } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class AttestationRepository implements IAttestationRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async create(data: {
    recoveryAttemptId: string;
    guardianId: string;
    status?: string;
    signature?: string | null;
    timestamp?: Date;
    metadata?: Record<string, unknown> | null;
  }): Promise<GuardianAttestation> {
    return this.db.guardianAttestation.create({
      data: {
        recoveryAttemptId: data.recoveryAttemptId,
        guardianId: data.guardianId,
        status: data.status ?? "SUBMITTED",
        signature: data.signature,
        timestamp: data.timestamp ?? new Date(),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async findByRecoveryAndGuardian(recoveryAttemptId: string, guardianId: string): Promise<GuardianAttestation | null> {
    return this.db.guardianAttestation.findUnique({
      where: {
        recoveryAttemptId_guardianId: {
          recoveryAttemptId,
          guardianId,
        },
      },
    });
  }

  async findManyByRecoveryId(recoveryAttemptId: string): Promise<GuardianAttestation[]> {
    return this.db.guardianAttestation.findMany({
      where: { recoveryAttemptId },
      orderBy: { timestamp: "asc" },
    });
  }

  async updateStatus(id: string, status: string): Promise<GuardianAttestation> {
    return this.db.guardianAttestation.update({
      where: { id },
      data: { status },
    });
  }
}
