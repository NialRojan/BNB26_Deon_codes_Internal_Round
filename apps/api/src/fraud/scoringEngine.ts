import { db, sanitizeMetadata } from "../db/schema.js";
import { logger } from "../config/logger.js";
import { RiskFactor, RiskLevel, RiskScoreProfile, AuditEventType } from "@heirloom/shared";
import { TriggerAnomalyDetector, ClaimTriggerContext } from "./triggerAnomaly.js";
import { CollusionDetector, GuardianAttestationSubmission } from "./collusionDetector.js";
import { BehaviorBaseline, CheckInHistoryItem } from "./behaviorBaseline.js";
import { VetoExtender } from "./vetoExtender.js";
import { NotFoundError } from "../errors/AppError.js";

export interface FullFraudEvaluationInput {
  recoveryClaimId: string;
  triggerContext: ClaimTriggerContext;
  attestations?: GuardianAttestationSubmission[];
  checkInHistory?: CheckInHistoryItem[];
  baseVetoDays?: number;
}

export class ScoringEngine {
  /**
   * CANONICAL SCORING ENGINE (Member 3)
   *
   * Evaluates all fraud and anomaly vectors for a recovery claim and produces an aggregated RiskScoreProfile.
   * - Aggregates factors deterministically
   * - Calculates overall risk score and level
   * - Persists RiskEvents to db.riskEvent
   * - Updates RecoveryAttempt table
   * - Emits AuditEvent
   * - Recommends veto extension (does NOT execute on-chain veto)
   */
  static async evaluate(input: FullFraudEvaluationInput): Promise<RiskScoreProfile> {
    logger.info(`[ScoringEngine] Evaluating fraud risk for claim: ${input.recoveryClaimId}`);

    const allFactors: RiskFactor[] = [];

    // 1. Trigger anomalies (unexpected IPs, immediate password resets, recent owner activity)
    const triggerFactors = TriggerAnomalyDetector.detect(input.triggerContext);
    allFactors.push(...triggerFactors);

    // 2. Collusion detection (shared device fingerprints, subnets, temporal clustering)
    if (input.attestations && input.attestations.length > 0) {
      const collusionFactors = CollusionDetector.detect(input.attestations);
      allFactors.push(...collusionFactors);
    }

    // 3. Behavioral baseline deviations
    if (input.checkInHistory && input.checkInHistory.length > 0) {
      const behaviorFactors = BehaviorBaseline.analyze(input.checkInHistory);
      allFactors.push(...behaviorFactors);
    }

    // Calculate aggregated overall score
    let overallScore = 0.0;
    if (allFactors.length > 0) {
      const maxScore = Math.max(...allFactors.map((f) => f.score));
      const avgScore = allFactors.reduce((acc, f) => acc + f.score, 0) / allFactors.length;
      // Weighted blend favoring worst-case anomaly
      overallScore = parseFloat((maxScore * 0.7 + avgScore * 0.3).toFixed(2));
    }

    // Determine Risk Level
    let level: RiskLevel = "LOW";
    if (overallScore >= 0.75 || allFactors.some((f) => f.severity === "CRITICAL")) {
      level = "CRITICAL";
    } else if (overallScore >= 0.55 || allFactors.some((f) => f.severity === "HIGH")) {
      level = "HIGH";
    } else if (overallScore >= 0.25 || allFactors.some((f) => f.severity === "MEDIUM")) {
      level = "MEDIUM";
    }

    // Calculate Veto Extension recommendation
    const { extensionDays, shouldHaltAutomaticRelease } = VetoExtender.calculateExtensionDays(
      level,
      input.baseVetoDays || 14
    );

    // Persist discovered factors to db.riskEvent
    for (const factor of allFactors) {
      await db.riskEvent.create({
        data: {
          recoveryAttemptId: input.recoveryClaimId,
          type: factor.code,
          severity: factor.severity,
          score: factor.score,
          timestamp: new Date(),
          metadata: JSON.stringify(sanitizeMetadata(factor.metadata)),
        },
      });

      await db.auditEvent.create({
        data: {
          eventType: AuditEventType.RISK_EVENT_CREATED,
          actorId: "FRAUD_SCORING_ENGINE",
          actorType: "SYSTEM",
          entityId: input.recoveryClaimId,
          entityType: "RiskEvent",
          metadata: JSON.stringify({ code: factor.code, severity: factor.severity, score: factor.score }),
        },
      });
    }

    // Update RecoveryAttempt risk score & level
    await db.recoveryAttempt.update({
      where: { id: input.recoveryClaimId },
      data: {
        riskScore: overallScore,
        riskLevel: level,
      },
    });

    const profile: RiskScoreProfile = {
      recoveryClaimId: input.recoveryClaimId,
      overallScore,
      level,
      factors: allFactors,
      evaluatedAt: new Date().toISOString(),
      vetoExtensionDays: extensionDays,
      shouldHaltAutomaticRelease,
    };

    logger.info(`[ScoringEngine] Final risk score: ${overallScore} (${level}), veto extension: +${extensionDays}d`);
    return profile;
  }

