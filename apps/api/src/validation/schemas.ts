import { z } from "zod";

export const CreateOwnerSchema = z.object({
  externalReference: z.string().min(1, "externalReference is required"),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
});

export const AvailabilityTransitionSchema = z.object({
  state: z.enum(["ACTIVE", "CHECK_IN_PENDING", "MISSED", "WATCH"]),
  reason: z.string().optional(),
});

export const CreateHeartbeatEventSchema = z.object({
  channel: z.enum(["WHATSAPP", "PUSH", "EMAIL", "APP_CHECKIN", "CUSTOM"]),
  eventType: z.string().min(1, "eventType is required"),
  timestamp: z.coerce.date().optional(),
  responseStatus: z.enum(["RECEIVED", "PENDING", "EXPIRED", "FAILED"]).optional(),
  externalEventId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const InitiateRecoverySchema = z.object({
  ownerId: z.string().min(1, "ownerId is required"),
  reason: z.string().min(1, "reason is required"),
  source: z.string().min(1, "source is required"),
  initiatedAt: z.coerce.date().optional(),
});

export const CancelRecoverySchema = z.object({
  cancelReason: z.string().min(1, "cancelReason is required"),
});

export const SubmitAttestationSchema = z.object({
  guardianId: z.string().min(1, "guardianId is required"),
  status: z.enum(["PENDING", "SUBMITTED", "VALID", "INVALID", "REVOKED"]).optional(),
  signature: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateRiskEventSchema = z.object({
  type: z.string().min(1, "type is required"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  score: z.number().min(0).max(1),
  timestamp: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateAlertSchema = z.object({
  ownerId: z.string().min(1, "ownerId is required"),
  recoveryAttemptId: z.string().optional(),
  type: z.string().min(1, "type is required"),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  recipient: z.string().min(1, "recipient is required"),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"]),
  metadata: z.record(z.unknown()).optional(),
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
});
