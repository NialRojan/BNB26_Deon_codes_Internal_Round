import { Router } from "express";
import { WebAuthnController } from "../controllers/webAuthnController.js";
import { authenticate, requireOwnerAccess } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import {
  VerifyRegistrationSchema,
  VerifyAuthenticationSchema,
} from "../validation/schemas.js";

const router = Router({ mergeParams: true });

// 1. WebAuthn Registration Flow
router.post(
  "/register/options",
  authenticate,
  requireOwnerAccess("ownerId"),
  WebAuthnController.getRegistrationOptions
);

router.post(
  "/register/verify",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(VerifyRegistrationSchema, "body"),
  WebAuthnController.verifyRegistration
);

// 2. WebAuthn Authentication / Biometric Proof-of-Life Flow
router.post(
  "/authenticate/options",
  authenticate,
  requireOwnerAccess("ownerId"),
  WebAuthnController.getAuthenticationOptions
);

router.post(
  "/authenticate/verify",
  authenticate,
  requireOwnerAccess("ownerId"),
  validateRequest(VerifyAuthenticationSchema, "body"),
  WebAuthnController.verifyAuthentication
);

// 3. Credential Registry Management
router.get(
  "/credentials",
  authenticate,
  requireOwnerAccess("ownerId"),
  WebAuthnController.listCredentials
);

router.delete(
  "/credentials/:credentialId",
  authenticate,
  requireOwnerAccess("ownerId"),
  WebAuthnController.deleteCredential
);

export default router;
