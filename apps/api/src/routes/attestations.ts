import { Router } from "express";
import { AttestationController } from "../controllers/attestationController.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import { SubmitAttestationSchema } from "../validation/schemas.js";

const router = Router();

// Submit guardian attestation for a claim
router.post(
  "/:recoveryId",
  authenticate,
  validateRequest(SubmitAttestationSchema, "body"),
  AttestationController.submitAttestation
);

// Retrieve all guardian attestations for a claim
router.get(
  "/:recoveryId",
  authenticate,
  AttestationController.getAttestations
);

export default router;
