import { RiskFactor } from "@heirloom/shared";

export interface CheckInHistoryItem {
  timestamp: Date;
  channel: string;
}

export class BehaviorBaseline {
  /**
   * Compares the owner's typical historical check-in pattern against recent behavior.
   *
   * REQUIREMENTS:
   * - Sorts historical heartbeat records internally (never assumes caller-provided ordering).
   * - Handles insufficient history (< 3 events) safely using owner's configured policy fallback cadence.
   * - Does NOT generate aggressive anomalies from cold-start owners.
   * - Deterministic and testable.
   */
  static analyze(history: CheckInHistoryItem[], fallbackCadenceDays = 30): RiskFactor[] {
    const factors: RiskFactor[] = [];
    if (!history || history.length === 0) return factors;

    // 1. Sort history internally: descending by timestamp (most recent first)
    const sorted = [...history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latestTimestamp = new Date(sorted[0].timestamp).getTime();
    const latestDiffDays = (Date.now() - latestTimestamp) / (1000 * 60 * 60 * 24);

    let baselineCadenceDays: number;

    if (sorted.length < 3) {
      // Safe cold-start handling: use configured policy interval
      baselineCadenceDays = fallbackCadenceDays;
    } else {
      // Calculate intervals between historical check-ins in days
      const intervals: number[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const diffMs = Math.abs(
          new Date(sorted[i].timestamp).getTime() - new Date(sorted[i + 1].timestamp).getTime()
        );
        intervals.push(diffMs / (1000 * 60 * 60 * 24));
      }
      baselineCadenceDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    // Flag as anomaly only if the inactivity gap exceeds 4x baseline cadence
    if (latestDiffDays > baselineCadenceDays * 4) {
      factors.push({
        code: "BEHAVIOR_DEVIATION",
        severity: "MEDIUM",
        score: 0.60,
        description: `Owner's inactive gap (${latestDiffDays.toFixed(1)} days) significantly exceeds baseline cadence (${baselineCadenceDays.toFixed(1)} days)`,
        detectedAt: new Date().toISOString(),
        metadata: { avgIntervalDays: baselineCadenceDays, latestDiffDays },
      });
    }

    return factors;
  }
}
