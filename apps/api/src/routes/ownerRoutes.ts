import { Router } from "express";
import { OwnerController } from "../controllers/ownerController.js";
import { HeartbeatController } from "../controllers/heartbeatController.js";
import { RecoveryController } from "../controllers/recoveryController.js";
import { AlertController } from "../controllers/alertController.js";
import { authenticate, requireOwnerAccess } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import {
  CreateOwnerSchema,
  AvailabilityTransitionSchema,
  CreateHeartbeatEventSchema,
  PaginationQuerySchema,
} from "../validation/schemas.js";

const router = Router();

// Public / system registration for new owner
router.post(
  "/",
  authenticate,
  validateRequest(CreateOwnerSchema, "body"),
  OwnerController.createOwner
);

// Get owner profile
router.get(
  "/:ownerId",
  authenticate,
  requireOwnerAccess("ownerId"),
  OwnerController.getOwner
);

// Get owner availability status
router.get(
  "/:ownerId/availability",
  authenticate,
  requireOwnerAccess("ownerId"),
  OwnerController.getAvailability
);

// Transition owner availability (e.g. state escalation or verification)
router.post(
  "/:ownerId/availability/transition",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(AvailabilityTransitionSchema, "body"),
  OwnerController.transitionAvailability
);

// Heartbeat events for owner
router.get(
  "/:ownerId/heartbeat-events",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(PaginationQuerySchema, "query"),
  HeartbeatController.getHeartbeatEvents
);

router.post(
  "/:ownerId/heartbeat-events",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(CreateHeartbeatEventSchema, "body"),
  HeartbeatController.recordHeartbeat
);

// Recovery attempts for owner
router.get(
  "/:ownerId/recovery-attempts",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(PaginationQuerySchema, "query"),
  RecoveryController.getOwnerRecoveries
);

// Audit events for owner
router.get(
  "/:ownerId/audit-events",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(PaginationQuerySchema, "query"),
  OwnerController.getAuditEvents
);

// Alerts for owner
router.get(
  "/:ownerId/alerts",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(PaginationQuerySchema, "query"),
  AlertController.getAlerts
);

export default router;
