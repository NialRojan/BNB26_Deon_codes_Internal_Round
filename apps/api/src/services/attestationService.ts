import { GuardianAttestation } from "@prisma/client";
import { IAttestationService, IRecoveryService, IAuditService } from "./interfaces.js";
import { IAttestationRepository } from "../repositories/interfaces.js";
import { AttestationRepository } from "../repositories/attestationRepository.js";
import { RecoveryService } from "./recoveryService.js";
import { AuditService } from "./auditService.js";
import { AttestationStatus } from "../types/domain.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  BadRequestError,
} from "../errors/AppError.js";
import { logger } from "../config/logger.js";

const VALID_ATTESTATION_STATUSES: AttestationStatus[] = [
  "PENDING",
  "SUBMITTED",
  "VALID",
  "INVALID",
  "REVOKED",
];

export class AttestationService implements IAttestationService {
  constructor(
    private readonly attestationRepo: IAttestationRepository = new AttestationRepository(),
    private readonly recoveryService: IRecoveryService = new RecoveryService(),
    private readonly auditService: IAuditService = new AuditService()
  ) {}

  async submitAttestation(data: {
    recoveryAttemptId: string;
    guardianId: string;
    status?: AttestationStatus;
    signature?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<GuardianAttestation> {
    if (!data.guardianId || data.guardianId.trim() === "") {
      throw new ValidationError("guardianId is required");
    }

    const status = data.status ?? "SUBMITTED";
    if (!VALID_ATTESTATION_STATUSES.includes(status)) {
      throw new ValidationError(
        `Invalid status '${status}'. Valid statuses: ${VALID_ATTESTATION_STATUSES.join(", ")}`
      );
    }

    // 1. Verify recovery attempt exists and is open for attestations
    const recovery = await this.recoveryService.getRecovery(data.recoveryAttemptId);
    if (recovery.status === "CANCELLED" || recovery.status === "COMPLETED" || recovery.status === "REJECTED") {
      throw new BadRequestError(
        `Cannot submit attestation for recovery attempt with status '${recovery.status}'`
      );
    }

    // 2. Prevent duplicate attestation by the same guardian
    const existing = await this.attestationRepo.findByRecoveryAndGuardian(
      data.recoveryAttemptId,
      data.guardianId
    );
    if (existing) {
      throw new ConflictError(
        `Guardian '${data.guardianId}' has already submitted an attestation for this recovery attempt`
      );
    }

    // 3. Create attestation
    const attestation = await this.attestationRepo.create({
      recoveryAttemptId: data.recoveryAttemptId,
      guardianId: data.guardianId,
      status,
      signature: data.signature,
      timestamp: new Date(),
      metadata: data.metadata,
    });

    // 4. Audit record
    await this.auditService.recordEvent({
      eventType: "GUARDIAN_ATTESTATION_RECEIVED",
      actorId: data.guardianId,
      actorType: "GUARDIAN",
      entityId: attestation.id,
      entityType: "GuardianAttestation",
      metadata: {
        recoveryAttemptId: data.recoveryAttemptId,
        guardianId: data.guardianId,
        status,
        signaturePresent: !!data.signature,
      },
    });

    logger.info(
      `Attestation recorded from guardian ${data.guardianId} on recovery ${data.recoveryAttemptId}`
    );
    return attestation;
  }

  async getAttestations(recoveryAttemptId: string): Promise<GuardianAttestation[]> {
    // Verify recovery attempt exists
    await this.recoveryService.getRecovery(recoveryAttemptId);
    return this.attestationRepo.findManyByRecoveryId(recoveryAttemptId);
  }
}
