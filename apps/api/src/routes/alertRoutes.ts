import { Router } from "express";
import { AlertController } from "../controllers/alertController.js";
import { authenticate, requireAdminOrSystem } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import { CreateAlertSchema } from "../validation/schemas.js";

const router = Router();

// Create / dispatch new alert (system/admin internal trigger)
router.post(
  "/",
  authenticate,
  requireAdminOrSystem,
  validateRequest(CreateAlertSchema, "body"),
  AlertController.createAlert
);

export default router;
