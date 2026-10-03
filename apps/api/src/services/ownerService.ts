import { Owner, OwnerAvailability } from "@prisma/client";
import { IOwnerService, IAuditService } from "./interfaces.js";
import { IOwnerRepository } from "../repositories/interfaces.js";
import { OwnerRepository } from "../repositories/ownerRepository.js";
import { AuditService } from "./auditService.js";
import { AvailabilityState } from "../types/domain.js";
import {
  NotFoundError,
  ConflictError,
  StateTransitionError,
  ValidationError,
} from "../errors/AppError.js";
import { logger } from "../config/logger.js";

// Valid availability state transition map
const VALID_TRANSITIONS: Record<AvailabilityState, AvailabilityState[]> = {
  ACTIVE: ["ACTIVE", "CHECK_IN_PENDING"],
  CHECK_IN_PENDING: ["ACTIVE", "MISSED", "CHECK_IN_PENDING"],
  MISSED: ["ACTIVE", "CHECK_IN_PENDING", "WATCH", "MISSED"],
  WATCH: ["ACTIVE", "WATCH"], // Owner can restore ACTIVE through verified proof-of-life / veto
};

export class OwnerService implements IOwnerService {
  constructor(
    private readonly ownerRepo: IOwnerRepository = new OwnerRepository(),
    private readonly auditService: IAuditService = new AuditService()
  ) {}

  async createOwner(data: { externalReference: string; status?: string }): Promise<Owner> {
    if (!data.externalReference || data.externalReference.trim() === "") {
      throw new ValidationError("externalReference is required and cannot be empty");
    }

    const existing = await this.ownerRepo.findByExternalReference(data.externalReference);
    if (existing) {
      throw new ConflictError(
        `Owner with external reference '${data.externalReference}' already exists`
      );
    }

    const owner = await this.ownerRepo.create({
      externalReference: data.externalReference,
      status: data.status ?? "ACTIVE",
    });

    await this.auditService.recordEvent({
      eventType: "OWNER_CREATED",
      actorId: owner.id,
      actorType: "OWNER",
      entityId: owner.id,
      entityType: "Owner",
      metadata: {
        externalReference: owner.externalReference,
        status: owner.status,
      },
    });

    logger.info(`Owner created: ${owner.id}`);
    return owner;
  }

  async getOwner(id: string): Promise<Owner> {
    const owner = await this.ownerRepo.findById(id);
    if (!owner) {
      throw new NotFoundError("Owner", id);
    }
    return owner;
  }

  async getOwnerByExternalReference(ref: string): Promise<Owner> {
    const owner = await this.ownerRepo.findByExternalReference(ref);
    if (!owner) {
      throw new NotFoundError(`Owner with external reference '${ref}'`);
    }
    return owner;
  }

  async getAvailability(ownerId: string): Promise<OwnerAvailability> {
    // Verify owner exists
    await this.getOwner(ownerId);

    const availability = await this.ownerRepo.getAvailability(ownerId);
    if (!availability) {
      // Auto-initialize availability if absent
      return this.ownerRepo.createAvailability({ ownerId, state: "ACTIVE" });
    }
    return availability;
  }

  async transitionAvailability(
    ownerId: string,
    targetState: AvailabilityState,
    reason?: string,
    actorId = "SYSTEM"
  ): Promise<OwnerAvailability> {
    const current = await this.getAvailability(ownerId);
    const currentState = current.state as AvailabilityState;

    if (currentState === targetState) {
      return current; // Idempotent
    }

    const allowedNextStates = VALID_TRANSITIONS[currentState] || [];
    if (!allowedNextStates.includes(targetState)) {
      throw new StateTransitionError(
        currentState,
        targetState,
        `Cannot transition availability directly from ${currentState} to ${targetState}.`
      );
    }

    if (targetState === "WATCH") {
      const { WatchTransition } = await import("../watch/watchTransition.js");
      const watchRecord = await WatchTransition.moveToWatch({
        ownerId,
        reason: reason ?? "Insufficient proof of availability - escalated to WATCH",
        actor: actorId,
      });

      await this.auditService.recordEvent({
        eventType: "OWNER_ENTERED_WATCH",
        actorId,
        actorType: "SYSTEM",
        entityId: ownerId,
        entityType: "Owner",
        metadata: {
          previousState: currentState,
          newState: "WATCH",
          reason: reason ?? "Insufficient proof of availability - escalated to WATCH",
          missedCount: current.missedCount,
          note: "WATCH does NOT mean owner is deceased; monitoring/escalation required.",
        },
      });

      return {
        ...watchRecord,
        state: "WATCH",
      } as OwnerAvailability;
    }

    const updatePayload: Partial<{
      state: string;
      lastHeartbeatAt: Date | null;
      nextCheckInDueAt: Date | null;
      missedCount: number;
      stateReason: string | null;
    }> = {
      state: targetState,
      stateReason: reason ?? `State transitioned to ${targetState}`,
    };

    if (targetState === "ACTIVE") {
      updatePayload.missedCount = 0;
      const intervalDays = current.heartbeatIntervalDays ?? 30;
      updatePayload.nextCheckInDueAt = new Date(Date.now() + intervalDays * 86_400_000);
    } else if (targetState === "MISSED") {
      updatePayload.missedCount = current.missedCount + 1;
    }

    const updated = await this.ownerRepo.updateAvailability(ownerId, updatePayload);

    logger.info(`Owner ${ownerId} availability transitioned: ${currentState} -> ${targetState}`);
    return updated;
  }
}
