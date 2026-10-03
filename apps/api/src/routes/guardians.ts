import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { db } from "../db/schema.js";

const router = Router();

// Query guardian pending requests
router.get("/:guardianId/pending-requests", authenticate, async (req, res, next) => {
  try {
    const { guardianId } = req.params;

    // Fetch recovery attempts where this guardian hasn't attested yet
    const pendingRecoveries = await db.recoveryAttempt.findMany({
      where: {
        status: { in: ["PENDING", "UNDER_REVIEW"] },
        attestations: {
          none: { guardianId },
        },
      },
      select: {
        id: true,
        ownerId: true,
        reason: true,
        initiatedAt: true,
        status: true,
        riskLevel: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: pendingRecoveries,
    });
  } catch (err) {
    next(err);
  }
});

// Query guardian attestation history
router.get("/:guardianId/attestations", authenticate, async (req, res, next) => {
  try {
    const { guardianId } = req.params;

    const attestations = await db.guardianAttestation.findMany({
      where: { guardianId },
      orderBy: { timestamp: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: attestations,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
