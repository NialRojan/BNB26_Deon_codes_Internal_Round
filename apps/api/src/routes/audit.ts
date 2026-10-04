import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { auditHealth, proofForRecord } from "../chain/auditAnchor.js";
import { config } from "../config/env.js";

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

// Health of the audit log: empty `issues` = nothing to show. The UI only surfaces real problems.
router.get("/health", async (_req, res, next) => {
  try {
    const data = await auditHealth(prisma, {
      anchoringEnabled: !!(config.ANCHOR_CONTRACT_ADDRESS && config.ANCHOR_PRIVATE_KEY),
      intervalMs: config.ANCHOR_INTERVAL_MS,
    });
    res.json({ success: true, data });
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
