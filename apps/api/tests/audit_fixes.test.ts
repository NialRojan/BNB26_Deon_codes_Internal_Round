import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { createApp } from "../src/app.js";
import { db } from "../src/db/schema.js";
import { HeartbeatScheduler } from "../src/heartbeat/scheduler.js";
import { WatchTransition } from "../src/watch/watchTransition.js";
import { AlertMatrix } from "../src/watch/alertMatrix.js";
import { BiometricChannel } from "../src/heartbeat/channels/biometric.js";
import { TriggerAnomalyDetector } from "../src/fraud/triggerAnomaly.js";
import { CollusionDetector } from "../src/fraud/collusionDetector.js";
import { BehaviorBaseline } from "../src/fraud/behaviorBaseline.js";
import { ScoringEngine } from "../src/fraud/scoringEngine.js";
import { DocumentIntake } from "../src/documents/intake.js";
import { DocumentVerification } from "../src/documents/verification.js";
import { VaultState } from "@heirloom/shared";

const app = createApp();

describe("Member 3 Comprehensive Audit Fixes & Verification", () => {
  let ownerId: string;
  let recoveryClaimId: string;

  beforeEach(async () => {
    // Setup clean owner
    const owner = await db.owner.create({
      data: { externalReference: `test_owner_audit_${Date.now()}_${Math.random()}` },
    });
    ownerId = owner.id;

    await db.ownerAvailability.create({
      data: {
        ownerId,
        state: "ACTIVE",
        heartbeatIntervalDays: 14,
        gracePeriodDays: 3,
        lastHeartbeatAt: new Date(),
        nextCheckInDueAt: new Date(Date.now() + 14 * 86_400_000),
      },
    });

    const recovery = await db.recoveryAttempt.create({
      data: {
        ownerId,
        reason: "Test recovery attempt for audit validation",
        source: "BENEFICIARY_CLAIM",
        status: "PENDING",
      },
    });
    recoveryClaimId = recovery.id;
  });

  // ==========================================
  // 1. HEARTBEAT SCHEDULING & CHANNELS
  // ==========================================
  describe("Heartbeat Scheduling & Channel Failure Handling", () => {
    it("derives nextCheckInDueAt from configured owner interval upon check-in", async () => {
      const res = await request(app)
        .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          channel: "WHATSAPP",
          eventType: "MANUAL_CHECKIN",
        });

      expect(res.status).toBe(201);

      const availability = await db.ownerAvailability.findUnique({ where: { ownerId } });
      expect(availability).toBeDefined();
      expect(availability?.missedCount).toBe(0);
      expect(availability?.state).toBe("ACTIVE");

      // Interval was set to 14 days, so nextCheckInDueAt should be ~14 days in the future
      const dueTime = new Date(availability!.nextCheckInDueAt!).getTime();
      const expectedTime = Date.now() + 14 * 86_400_000;
      expect(Math.abs(dueTime - expectedTime)).toBeLessThan(60_000); // within 1 minute
    });

    it("autonomously queries database for overdue owners during sweep", async () => {
      // Set owner's check-in to the past
      await db.ownerAvailability.update({
        where: { ownerId },
        data: {
          nextCheckInDueAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
          missedCount: 2, // Next missed ping will escalate to WATCH (threshold = 3)
        },
      });

      // Autonomous sweep without passing IDs
      const transitioned = await HeartbeatScheduler.runOverdueCheckInSweep();
      expect(transitioned).toBeGreaterThanOrEqual(1);

      const availability = await db.ownerAvailability.findUnique({ where: { ownerId } });
      expect(availability?.state).toBe("WATCH");
    });

    it("is safe to invoke scheduler sweep repeatedly (safe idempotency)", async () => {
      await db.ownerAvailability.update({
        where: { ownerId },
        data: {
          nextCheckInDueAt: new Date(Date.now() - 3600 * 1000),
          missedCount: 2,
        },
      });

      const firstSweep = await HeartbeatScheduler.runOverdueCheckInSweep([ownerId]);
      expect(firstSweep).toBe(1);

      // Second immediate sweep: already in WATCH, should transition 0 additional owners
      const secondSweep = await HeartbeatScheduler.runOverdueCheckInSweep([ownerId]);
      expect(secondSweep).toBe(0);
    });

    it("records transport failure without treating it as owner failure of proof-of-life", async () => {
      // Dispatch ping to a push token that simulates an error
      const initialAvailability = await db.ownerAvailability.findUnique({ where: { ownerId } });
      const initialMissed = initialAvailability?.missedCount;

      // Passing empty push token or simulating channel failure
      const result = await HeartbeatScheduler.runScheduledPingCycle([
        {
          ownerId,
          channels: ["PUSH"],
          deviceToken: "", // Missing device token triggers fallback / failure
        },
      ]);

      expect(result.errors).toBe(0); // Handled gracefully

      const afterAvailability = await db.ownerAvailability.findUnique({ where: { ownerId } });
      // Missed count must NOT increase due to network/channel dispatch failure
      expect(afterAvailability?.missedCount).toBe(initialMissed);
      expect(afterAvailability?.state).toBe("ACTIVE");
    });

    it("recovers from WATCH back to ACTIVE on valid check-in", async () => {
      // Transition to WATCH
      await WatchTransition.moveToWatch({ ownerId, reason: "Missed pings test" });

      const watchState = await db.ownerAvailability.findUnique({ where: { ownerId } });
      expect(watchState?.state).toBe("WATCH");

      // Owner performs verified check-in
      const res = await request(app)
        .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          channel: "APP_CHECKIN",
          eventType: "MANUAL_CHECKIN",
        });

      expect(res.status).toBe(201);
      const activeState = await db.ownerAvailability.findUnique({ where: { ownerId } });
      expect(activeState?.state).toBe("ACTIVE");
      expect(activeState?.missedCount).toBe(0);
    });

    it("supports startScheduler and stopScheduler lifecycle with configurable interval", async () => {
      const { config } = await import("../src/config/env.js");
      expect(config.HEARTBEAT_SWEEP_INTERVAL_MS).toBeDefined();
      expect(typeof config.HEARTBEAT_SWEEP_INTERVAL_MS).toBe("number");

      // Verify scheduler lifecycle controls
      expect(() => HeartbeatScheduler.startScheduler(config.HEARTBEAT_SWEEP_INTERVAL_MS)).not.toThrow();
      expect(() => HeartbeatScheduler.startScheduler(config.HEARTBEAT_SWEEP_INTERVAL_MS)).not.toThrow(); // Idempotent start
      expect(() => HeartbeatScheduler.stopScheduler()).not.toThrow();
    });
  });

  // ==========================================
  // 2. WATCH TRANSITION & ALERT DEDUPLICATION
  // ==========================================
  describe("Watch Transition Idempotency & Alert Deduplication", () => {
    it("WatchTransition is strictly idempotent: does not duplicate audit events or corrupt state", async () => {
      const first = await WatchTransition.moveToWatch({
        ownerId,
        reason: "Initial trigger",
      });
      expect(first.state).toBe(VaultState.WATCH);

      const auditsBefore = await db.auditEvent.count({
        where: { entityId: ownerId, eventType: "VAULT_ENTERED_WATCH" },
      });
      expect(auditsBefore).toBe(1);

      // Repeated call
      const second = await WatchTransition.moveToWatch({
        ownerId,
        reason: "Duplicate trigger",
      });
      expect(second.state).toBe(VaultState.WATCH);

      const auditsAfter = await db.auditEvent.count({
        where: { entityId: ownerId, eventType: "VAULT_ENTERED_WATCH" },
      });
      // Audit count MUST NOT increase
      expect(auditsAfter).toBe(1);
    });

    it("AlertMatrix deduplicates pending alerts to prevent notification spam", async () => {
      // Clear alerts for this owner
      await db.alert.deleteMany({ where: { ownerId } });

      const count1 = await AlertMatrix.dispatchWatchAlerts({
        ownerId,
        reason: "First alert barrage",
        email: "owner@example.com",
        phone: "+15550001111",
      });
      expect(count1).toBe(4); // EMAIL, SMS, WHATSAPP, PUSH

      // Second dispatch with same channels while alerts are PENDING
      const count2 = await AlertMatrix.dispatchWatchAlerts({
        ownerId,
        reason: "Second sweep sweep barrage",
        email: "owner@example.com",
        phone: "+15550001111",
      });
      expect(count2).toBe(0); // All 4 suppressed

      const totalPending = await db.alert.count({
        where: { ownerId, status: "PENDING" },
      });
      expect(totalPending).toBe(4);
    });
  });

  // ==========================================
  // 3. BIOMETRIC BOUNDARY
  // ==========================================
  describe("Biometric Verification Boundary", () => {
    it("rejects invalid or tampered biometric signatures and does not reset availability", async () => {
      // Put owner in WATCH
      await db.ownerAvailability.update({
        where: { ownerId },
        data: { state: "WATCH", missedCount: 3 },
      });

      await expect(
        BiometricChannel.recordBiometricCheckIn({
          ownerId,
          credentialId: "cred_test_01",
          signature: "invalid-signature", // Invalid signature
          clientDataJson: "{}",
          authenticatorData: "{}",
        })
      ).rejects.toThrow();

      // State must remain WATCH
      const state = await db.ownerAvailability.findUnique({ where: { ownerId } });
      expect(state?.state).toBe("WATCH");
      expect(state?.missedCount).toBe(3);
    });
  });

  // ==========================================
  // 4. FRAUD ENGINE & TRUSTED DATA
  // ==========================================
  describe("Fraud Engine Security & Anomaly Detection", () => {
    it("CRITICAL: evaluate-risk derives data from DB and ignores client-forged evidence", async () => {
      // Setup real trusted anomaly in database:
      // Record a verified owner heartbeat 2 hours ago (owner active recently)
      await db.heartbeatEvent.create({
        data: {
          ownerId,
          channel: "APP_CHECKIN",
          eventType: "MANUAL_CHECKIN",
          responseStatus: "RECEIVED",
          timestamp: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
        },
      });

      // Update ownerAvailability lastHeartbeatAt to 2 hours ago
      await db.ownerAvailability.update({
        where: { ownerId },
        data: { lastHeartbeatAt: new Date(Date.now() - 2 * 3600 * 1000) },
      });

      // Attacker attempts to submit fake clean body: claiming owner was inactive for 300 hours
      const res = await request(app)
        .post(`/api/v1/claims/${recoveryClaimId}/evaluate-risk`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          triggerContext: {
            hoursSinceLastOwnerInteraction: 300, // FAKE
            isRecentPasswordReset: false, // FAKE
          },
          checkInHistory: [], // FAKE
          attestations: [], // FAKE
        });

      expect(res.status).toBe(200);
      const profile = res.body.data;

      // Because backend loaded trusted DB records, it detects TRIGGER_ANOMALY (<24h active)
      const triggerAnomaly = profile.factors.find(
        (f: { code: string }) => f.code === "TRIGGER_ANOMALY"
      );
      expect(triggerAnomaly).toBeDefined();
      expect(profile.level).not.toBe("LOW");
    });

    it("works internationally: does not flag non-US country if in owner history or neutral", () => {
      // Cold-start / neutral: no anomaly if no historical countries
      const neutralFactors = TriggerAnomalyDetector.detect({
        recoveryClaimId,
        countryCode: "SG", // Singapore
        historicalCountryCodes: [],
      });
      expect(neutralFactors).toHaveLength(0);

      // Known country in international history: no anomaly
      const matchedFactors = TriggerAnomalyDetector.detect({
        recoveryClaimId,
        countryCode: "DE", // Germany
        historicalCountryCodes: ["DE", "FR"],
      });
      expect(matchedFactors).toHaveLength(0);

      // Country differs from international history: flagged
      const unexpectedFactors = TriggerAnomalyDetector.detect({
        recoveryClaimId,
        countryCode: "RU",
        historicalCountryCodes: ["JP", "KR"],
      });
      expect(unexpectedFactors.some((f) => f.code === "UNEXPECTED_IP_GEO")).toBe(true);
    });

    it("detects guardian subnet sharing and temporal clustering", () => {
      const now = new Date();

      // Submissions on same /24 IPv4 subnet
      const subnetSubmissions = [
        {
          guardianId: "guardian_1",
          ipAddress: "192.168.1.10",
          submittedAt: new Date(now.getTime() - 3600 * 1000),
        },
        {
          guardianId: "guardian_2",
          ipAddress: "192.168.1.55", // Same /24
          submittedAt: new Date(now.getTime() - 1800 * 1000),
        },
      ];

      const subnetFactors = CollusionDetector.detect(subnetSubmissions);
      const subnetFactor = subnetFactors.find(
        (f) => f.code === "GUARDIAN_COLLUSION" && (f.metadata as any)?.collusionType === "SHARED_SUBNET"
      );
      expect(subnetFactor).toBeDefined();

      // Temporal clustering: distinct guardians submitting within 30 seconds
      const temporalSubmissions = [
        {
          guardianId: "guardian_A",
          ipAddress: "10.0.0.1",
          submittedAt: now,
        },
        {
          guardianId: "guardian_B",
          ipAddress: "172.16.0.1", // Different subnet
          submittedAt: new Date(now.getTime() + 30_000), // 30 seconds later
        },
      ];

      const temporalFactors = CollusionDetector.detect(temporalSubmissions);
      const temporalFactor = temporalFactors.find(
        (f) =>
          f.code === "GUARDIAN_COLLUSION" &&
          (f.metadata as any)?.collusionType === "RAPID_CONCURRENT_ATTESTATIONS"
      );
      expect(temporalFactor).toBeDefined();
    });

    it("BehaviorBaseline sorts history internally and handles cold start safely", () => {
      // 1. Unsorted history input
      const unsorted = [
        { timestamp: new Date(Date.now() - 30 * 86_400_000), channel: "PUSH" },
        { timestamp: new Date(Date.now() - 10 * 86_400_000), channel: "PUSH" },
        { timestamp: new Date(Date.now() - 20 * 86_400_000), channel: "PUSH" },
      ];
      // Recent gap is only 10 days, average cadence is 10 days -> normal, no deviation
      const normalFactors = BehaviorBaseline.analyze(unsorted);
      expect(normalFactors).toHaveLength(0);

      // 2. Cold-start (< 3 events): uses fallbackCadenceDays safely
      const coldStart = [{ timestamp: new Date(Date.now() - 5 * 86_400_000), channel: "PUSH" }];
      const coldFactors = BehaviorBaseline.analyze(coldStart, 30);
      expect(coldFactors).toHaveLength(0); // 5 days is well within 30 * 4 = 120 days

      // 3. Abnormal gap exceeding 4x cadence
      const abnormalHistory = [
        { timestamp: new Date(Date.now() - 150 * 86_400_000), channel: "PUSH" },
        { timestamp: new Date(Date.now() - 160 * 86_400_000), channel: "PUSH" },
        { timestamp: new Date(Date.now() - 170 * 86_400_000), channel: "PUSH" },
      ];
      const abnormalFactors = BehaviorBaseline.analyze(abnormalHistory);
      expect(abnormalFactors.some((f) => f.code === "BEHAVIOR_DEVIATION")).toBe(true);
    });

    it("ScoringEngine produces deterministic profile and veto extension recommendations", async () => {
      const profile = await ScoringEngine.evaluate({
        recoveryClaimId,
        triggerContext: {
          recoveryClaimId,
          isRecentPasswordReset: true,
          hoursSinceLastOwnerInteraction: 1, // High anomaly
        },
        baseVetoDays: 14,
      });

      expect(profile.recoveryClaimId).toBe(recoveryClaimId);
      expect(profile.level).toBe("CRITICAL");
      expect(profile.vetoExtensionDays).toBe(14);
      expect(profile.shouldHaltAutomaticRelease).toBe(true);
    });
  });

  // ==========================================
  // 5. DOCUMENT INTAKE & INTEGRITY
  // ==========================================
  describe("Document Intake, Integrity & Consistency Verification", () => {
    it("computes SHA-256 server-side and rejects claimed hash mismatch", async () => {
      const rawText = "Verified Medical Examiner Death Certificate Content";
      const actualHash = crypto.createHash("sha256").update(rawText).digest("hex");
      const fakeHash = "0x_fake_mismatched_hash_string";

      // Mismatched hash rejected
      await expect(
        DocumentIntake.submitDocument({
          recoveryClaimId,
          documentType: "DEATH_CERTIFICATE",
          documentHash: fakeHash,
          rawContent: rawText,
          issuingAuthority: "State Health Dept",
          jurisdiction: "NY, USA",
          documentDate: "2026-09-01",
          submittedBy: "doctor_0x1",
        })
      ).rejects.toThrow(/hash integrity check failed/i);

      // Matching hash accepted and marked cryptographically verified
      const validDoc = await DocumentIntake.submitDocument({
        recoveryClaimId,
        documentType: "DEATH_CERTIFICATE",
        documentHash: actualHash,
        rawContent: rawText,
        issuingAuthority: "State Health Dept",
        jurisdiction: "NY, USA",
        documentDate: "2026-09-01",
        submittedBy: "doctor_0x1",
      });

      expect(validDoc.isCryptographicallyVerified).toBe(true);
    });

    it("rejects document issue date in the future", async () => {
      const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString();

      await expect(
        DocumentIntake.submitDocument({
          recoveryClaimId,
          documentType: "DEATH_CERTIFICATE",
          documentHash: "0x_dummy_hash",
          issuingAuthority: "County Clerk",
          jurisdiction: "TX, USA",
          documentDate: futureDate,
          submittedBy: "claimant_0x2",
        })
      ).rejects.toThrow(/cannot be in the future/i);
    });

    it("flags chronological inconsistency when death certificate is dated before verified heartbeat", async () => {
      // Set owner's verified heartbeat at 2026-09-20
      await db.heartbeatEvent.create({
        data: {
          ownerId,
          channel: "APP_CHECKIN",
          eventType: "MANUAL_CHECKIN",
          responseStatus: "RECEIVED",
          timestamp: new Date("2026-09-20T12:00:00Z"),
        },
      });

      // Submit death certificate dated 2026-09-10 (10 days BEFORE owner was active!)
      const rawCert = "Death Certificate dated September 10";
      const certHash = crypto.createHash("sha256").update(rawCert).digest("hex");

      const doc = await DocumentIntake.submitDocument({
        recoveryClaimId,
        documentType: "DEATH_CERTIFICATE",
        documentHash: certHash,
        rawContent: rawCert,
        issuingAuthority: "Coroner Office",
        jurisdiction: "IL, USA",
        documentDate: "2026-09-10T00:00:00Z",
        submittedBy: "oracle_node",
      });

      // Evaluate document consistency
      const evalResult = await DocumentVerification.evaluateDocument({
        documentId: doc.documentId,
        verifierId: "EVAL_ENGINE",
      });

      expect(evalResult.decision).toBe("FLAGGED_INCONSISTENCY");
      expect(evalResult.reason).toContain("prior to confirmed owner proof-of-life");
    });
  });

  // ==========================================
  // 6. SECURITY & AUTHENTICATION
  // ==========================================
  describe("Security, Cross-Owner Isolation & Auth Boundary", () => {
    it("rejects cross-owner access with 403 Forbidden", async () => {
      const otherOwner = await db.owner.create({
        data: { externalReference: `other_owner_${Date.now()}` },
      });

      const res = await request(app)
        .get(`/api/v1/owners/${otherOwner.id}/availability`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`); // Authenticated as ownerId

      expect(res.status).toBe(403);
    });

    it("rejects missing or invalid authorization tokens", async () => {
      const noAuthRes = await request(app).get(`/api/v1/owners/${ownerId}/availability`);
      expect(noAuthRes.status).toBe(401);

      const invalidAuthRes = await request(app)
        .get(`/api/v1/owners/${ownerId}/availability`)
        .set("Authorization", "Bearer invalid-garbage-token");
      expect(invalidAuthRes.status).toBe(401);
    });
  });
});
