import { RecoveryAttempt } from "@prisma/client";
import { IRecoveryService, IOwnerService, IAuditService } from "./interfaces.js";
import { IRecoveryRepository } from "../repositories/interfaces.js";
import { RecoveryRepository } from "../repositories/recoveryRepository.js";
import { OwnerService } from "./ownerService.js";
import { AuditService } from "./auditService.js";
import { RecoveryStatus, RiskLevel } from "../types/domain.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  StateTransitionError,
  ForbiddenError,
} from "../errors/AppError.js";
import { logger } from "../config/logger.js";

const VALID_RECOVERY_TRANSITIONS: Record<RecoveryStatus, RecoveryStatus[]> = {
  PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["COMPLETED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export class RecoveryService implements IRecoveryService {
  constructor(
    private readonly recoveryRepo: IRecoveryRepository = new RecoveryRepository(),
    private readonly ownerService: IOwnerService = new OwnerService(),
    private readonly auditService: IAuditService = new AuditService()
  ) {}

  async initiateRecovery(data: {
    ownerId: string;
    reason: string;
    source: string;
    initiatedAt?: Date;
  }): Promise<RecoveryAttempt> {
    // 1. Verify owner exists
    await this.ownerService.getOwner(data.ownerId);

    // 2. Validate reason & source
    if (!data.reason || data.reason.trim() === "") {
      throw new ValidationError("Recovery reason is required");
    }
    if (!data.source || data.source.trim() === "") {
      throw new ValidationError("Recovery source is required");
    }

    // 3. Check for existing active recovery attempt for this owner
    const existingActive = await this.recoveryRepo.findActiveByOwnerId(data.ownerId);
    if (existingActive) {
      throw new ConflictError(
        `An active recovery attempt (${existingActive.id}) is already pending for this owner`
      );
    }

    // 4. Create recovery attempt with UNKNOWN risk level initially
    const attempt = await this.recoveryRepo.create({
      ownerId: data.ownerId,
      reason: data.reason,
      source: data.source,
      initiatedAt: data.initiatedAt ?? new Date(),
      riskScore: 0.0,
      riskLevel: "UNKNOWN",
    });

    // 5. Audit event
    await this.auditService.recordEvent({
      eventType: "RECOVERY_INITIATED",
      actorId: data.source,
      actorType: "GUARDIAN",
      entityId: attempt.id,
      entityType: "RecoveryAttempt",
      metadata: {
        ownerId: data.ownerId,
        reason: data.reason,
        source: data.source,
        initialStatus: attempt.status,
      },
    });

    logger.info(`Recovery attempt ${attempt.id} initiated for owner ${data.ownerId}`);
    return attempt;
  }

  async getRecovery(id: string): Promise<RecoveryAttempt> {
    const attempt = await this.recoveryRepo.findById(id);
    if (!attempt) {
      throw new NotFoundError("RecoveryAttempt", id);
    }
    return attempt;
  }

  async getRecoveriesByOwner(
    ownerId: string,
    limit = 50,
    offset = 0
  ): Promise<RecoveryAttempt[]> {
    await this.ownerService.getOwner(ownerId);
    return this.recoveryRepo.findManyByOwnerId(ownerId, limit, offset);
  }

  async cancelRecovery(
    recoveryId: string,
    ownerId: string,
    cancelReason: string
  ): Promise<RecoveryAttempt> {
    const attempt = await this.getRecovery(recoveryId);

    // Only owner of the vault or admin can cancel/veto
    if (attempt.ownerId !== ownerId) {
      throw new ForbiddenError("Only the owner can cancel or veto their recovery attempt");
    }

    if (attempt.status === "CANCELLED" || attempt.status === "COMPLETED") {
      throw new StateTransitionError(
        attempt.status,
        "CANCELLED",
        `Recovery attempt is already ${attempt.status}`
      );
    }

    const cancelled = await this.recoveryRepo.updateStatus(recoveryId, "CANCELLED", {
      cancelledAt: new Date(),
      cancelReason: cancelReason || "Owner invoked veto power",
    });

    // Reset owner availability to ACTIVE since owner has actively checked in/vetoed
    await this.ownerService.transitionAvailability(
      ownerId,
      "ACTIVE",
      "Owner active veto received; availability verified",
      ownerId
    );

    // Record audit events for Veto and Cancellation
    await this.auditService.recordEvent({
      eventType: "OWNER_VETO_RECEIVED",
      actorId: ownerId,
      actorType: "OWNER",
      entityId: recoveryId,
      entityType: "RecoveryAttempt",
      metadata: {
        reason: cancelReason,
        recoveryId,
        cancelledAt: cancelled.cancelledAt,
      },
    });

    await this.auditService.recordEvent({
      eventType: "RECOVERY_CANCELLED",
      actorId: ownerId,
      actorType: "OWNER",
      entityId: recoveryId,
      entityType: "RecoveryAttempt",
      metadata: {
        reason: cancelReason,
        recoveryId,
      },
    });

    logger.info(`Recovery attempt ${recoveryId} cancelled by owner veto`);
    return cancelled;
  }

  async updateRecoveryStatus(
    recoveryId: string,
    targetStatus: RecoveryStatus,
    reason?: string,
    actorId = "SYSTEM"
  ): Promise<RecoveryAttempt> {
    const attempt = await this.getRecovery(recoveryId);
    const currentStatus = attempt.status as RecoveryStatus;

    if (currentStatus === targetStatus) {
      return attempt;
    }

    const allowed = VALID_RECOVERY_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new StateTransitionError(
        currentStatus,
        targetStatus,
        `Cannot transition recovery from ${currentStatus} to ${targetStatus}`
      );
    }

    const updated = await this.recoveryRepo.updateStatus(recoveryId, targetStatus);

    await this.auditService.recordEvent({
      eventType: `RECOVERY_STATUS_UPDATED`,
      actorId,
      actorType: "SYSTEM",
      entityId: recoveryId,
      entityType: "RecoveryAttempt",
      metadata: {
        previousStatus: currentStatus,
        newStatus: targetStatus,
        reason,
      },
    });

    return updated;
  }
}
