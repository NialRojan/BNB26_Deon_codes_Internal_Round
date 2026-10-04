export type OwnerStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export type AvailabilityState = "ACTIVE" | "CHECK_IN_PENDING" | "MISSED" | "WATCH";

export type HeartbeatChannel = "WHATSAPP" | "PUSH" | "EMAIL" | "APP_CHECKIN" | string;

export type HeartbeatEventType =
  | "SCHEDULED_PING"
  | "MANUAL_CHECKIN"
  | "APP_FOREGROUND"
  | "RESPONSE_RECEIVED"
  | "MISSED_PING"
  | string;

export type HeartbeatResponseStatus = "RECEIVED" | "PENDING" | "EXPIRED" | "FAILED";

export type RecoveryStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type RiskLevel = "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AttestationStatus = "PENDING" | "SUBMITTED" | "VALID" | "INVALID" | "REVOKED";

export type RiskEventType =
  | "TRIGGER_ANOMALY"
  | "GUARDIAN_COLLUSION"
  | "BEHAVIOR_DEVIATION"
  | "UNEXPECTED_LOCATION"
  | "ACCOUNT_RESET"
  | "DOCUMENT_ANOMALY"
  | string;

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AlertType =
  | "HEARTBEAT_REMINDER"
  | "HEARTBEAT_MISSED"
  | "WATCH_ENTERED"
  | "RECOVERY_INITIATED"
  | "GUARDIAN_ACTION_REQUIRED"
  | "HIGH_RISK_DETECTED"
  | string;

export type AlertChannel = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "IN_APP" | string;

export type AlertStatus = "PENDING" | "SENT" | "FAILED" | "DISMISSED";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AuditEventType =
  | "OWNER_CREATED"
  | "HEARTBEAT_RECEIVED"
  | "HEARTBEAT_MISSED"
  | "OWNER_ENTERED_WATCH"
  | "RECOVERY_INITIATED"
  | "GUARDIAN_ATTESTATION_RECEIVED"
  | "RISK_EVENT_CREATED"
  | "ALERT_SENT"
  | "OWNER_VETO_RECEIVED"
  | "RECOVERY_CANCELLED"
  | string;

export type AuditActorType = "OWNER" | "GUARDIAN" | "SYSTEM" | "ADMIN";

export type AuditEntityType =
  | "Owner"
  | "HeartbeatEvent"
  | "RecoveryAttempt"
  | "GuardianAttestation"
  | "RiskEvent"
  | "Alert"
  | "WebAuthnCredential";

export interface AuthenticatedUser {
  id: string; // The owner ID, guardian ID, or system ID
  role: "owner" | "guardian" | "admin" | "system_worker";
  externalReference?: string;
}
