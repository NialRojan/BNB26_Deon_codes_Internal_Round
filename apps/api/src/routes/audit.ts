import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { proofForRecord } from "../chain/auditAnchor.js";

const router = Router();

// Anchored batches (newest first). Each batch root is on-chain in HeirloomAuditAnchor.
router.get("/anchors", async (_req, res, next) => {
  try {
    const batches = await prisma.auditAnchorBatch.findMany({ orderBy: { id: "desc" }, take: 50 });
    const pending = await prisma.auditEvent.count({ where: { anchorSeq: null } });
    res.json({ success: true, data: { batches, pendingRecords: pending } });
  } catch (e) {
    next(e);
  }
});

// Inclusion proof for one audit record: verify with HeirloomAuditAnchor.verify(batchId, recordHash, proof).
router.get("/proof/:eventId", async (req, res, next) => {
  try {
    const p = await proofForRecord(req.params.eventId);
    if (!p) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Unknown audit record" } });
    res.json({ success: true, data: p });
  } catch (e) {
    next(e);
  }
});

export default router;
