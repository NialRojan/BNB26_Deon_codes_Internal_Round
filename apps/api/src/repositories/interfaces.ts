import {
  Owner,
  OwnerAvailability,
  HeartbeatEvent,
  RecoveryAttempt,
  GuardianAttestation,
  RiskEvent,
  Alert,
  AuditEvent,
} from "@prisma/client";

export interface IOwnerRepository {
  findById(id: string): Promise<Owner | null>;
  findByExternalReference(ref: string): Promise<Owner | null>;
  create(data: { externalReference: string; status?: string }): Promise<Owner>;
  updateStatus(id: string, status: string): Promise<Owner>;
  getAvailability(ownerId: string): Promise<OwnerAvailability | null>;
  createAvailability(data: { ownerId: string; state?: string }): Promise<OwnerAvailability>;
  updateAvailability(
    ownerId: string,
    data: Partial<{
      state: string;
      lastHeartbeatAt: Date | null;
      nextCheckInDueAt: Date | null;
      heartbeatIntervalDays: number;
      gracePeriodDays: number;
      missedCount: number;
      stateReason: string | null;
    }>
  ): Promise<OwnerAvailability>;
}

export interface IHeartbeatRepository {
  create(data: {
    ownerId: string;
    channel: string;
    eventType: string;
    timestamp?: Date;
    responseStatus?: string;
    externalEventId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<HeartbeatEvent>;
  findByExternalEventId(externalEventId: string): Promise<HeartbeatEvent | null>;
  findManyByOwnerId(ownerId: string, limit?: number, offset?: number): Promise<HeartbeatEvent[]>;
  findLatestByOwnerId(ownerId: string): Promise<HeartbeatEvent | null>;
}

export interface IRecoveryRepository {
  create(data: {
    ownerId: string;
    reason: string;
    source: string;
    initiatedAt?: Date;
    riskScore?: number;
    riskLevel?: string;
  }): Promise<RecoveryAttempt>;
  findById(id: string): Promise<RecoveryAttempt | null>;
  findManyByOwnerId(ownerId: string, limit?: number, offset?: number): Promise<RecoveryAttempt[]>;
  updateStatus(
    id: string,
    status: string,
    options?: {
      cancelledAt?: Date;
      cancelReason?: string;
      riskScore?: number;
      riskLevel?: string;
    }
  ): Promise<RecoveryAttempt>;
  findActiveByOwnerId(ownerId: string): Promise<RecoveryAttempt | null>;
}

export interface IAttestationRepository {
  create(data: {
    recoveryAttemptId: string;
    guardianId: string;
    status?: string;
    signature?: string | null;
    timestamp?: Date;
    metadata?: Record<string, unknown> | null;
  }): Promise<GuardianAttestation>;
  findByRecoveryAndGuardian(recoveryAttemptId: string, guardianId: string): Promise<GuardianAttestation | null>;
  findManyByRecoveryId(recoveryAttemptId: string): Promise<GuardianAttestation[]>;
  updateStatus(id: string, status: string): Promise<GuardianAttestation>;
}

export interface IRiskEventRepository {
  create(data: {
    recoveryAttemptId: string;
    type: string;
    severity: string;
    score: number;
    timestamp?: Date;
    metadata?: Record<string, unknown> | null;
  }): Promise<RiskEvent>;
  findManyByRecoveryId(recoveryAttemptId: string): Promise<RiskEvent[]>;
}

export interface IAlertRepository {
  create(data: {
    ownerId: string;
    recoveryAttemptId?: string | null;
    type: string;
    severity: string;
    recipient: string;
    channel: string;
    status?: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<Alert>;
  findManyByOwnerId(ownerId: string, limit?: number, offset?: number): Promise<Alert[]>;
  findById(id: string): Promise<Alert | null>;
  updateStatus(id: string, status: string, sentAt?: Date): Promise<Alert>;
}

export interface IAuditRepository {
  /**
   * Append-only event creation.
   */
  create(data: {
    eventType: string;
    actorId: string;
    actorType: string;
    timestamp?: Date;
    entityId: string;
    entityType: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<AuditEvent>;
  findManyByEntityId(entityId: string, limit?: number, offset?: number): Promise<AuditEvent[]>;
  findManyByOwnerId(ownerId: string, limit?: number, offset?: number): Promise<AuditEvent[]>;
}
