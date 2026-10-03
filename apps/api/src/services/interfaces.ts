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
import {
  AvailabilityState,
  HeartbeatChannel,
  HeartbeatEventType,
  RecoveryStatus,
  RiskLevel,
  AttestationStatus,
  RiskEventType,
  RiskSeverity,
  AlertType,
  AlertChannel,
  AlertSeverity,
  AuditEventType,
  AuditActorType,
  AuditEntityType,
} from "../types/domain.js";

export interface IOwnerService {
  createOwner(data: { externalReference: string; status?: string }): Promise<Owner>;
  getOwner(id: string): Promise<Owner>;
  getOwnerByExternalReference(ref: string): Promise<Owner>;
  getAvailability(ownerId: string): Promise<OwnerAvailability>;
  transitionAvailability(
    ownerId: string,
    targetState: AvailabilityState,
    reason?: string,
    actorId?: string
  ): Promise<OwnerAvailability>;
}

export interface IHeartbeatService {
  recordHeartbeat(data: {
    ownerId: string;
    channel: HeartbeatChannel;
    eventType: HeartbeatEventType;
    timestamp?: Date;
    responseStatus?: string;
    externalEventId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<HeartbeatEvent>;
  getHeartbeatEvents(ownerId: string, limit?: number, offset?: number): Promise<HeartbeatEvent[]>;
}

export interface IRecoveryService {
  initiateRecovery(data: {
    ownerId: string;
    reason: string;
    source: string;
    initiatedAt?: Date;
  }): Promise<RecoveryAttempt>;
  getRecovery(id: string): Promise<RecoveryAttempt>;
  getRecoveriesByOwner(ownerId: string, limit?: number, offset?: number): Promise<RecoveryAttempt[]>;
  cancelRecovery(
    recoveryId: string,
    ownerId: string,
    cancelReason: string
  ): Promise<RecoveryAttempt>;
  updateRecoveryStatus(
    recoveryId: string,
    targetStatus: RecoveryStatus,
    reason?: string,
    actorId?: string
  ): Promise<RecoveryAttempt>;
}

export interface IAttestationService {
  submitAttestation(data: {
    recoveryAttemptId: string;
    guardianId: string;
    status?: AttestationStatus;
    signature?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<GuardianAttestation>;
  getAttestations(recoveryAttemptId: string): Promise<GuardianAttestation[]>;
}

export interface IRiskService {
  recordRiskEvent(data: {
    recoveryAttemptId: string;
    type: RiskEventType;
    severity: RiskSeverity;
    score: number;
    timestamp?: Date;
    metadata?: Record<string, unknown> | null;
  }): Promise<RiskEvent>;
  getRiskEvents(recoveryAttemptId: string): Promise<RiskEvent[]>;
  evaluateRecoveryRisk(recoveryAttemptId: string): Promise<{ score: number; level: RiskLevel }>;
}

export interface IAlertService {
  createAlert(data: {
    ownerId: string;
    recoveryAttemptId?: string | null;
    type: AlertType;
    severity: AlertSeverity;
    recipient: string;
    channel: AlertChannel;
    metadata?: Record<string, unknown> | null;
  }): Promise<Alert>;
  getAlertsByOwner(ownerId: string, limit?: number, offset?: number): Promise<Alert[]>;
}

export interface IAuditService {
  recordEvent(data: {
    eventType: AuditEventType;
    actorId: string;
    actorType: AuditActorType;
    entityId: string;
    entityType: AuditEntityType;
    metadata?: Record<string, unknown> | null;
  }): Promise<AuditEvent>;
  getAuditEventsByEntity(entityId: string, limit?: number, offset?: number): Promise<AuditEvent[]>;
  getAuditEventsByOwner(ownerId: string, limit?: number, offset?: number): Promise<AuditEvent[]>;
}
