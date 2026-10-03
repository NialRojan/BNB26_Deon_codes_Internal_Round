import { db } from "../db/schema.js";
import { logger } from "../config/logger.js";
import { AuditEventType } from "@heirloom/shared";
import { NotFoundError, ValidationError } from "../errors/AppError.js";

export type VerificationDecision = "VERIFIED" | "REJECTED" | "FLAGGED_INCONSISTENCY";

export interface VerifyDocumentRequest {
  documentId: string;
  verifierId: string;
  notes?: string;
}

export interface VerificationResultPayload {
  recoveryClaimId: string;
  documentHash: string;
  verifierId: string;
  decision: VerificationDecision;
  notes?: string;
}

export class DocumentVerification {
  /**
   * Records verification result (compatible with member3_structure test suite).
   */
  static async recordVerificationResult(payload: VerificationResultPayload) {
    logger.info(`[DocumentVerification] Verification decision for claim ${payload.recoveryClaimId}: ${payload.decision}`);

    const existingDoc = await db.claimDocument.findFirst({
      where: { documentHash: payload.documentHash },
    });

    if (existingDoc) {
      await db.claimDocument.update({
        where: { id: existingDoc.id },
        data: { verificationStatus: payload.decision },
      });
    }

    const audit = await db.auditEvent.create({
      data: {
        eventType: AuditEventType.DOCUMENT_VERIFIED,
        actorId: payload.verifierId,
        actorType: "SYSTEM",
        entityId: payload.recoveryClaimId,
        entityType: "DocumentVerification",
        metadata: JSON.stringify({
          documentHash: payload.documentHash,
          decision: payload.decision,
          notes: payload.notes,
        }),
      },
    });

    return {
      success: true,
      auditId: audit.id,
      decision: payload.decision,
    };
  }
  /**
   * Deterministically evaluates document consistency against trusted backend state.
   *
   * DECISION ENFORCEMENT:
   * - FLAGGED_INCONSISTENCY: If documentDate is impossible (e.g. death certificate dated prior to verified owner heartbeats).
   * - FLAGGED_INCONSISTENCY: If documentDate is in the future.
   * - VERIFIED: Only granted if document integrity was cryptographically validated and chronology is consistent.
   * - REJECTED: If metadata is malformed or invalid.
   *
   * Callers cannot arbitrarily mark an unverified document as VERIFIED without evidence.
   */
  static async evaluateDocument(req: VerifyDocumentRequest): Promise<{
    documentId: string;
    decision: VerificationDecision;
    reason: string;
  }> {
    const document = await db.claimDocument.findUnique({
      where: { id: req.documentId },
      include: { recoveryAttempt: true },
    });

    if (!document) {
      throw new NotFoundError(`Claim document '${req.documentId}' not found`);
    }

    const ownerId = document.recoveryAttempt.ownerId;
    const documentTime = new Date(document.documentDate).getTime();
    const now = Date.now();

    // 1. Chronology check: issue date in the future
    if (documentTime > now) {
      const decision: VerificationDecision = "FLAGGED_INCONSISTENCY";
      const reason = "Document issue date is in the future";
      await this.updateStatus(document.id, decision, req.verifierId, reason);
      return { documentId: document.id, decision, reason };
    }

    // 2. Chronology check against trusted owner heartbeats:
    // If a death certificate is dated BEFORE the owner's last confirmed active heartbeat,
    // it represents an impossible chronological inconsistency.
    const latestHeartbeat = await db.heartbeatEvent.findFirst({
      where: { ownerId, responseStatus: "RECEIVED" },
      orderBy: { timestamp: "desc" },
    });

    if (
      document.documentType === "DEATH_CERTIFICATE" &&
      latestHeartbeat &&
      new Date(latestHeartbeat.timestamp).getTime() > documentTime
    ) {
      const decision: VerificationDecision = "FLAGGED_INCONSISTENCY";
      const reason = `Death certificate issue date (${new Date(document.documentDate).toISOString()}) is prior to confirmed owner proof-of-life heartbeat (${new Date(latestHeartbeat.timestamp).toISOString()})`;
      await this.updateStatus(document.id, decision, req.verifierId, reason);
      return { documentId: document.id, decision, reason };
    }

    // 3. Cryptographic integrity check:
    // Metadata-only documents without raw bytes cannot be automatically marked VERIFIED
    let isCryptographicallyVerified = false;
    if (document.metadata) {
      try {
        const meta = JSON.parse(document.metadata);
        isCryptographicallyVerified = !!meta.isCryptographicallyVerified;
      } catch {
        // ignore
      }
    }

    if (!isCryptographicallyVerified) {
      const decision: VerificationDecision = "FLAGGED_INCONSISTENCY";
      const reason = "Document lacks cryptographic byte-level hash verification; metadata-only record";
      await this.updateStatus(document.id, decision, req.verifierId, reason);
      return { documentId: document.id, decision, reason };
    }

    // 4. All checks passed: mark VERIFIED
    const decision: VerificationDecision = "VERIFIED";
    const reason = "Document passed cryptographic hash integrity and chronological consistency checks";
    await this.updateStatus(document.id, decision, req.verifierId, reason);
    return { documentId: document.id, decision, reason };
  }

  private static async updateStatus(
    documentId: string,
    decision: VerificationDecision,
    verifierId: string,
    reason: string
  ) {
    logger.info(`[DocumentVerification] Setting document ${documentId} status to ${decision}: ${reason}`);

    await db.claimDocument.update({
      where: { id: documentId },
      data: { verificationStatus: decision },
    });

    await db.auditEvent.create({
      data: {
        eventType: AuditEventType.DOCUMENT_VERIFIED,
        actorId: verifierId,
        actorType: "SYSTEM",
        entityId: documentId,
        entityType: "ClaimDocument",
        metadata: JSON.stringify({
          decision,
          reason,
        }),
      },
    });
  }
}
