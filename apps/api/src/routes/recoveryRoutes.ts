import { Router } from "express";
import { RecoveryController } from "../controllers/recoveryController.js";
import { AttestationController } from "../controllers/attestationController.js";
import { RiskController } from "../controllers/riskController.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import {
  InitiateRecoverySchema,
  CancelRecoverySchema,
  SubmitAttestationSchema,
  CreateRiskEventSchema,
} from "../validation/schemas.js";

const router = Router();

// Initiate recovery attempt
router.post(
  "/",
  authenticate,
  validateRequest(InitiateRecoverySchema, "body"),
  RecoveryController.initiateRecovery
);

// Get recovery attempt by ID
router.get(
  "/:recoveryId",
  authenticate,
  RecoveryController.getRecovery
);

// Cancel recovery attempt (Owner Veto)
router.post(
  "/:recoveryId/cancel",
  authenticate,
  validateRequest(CancelRecoverySchema, "body"),
  RecoveryController.cancelRecovery
);

// Attestations for recovery attempt
router.get(
  "/:recoveryId/attestations",
  authenticate,
  AttestationController.getAttestations
);

router.post(
  "/:recoveryId/attestations",
  authenticate,
  validateRequest(SubmitAttestationSchema, "body"),
  AttestationController.submitAttestation
);

// Risk events for recovery attempt
router.get(
  "/:recoveryId/risk-events",
  authenticate,
  RiskController.getRiskEvents
);

router.post(
  "/:recoveryId/risk-events",
  authenticate,
  validateRequest(CreateRiskEventSchema, "body"),
  RiskController.recordRiskEvent
);

// Risk profile calculation placeholder
router.get(
  "/:recoveryId/risk-profile",
  authenticate,
  RiskController.getRiskProfile
);

export default router;
