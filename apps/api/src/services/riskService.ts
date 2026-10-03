import { RiskEvent } from "@prisma/client";
import { IRiskService, IRecoveryService, IAuditService } from "./interfaces.js";
import { IRiskEventRepository } from "../repositories/interfaces.js";
import { RiskEventRepository } from "../repositories/riskEventRepository.js";
import { RecoveryService } from "./recoveryService.js";
import { AuditService } from "./auditService.js";
import { RiskEventType, RiskSeverity, RiskLevel } from "../types/domain.js";
import { ValidationError } from "../errors/AppError.js";
import { logger } from "../config/logger.js";

const VALID_SEVERITIES: RiskSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export class RiskService implements IRiskService {
  constructor(
    private readonly riskRepo: IRiskEventRepository = new RiskEventRepository(),
    private readonly recoveryService: IRecoveryService = new RecoveryService(),
    private readonly auditService: IAuditService = new AuditService()
  ) {}

  async recordRiskEvent(data: {
    recoveryAttemptId: string;
    type: RiskEventType;
    severity: RiskSeverity;
    score: number;
    timestamp?: Date;
    metadata?: Record<string, unknown> | null;
  }): Promise<RiskEvent> {
    // 1. Verify recovery attempt exists
    await this.recoveryService.getRecovery(data.recoveryAttemptId);

    // 2. Validate severity
    const severityUpper = data.severity.toUpperCase() as RiskSeverity;
    if (!VALID_SEVERITIES.includes(severityUpper)) {
      throw new ValidationError(
        `Invalid severity '${data.severity}'. Valid severities: ${VALID_SEVERITIES.join(", ")}`
      );
    }

    // 3. Validate score
    if (typeof data.score !== "number" || isNaN(data.score)) {
      throw new ValidationError("Risk score must be a valid number");
    }

    // 4. Create risk event
    const event = await this.riskRepo.create({
      recoveryAttemptId: data.recoveryAttemptId,
      type: data.type,
      severity: severityUpper,
      score: data.score,
      timestamp: data.timestamp ?? new Date(),
      metadata: data.metadata,
    });

    // 5. Record audit event
    await this.auditService.recordEvent({
      eventType: "RISK_EVENT_CREATED",
      actorId: "FRAUD_DETECTION_ENGINE",
      actorType: "SYSTEM",
      entityId: event.id,
      entityType: "RiskEvent",
      metadata: {
        recoveryAttemptId: data.recoveryAttemptId,
        type: data.type,
        severity: severityUpper,
        score: data.score,
      },
    });

    logger.info(
      `Risk event recorded for recovery ${data.recoveryAttemptId}: ${data.type} (${severityUpper}, score: ${data.score})`
    );
    return event;
  }

  async getRiskEvents(recoveryAttemptId: string): Promise<RiskEvent[]> {
    await this.recoveryService.getRecovery(recoveryAttemptId);
    return this.riskRepo.findManyByRecoveryId(recoveryAttemptId);
  }

  /**
   * Evaluates recovery risk using canonical Member 3 fraud scoring weights and thresholds.
   */
  async evaluateRecoveryRisk(
    recoveryAttemptId: string
  ): Promise<{ score: number; level: RiskLevel }> {
    const events = await this.getRiskEvents(recoveryAttemptId);

    if (events.length > 0) {
      const maxScore = Math.max(...events.map((e) => e.score));
      const avgScore = events.reduce((acc, ev) => acc + ev.score, 0) / events.length;
      const overallScore = parseFloat((maxScore * 0.7 + avgScore * 0.3).toFixed(2));

      let level: RiskLevel = "LOW";
      if (events.some((e) => e.severity === "CRITICAL") || overallScore >= 0.90) {
        level = "CRITICAL";
      } else if (events.some((e) => e.severity === "HIGH") || overallScore >= 0.55) {
        level = "HIGH";
      } else if (events.some((e) => e.severity === "MEDIUM") || overallScore >= 0.25) {
        level = "MEDIUM";
      }

      return { score: overallScore, level };
    }

    const { ScoringEngine } = await import("../fraud/scoringEngine.js");
    const profile = await ScoringEngine.evaluateFromDatabase(recoveryAttemptId);
    return { score: profile.overallScore, level: profile.level };
  }
}
