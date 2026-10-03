import { Router } from "express";
import { RecoveryController } from "../controllers/recoveryController.js";
import { RiskController } from "../controllers/riskController.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import {
  InitiateRecoverySchema,
  CancelRecoverySchema,
  CreateRiskEventSchema,
} from "../validation/schemas.js";
import { DocumentIntake } from "../documents/intake.js";
import { ScoringEngine } from "../fraud/scoringEngine.js";

const router = Router();

// 1. Submit / Initiate Recovery Claim
router.post(
  "/",
  authenticate,
  validateRequest(InitiateRecoverySchema, "body"),
  RecoveryController.initiateRecovery
);

// 2. Query Recovery Claim Details
router.get(
  "/:recoveryId",
  authenticate,
  RecoveryController.getRecovery
);

// 3. Cancel Claim / Owner Veto
router.post(
  "/:recoveryId/cancel",
  authenticate,
  validateRequest(CancelRecoverySchema, "body"),
  RecoveryController.cancelRecovery
);

// 4. Ingest Claim Document (Death Certificate / Medical Attestation)
router.post("/:recoveryId/documents", authenticate, async (req, res, next) => {
  try {
    const { recoveryId } = req.params;
    const { documentType, documentHash, rawContent, issuingAuthority, jurisdiction, documentDate, metadata } = req.body;

    const result = await DocumentIntake.submitDocument({
      recoveryClaimId: recoveryId,
      documentType: documentType || "DEATH_CERTIFICATE",
      documentHash,
      rawContent,
      issuingAuthority,
      jurisdiction: jurisdiction || "US",
      documentDate: documentDate || new Date().toISOString(),
      submittedBy: req.user?.id || "CLAIMANT",
      metadata,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 4b. Evaluate Claim Document Consistency
router.post("/:recoveryId/documents/:documentId/verify", authenticate, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { DocumentVerification } = await import("../documents/verification.js");
    const result = await DocumentVerification.evaluateDocument({
      documentId,
      verifierId: req.user?.id || "SYSTEM",
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Evaluate Fraud & Risk Profile
router.post("/:recoveryId/evaluate-risk", authenticate, async (req, res, next) => {
  try {
    const { recoveryId } = req.params;
    // CRITICAL SECURITY FIX: Only non-authoritative client request metadata is accepted.
    // Authoritative check-ins, attestations, security events, and owner interaction timestamps
    // are strictly loaded from verified database records.
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip;
    const countryCode = typeof req.body?.countryCode === "string" ? req.body.countryCode : undefined;
    const baseVetoDays = typeof req.body?.baseVetoDays === "number" ? req.body.baseVetoDays : undefined;

    const profile = await ScoringEngine.evaluateFromDatabase(recoveryId, {
      ipAddress: clientIp,
      countryCode,
      baseVetoDays,
    });

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Query Risk Events & Profile
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

router.get(
  "/:recoveryId/risk-profile",
  authenticate,
  RiskController.getRiskProfile
);

export default router;
