import { Router } from "express";
import vaultRoutes from "./vault.js";
import guardiansRoutes from "./guardians.js";
import attestationsRoutes from "./attestations.js";
import claimsRoutes from "./claims.js";
import ownerRoutes from "./ownerRoutes.js";
import recoveryRoutes from "./recoveryRoutes.js";
import alertRoutes from "./alertRoutes.js";

const router = Router();

// Health check endpoint
router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "heirloom-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// Member 3 Specified Routes
router.use("/vault", vaultRoutes);
router.use("/guardians", guardiansRoutes);
router.use("/attestations", attestationsRoutes);
router.use("/claims", claimsRoutes);

// Compatibility Mounts (for existing clients & tests)
router.use("/owners", ownerRoutes);
router.use("/recovery", recoveryRoutes);
router.use("/alerts", alertRoutes);

export default router;
