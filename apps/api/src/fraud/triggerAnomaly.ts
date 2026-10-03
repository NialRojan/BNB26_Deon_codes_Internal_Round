import { RiskFactor } from "@heirloom/shared";

export interface ClaimTriggerContext {
  recoveryClaimId: string;
  ipAddress?: string;
  countryCode?: string;
  historicalCountryCodes?: string[];
  isRecentPasswordReset?: boolean;
  hoursSinceLastOwnerInteraction?: number;
}

export class TriggerAnomalyDetector {
  /**
   * Analyzes claim submission context for anomalous patterns (e.g. security reset right before claim,
   * unexpected geographical deviation relative to owner history, or recovery while owner is active).
   *
   * INTERNATIONAL & TRUSTED DATA DESIGN:
   * Works internationally. Does NOT hardcode 'US' as benign and others as suspicious.
   * Compares against owner's historical countries when available; if insufficient history exists,
   * treats geolocation neutrally without false positives.
   */
  static detect(ctx: ClaimTriggerContext): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // 1. Check for recent account security resets
    if (ctx.isRecentPasswordReset) {
      factors.push({
        code: "ACCOUNT_SECURITY_RESET",
        severity: "HIGH",
        score: 0.85,
        description: "Recovery initiated immediately following account credential or security reset",
        detectedAt: new Date().toISOString(),
        metadata: { isRecentPasswordReset: true },
      });
    }

    // 2. Check for unexpected location / country relative to owner's history
    if (ctx.countryCode && ctx.historicalCountryCodes && ctx.historicalCountryCodes.length > 0) {
      const normalizedCurrent = ctx.countryCode.toUpperCase().trim();
      const normalizedHistorical = ctx.historicalCountryCodes.map((c) => c.toUpperCase().trim());

      if (!normalizedHistorical.includes(normalizedCurrent)) {
        factors.push({
          code: "UNEXPECTED_IP_GEO",
          severity: "MEDIUM",
          score: 0.55,
          description: `Recovery claim initiated from country (${normalizedCurrent}) differing from owner historical locations (${normalizedHistorical.join(", ")})`,
          detectedAt: new Date().toISOString(),
          metadata: {
            countryCode: normalizedCurrent,
            historicalCountryCodes: normalizedHistorical,
            ipAddress: ctx.ipAddress,
          },
        });
      }
    }

    // 3. Check for rapid trigger while owner was recently active
    if (ctx.hoursSinceLastOwnerInteraction !== undefined && ctx.hoursSinceLastOwnerInteraction < 24) {
      factors.push({
        code: "TRIGGER_ANOMALY",
        severity: "HIGH",
        score: 0.75,
        description: `Recovery triggered only ${ctx.hoursSinceLastOwnerInteraction.toFixed(1)} hours after verified owner check-in`,
        detectedAt: new Date().toISOString(),
        metadata: { hoursSinceLastOwnerInteraction: ctx.hoursSinceLastOwnerInteraction },
      });
    }

    return factors;
  }
}
