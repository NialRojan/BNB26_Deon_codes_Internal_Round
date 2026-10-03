/**
 * Heirloom Protocol Fraud & Risk Score Shape
 * Used by backend Fraud Engine (Member 3) to feed VetoTimer.sol (Member 2)
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskFactor {
  code:
    | "TRIGGER_ANOMALY"
    | "GUARDIAN_COLLUSION"
    | "BEHAVIOR_DEVIATION"
    | "UNEXPECTED_IP_GEO"
    | "DEVICE_FINGERPRINT_MISMATCH"
    | "ACCOUNT_SECURITY_RESET"
    | "DOCUMENT_INCONSISTENCY";
  severity: RiskLevel;
  score: number; // 0.0 to 1.0
  description: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RiskScoreProfile {
  recoveryClaimId: string;
  overallScore: number; // 0.00 (safe) to 1.00 (extreme anomaly)
  level: RiskLevel;
  factors: RiskFactor[];
  evaluatedAt: string;
  vetoExtensionDays: number; // e.g. 0 days for LOW, 7 days for MEDIUM, 14 days for HIGH
  shouldHaltAutomaticRelease: boolean;
}
