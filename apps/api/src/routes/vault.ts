import { Router } from "express";
import { OwnerController } from "../controllers/ownerController.js";
import { HeartbeatController } from "../controllers/heartbeatController.js";
import { RecoveryController } from "../controllers/recoveryController.js";
import { authenticate, requireOwnerAccess } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import {
  CreateOwnerSchema,
  AvailabilityTransitionSchema,
  CreateHeartbeatEventSchema,
  CancelRecoverySchema,
  PaginationQuerySchema,
} from "../validation/schemas.js";
import webauthnRoutes from "./webauthnRoutes.js";

const router = Router();

// Mount WebAuthn / Biometric ceremony routes
router.use("/:ownerId/webauthn", webauthnRoutes);

// 1. Vault Setup / Registration
router.post(
  "/",
  authenticate,
  validateRequest(CreateOwnerSchema, "body"),
  OwnerController.createOwner
);

// 2. Vault Status & Profile
router.get(
  "/:ownerId",
  authenticate,
  requireOwnerAccess("ownerId"),
  OwnerController.getOwner
);

// 3. Vault Availability State
router.get(
  "/:ownerId/availability",
  authenticate,
  requireOwnerAccess("ownerId"),
  OwnerController.getAvailability
);

// 4. Availability Transition
router.post(
  "/:ownerId/availability/transition",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(AvailabilityTransitionSchema, "body"),
  OwnerController.transitionAvailability
);

// 5. Ingest Heartbeat (Push, Biometric, Messaging Bot)
router.post(
  "/:ownerId/heartbeat",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(CreateHeartbeatEventSchema, "body"),
  HeartbeatController.recordHeartbeat
);

// 6. Heartbeat History
router.get(
  "/:ownerId/heartbeat",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(PaginationQuerySchema, "query"),
  HeartbeatController.getHeartbeatEvents
);

// 7. Owner Veto ("Cancel Recovery & I Am Safe")
router.post(
  "/:ownerId/veto/:recoveryId",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(CancelRecoverySchema, "body"),
  (req, res, next) => {
    req.params.recoveryId = req.params.recoveryId;
    RecoveryController.cancelRecovery(req, res, next);
  }
);

// 8. Immutable Audit Trail
router.get(
  "/:ownerId/audit-events",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(PaginationQuerySchema, "query"),
  OwnerController.getAuditEvents
);

export default router;