  /**
   * CRITICAL SECURITY PIPELINE:
   * Evaluates risk strictly using TRUSTED database records.
   * Authoritative data (heartbeats, attestations, security events, owner activity)
   * is derived directly from the database and NEVER trusted from client req.body.
   */
  static async evaluateFromDatabase(
    recoveryClaimId: string,
    clientMetadata?: { ipAddress?: string; countryCode?: string; baseVetoDays?: number }
  ): Promise<RiskScoreProfile> {
    const claim = await db.recoveryAttempt.findUnique({
      where: { id: recoveryClaimId },
    });
    if (!claim) {
      throw new NotFoundError(`Recovery claim '${recoveryClaimId}' not found`);
    }

    const ownerId = claim.ownerId;

    // 1. Load trusted owner availability
    const availability = await db.ownerAvailability.findUnique({
      where: { ownerId },
    });

    // 2. Load trusted heartbeat history
    const heartbeatRecords = await db.heartbeatEvent.findMany({
      where: { ownerId, responseStatus: "RECEIVED" },
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    const checkInHistory: CheckInHistoryItem[] = heartbeatRecords.map((h) => ({
      timestamp: h.timestamp,
      channel: h.channel,
    }));

    // 3. Derive historical country codes from verified heartbeat metadata
    const historicalCountryCodes: string[] = [];
    for (const h of heartbeatRecords) {
      if (h.metadata) {
        try {
          const meta = JSON.parse(h.metadata);
          if (meta.countryCode && typeof meta.countryCode === "string") {
            const code = meta.countryCode.toUpperCase().trim();
            if (!historicalCountryCodes.includes(code)) {
              historicalCountryCodes.push(code);
            }
          }
        } catch {
          // ignore malformed metadata
        }
      }
    }

    // 4. Derive trusted hoursSinceLastOwnerInteraction
    let hoursSinceLastOwnerInteraction: number | undefined;
    const lastActive = availability?.lastHeartbeatAt || (heartbeatRecords.length > 0 ? heartbeatRecords[0].timestamp : null);
    if (lastActive) {
      hoursSinceLastOwnerInteraction = Math.max(0, (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60));
    }

    // 5. Derive trusted recent password/security reset status from audit logs
    const securityResetAudits = await db.auditEvent.findMany({
      where: {
        actorId: ownerId,
        eventType: { in: ["PASSWORD_RESET", "SECURITY_RESET", "CREDENTIAL_UPDATE"] },
      },
      orderBy: { timestamp: "desc" },
      take: 1,
    });

    let isRecentPasswordReset = false;
    if (securityResetAudits.length > 0) {
      const resetDiffMs = Date.now() - new Date(securityResetAudits[0].timestamp).getTime();
      if (resetDiffMs < 48 * 60 * 60 * 1000) {
        // Occurred within 48 hours
        isRecentPasswordReset = true;
      }
    }

    // 6. Load trusted guardian attestations
    const attestationRecords = await db.guardianAttestation.findMany({
      where: { recoveryAttemptId: recoveryClaimId },
      orderBy: { timestamp: "asc" },
    });

    const attestations: GuardianAttestationSubmission[] = attestationRecords.map((att) => {
      let ipAddress: string | undefined;
      let deviceFingerprint: string | undefined;

      if (att.metadata) {
        try {
          const meta = JSON.parse(att.metadata);
          ipAddress = meta.ipAddress;
          deviceFingerprint = meta.deviceFingerprint;
        } catch {
          // ignore
        }
      }

      return {
        guardianId: att.guardianId,
        ipAddress,
        deviceFingerprint,
        submittedAt: att.timestamp,
      };
    });

    // 7. Assemble trusted trigger context
    const triggerContext: ClaimTriggerContext = {
      recoveryClaimId,
      ipAddress: clientMetadata?.ipAddress,
      countryCode: clientMetadata?.countryCode,
      historicalCountryCodes,
      isRecentPasswordReset,
      hoursSinceLastOwnerInteraction,
    };

    return this.evaluate({
      recoveryClaimId,
      triggerContext,
      attestations,
      checkInHistory,
      baseVetoDays: clientMetadata?.baseVetoDays,
    });
  }
}
