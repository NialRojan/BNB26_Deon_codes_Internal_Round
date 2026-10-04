import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/server.js";
import { db } from "../src/db/schema.js";
import { PushChannel } from "../src/heartbeat/channels/push.js";
import { BiometricChannel, setWebAuthnVerifier, WebAuthnVerifier } from "../src/heartbeat/channels/biometric.js";
import { MessagingBotChannel } from "../src/heartbeat/channels/messagingBot.js";
import { MissedPingTracker } from "../src/heartbeat/missedPingTracker.js";
import { HeartbeatScheduler } from "../src/heartbeat/scheduler.js";
import { WatchTransition } from "../src/watch/watchTransition.js";
import { TriggerAnomalyDetector } from "../src/fraud/triggerAnomaly.js";
import { CollusionDetector } from "../src/fraud/collusionDetector.js";
import { BehaviorBaseline } from "../src/fraud/behaviorBaseline.js";
import { VetoExtender } from "../src/fraud/vetoExtender.js";
import { ScoringEngine } from "../src/fraud/scoringEngine.js";
import { DocumentIntake } from "../src/documents/intake.js";
import { DocumentVerification } from "../src/documents/verification.js";
import { ContractClient } from "../src/chain/contractClient.js";
import { VaultState } from "@heirloom/shared";

describe("Member 3 Module Suite (Heartbeat, Watch, Fraud, Documents, Chain, Routes)", () => {
  it("verifies push, biometric, and messaging bot heartbeat channels", async () => {
    // 1. Create owner
    const owner = await db.owner.create({
      data: {
        externalReference: "owner_m3_test_1",
        availability: { create: { state: "ACTIVE" } },
      },
    });

    // 2. Test PushChannel
    const pushResult = await PushChannel.sendPing({
      ownerId: owner.id,
      deviceToken: "mock_fcm_token_abcdef123456",
      title: "Check-in test",
    });
    expect(pushResult.success).toBe(true);
    expect(pushResult.externalEventId).toContain("push_ping");

    const pushVerify = await PushChannel.verifyResponse({
      ownerId: owner.id,
      externalEventId: pushResult.externalEventId,
    });
    expect(pushVerify.responseStatus).toBe("RECEIVED");

    // 3. Test BiometricChannel with an isolated test verifier fixture
    setWebAuthnVerifier({
      verify: async () => true,
    });
    const bioResult = await BiometricChannel.recordBiometricCheckIn({
      ownerId: owner.id,
      credentialId: "cred_webauthn_passkey_99",
      signature: "0x_test_sig",
      clientDataJson: "{}",
      authenticatorData: "{}",
    });
    expect(bioResult.channel).toBe("BIOMETRIC");
    setWebAuthnVerifier(new WebAuthnVerifier());

    // 4. Test MessagingBotChannel
    const botResult = await MessagingBotChannel.dispatchBotPing({
      ownerId: owner.id,
      recipientHandle: "+1234567890",
      platform: "WHATSAPP",
    });
    expect(botResult.success).toBe(true);

    const botReply = await MessagingBotChannel.handleInboundReply({
      ownerId: owner.id,
      platform: "WHATSAPP",
      inboundText: "I AM SAFE",
    });
    expect(botReply.responseStatus).toBe("RECEIVED");
  });

  it("evaluates MissedPingTracker, Scheduler, and WatchTransition to WATCH state", async () => {
    const owner = await db.owner.create({
      data: {
        externalReference: "owner_m3_tracker_1",
        availability: { create: { state: "ACTIVE", missedCount: 0 } },
      },
    });

    // Ping 1 missed
    const p1 = await MissedPingTracker.recordMissedPing(owner.id, 3);
    expect(p1.newMissedCount).toBe(1);
    expect(p1.shouldEscalateToWatch).toBe(false);

    // Ping 2 missed
    const p2 = await MissedPingTracker.recordMissedPing(owner.id, 3);
    expect(p2.newMissedCount).toBe(2);
    expect(p2.shouldEscalateToWatch).toBe(false);

    // Ping 3 missed -> triggers escalation to WATCH
    const p3 = await MissedPingTracker.recordMissedPing(owner.id, 3);
    expect(p3.newMissedCount).toBe(3);
    expect(p3.shouldEscalateToWatch).toBe(true);

    // WatchTransition execution
    const watchResult = await WatchTransition.moveToWatch({
      ownerId: owner.id,
      reason: p3.reason,
      recipientEmail: "owner@heirloom.protocol",
      recipientPhone: "+15551234567",
    });
    expect(watchResult.state).toBe(VaultState.WATCH);

    // Scheduler sweep test
    const sweepCount = await HeartbeatScheduler.runOverdueCheckInSweep([]);
    expect(sweepCount).toBe(0);
  });

  it("detects trigger anomalies, guardian collusion, and behavior deviations in Fraud Engine", async () => {
    // 1. Trigger anomaly: recent password reset and foreign location
    const triggerAnomalies = TriggerAnomalyDetector.detect({
      recoveryClaimId: "claim_123",
      isRecentPasswordReset: true,
      countryCode: "RU",
      hoursSinceLastOwnerInteraction: 2,
    });
    expect(triggerAnomalies.length).toBeGreaterThanOrEqual(2);
    expect(triggerAnomalies.some((f) => f.code === "ACCOUNT_SECURITY_RESET")).toBe(true);

    // 2. Collusion detection: identical device fingerprint
    const collusion = CollusionDetector.detect([
      {
        guardianId: "g1",
        deviceFingerprint: "device_mac_hash_777",
        ipAddress: "192.168.1.50",
        submittedAt: new Date(),
      },
      {
        guardianId: "g2",
        deviceFingerprint: "device_mac_hash_777",
        ipAddress: "192.168.1.50",
        submittedAt: new Date(),
      },
    ]);
    expect(collusion.some((f) => f.code === "DEVICE_FINGERPRINT_MISMATCH")).toBe(true);
    expect(collusion.some((f) => f.code === "GUARDIAN_COLLUSION")).toBe(true);

    // 3. Behavior baseline
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const history = [
      { timestamp: new Date(now - 40 * day), channel: "PUSH" },
      { timestamp: new Date(now - 45 * day), channel: "PUSH" },
      { timestamp: new Date(now - 50 * day), channel: "PUSH" },
    ];
    const behaviorAnomalies = BehaviorBaseline.analyze(history);
    expect(behaviorAnomalies.some((f) => f.code === "BEHAVIOR_DEVIATION")).toBe(true);

    // 4. VetoExtender calculation
    const extHigh = VetoExtender.calculateExtensionDays("HIGH", 14);
    expect(extHigh.extensionDays).toBe(14);
    expect(extHigh.totalVetoDays).toBe(28);

    const extMed = VetoExtender.calculateExtensionDays("MEDIUM", 14);
    expect(extMed.extensionDays).toBe(7);
  });

  it("runs full ScoringEngine and updates recovery claim risk profile", async () => {
    const owner = await db.owner.create({
      data: {
        externalReference: "owner_fraud_eval",
        availability: { create: { state: "WATCH" } },
      },
    });

    const claim = await db.recoveryAttempt.create({
      data: {
        ownerId: owner.id,
        reason: "Claimant submitted death certificate",
        source: "HEIR_PORTAL",
      },
    });

    const profile = await ScoringEngine.evaluate({
      recoveryClaimId: claim.id,
      triggerContext: {
        recoveryClaimId: claim.id,
        isRecentPasswordReset: true,
      },
      attestations: [
        {
          guardianId: "g_alpha",
          ipAddress: "10.0.0.1",
          deviceFingerprint: "fingerprint_same",
          submittedAt: new Date(),
        },
        {
          guardianId: "g_beta",
          ipAddress: "10.0.0.1",
          deviceFingerprint: "fingerprint_same",
          submittedAt: new Date(),
        },
      ],
    });

    expect(profile.level).toBe("CRITICAL");
    expect(profile.vetoExtensionDays).toBe(14);
    expect(profile.shouldHaltAutomaticRelease).toBe(true);
    expect(profile.factors.length).toBeGreaterThan(0);
  });

  it("handles DocumentIntake, DocumentVerification, and ContractClient", async () => {
    // 1. Ingest document
    const intake = await DocumentIntake.submitDocument({
      recoveryClaimId: "rec_claim_doc_999",
      documentType: "DEATH_CERTIFICATE",
      documentHash: "0x_sha256_mock_hash_of_certificate_pdf",
      issuingAuthority: "State Registrar of Vital Statistics",
      jurisdiction: "CA, USA",
      documentDate: "2026-09-15",
      submittedBy: "executor_0x99",
    });
    expect(intake.documentHash).toBe("0x_sha256_mock_hash_of_certificate_pdf");
    expect(intake.status).toBe("PENDING_VERIFICATION");

    // 2. Verify document
    const verif = await DocumentVerification.recordVerificationResult({
      recoveryClaimId: "rec_claim_doc_999",
      documentHash: intake.documentHash,
      verifierId: "ORACLE_NOTARY_NODE",
      decision: "VERIFIED",
      notes: "Apostille verified through state digital notary registry",
    });
    expect(verif.success).toBe(true);
    expect(verif.decision).toBe("VERIFIED");

    // 3. ContractClient (stubbed chain: reads HeirloomVault.getVaultInfo)
    const fakeChain = {
      readContract: async () => ({
        state: 0, owner: "0x668A3BB33A89E2fF21652E190fB425a59D46AF84", executor: "0x0000000000000000000000000000000000000000",
        assetMapCID: "", lastHeartbeat: 1n, inactivityThreshold: 120n, vetoGracePeriod: 180n, watchStartsAt: 121n,
        vetoEndTime: 0n, executedAt: 0n, epoch: 1n, currentSignatures: 0n, requiredSignatures: 2n,
        guardians: ["0x1", "0x2", "0x3"], beneficiaries: [], ethBalance: 0n,
      }),
    } as unknown as import("viem").PublicClient;
    const client = new ContractClient("http://unused", "0x8085f0EF193B9dD3F7501394bD3d054c045aB575", fakeChain);
    const chainState = await client.getVaultState("vault_1");
    expect(chainState.state).toBe(VaultState.ACTIVE);
    expect(chainState.guardianCount).toBe(3);
    expect(chainState.thresholdK).toBe(2);

    // The contract gives the backend no power to change vault state.
    const vetoTx = await client.extendVetoOnChain("rec_claim_doc_999", 14);
    expect(vetoTx.success).toBe(false);
  });

  it("exercises Member 3 routes: /vault, /guardians, /attestations, /claims", async () => {
    // 1. Vault registration via /api/v1/vault
    const vaultRes = await request(app)
      .post("/api/v1/vault")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "vault_endpoint_test" });
    expect(vaultRes.status).toBe(201);
    const vaultId = vaultRes.body.data.id;

    // 2. Heartbeat via /api/v1/vault/:ownerId/heartbeat
    const hbRes = await request(app)
      .post(`/api/v1/vault/${vaultId}/heartbeat`)
      .set("Authorization", `Bearer test-owner-token-${vaultId}`)
      .send({ channel: "PUSH", eventType: "APP_FOREGROUND" });
    expect(hbRes.status).toBe(201);

    // 3. Recovery Claim via /api/v1/claims
    const claimRes = await request(app)
      .post("/api/v1/claims")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId: vaultId,
        reason: "Test claim",
        source: "PORTAL",
      });
    expect(claimRes.status).toBe(201);
    const claimId = claimRes.body.data.id;

    // 4. Guardian Attestation via /api/v1/attestations/:recoveryId
    const attestRes = await request(app)
      .post(`/api/v1/attestations/${claimId}`)
      .set("Authorization", "Bearer test-guardian-token-guardian_prime")
      .send({
        guardianId: "guardian_prime",
        status: "VALID",
        signature: "0x_sig_prime",
      });
    expect(attestRes.status).toBe(201);

    // 5. Guardian pending requests via /api/v1/guardians/:guardianId/pending-requests
    const gPendingRes = await request(app)
      .get("/api/v1/guardians/guardian_other/pending-requests")
      .set("Authorization", "Bearer test-admin-token");
    expect(gPendingRes.status).toBe(200);

    // 6. Claim document upload via /api/v1/claims/:recoveryId/documents
    const docRes = await request(app)
      .post(`/api/v1/claims/${claimId}/documents`)
      .set("Authorization", "Bearer test-admin-token")
      .send({
        documentType: "DEATH_CERTIFICATE",
        documentHash: "0x_hash_123",
        issuingAuthority: "Registrar",
        jurisdiction: "US",
        documentDate: "2026-10-01",
      });
    expect(docRes.status).toBe(201);

    // 7. Evaluate risk via /api/v1/claims/:recoveryId/evaluate-risk
    const evalRes = await request(app)
      .post(`/api/v1/claims/${claimId}/evaluate-risk`)
      .set("Authorization", "Bearer test-admin-token")
      .send({});
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.data).toHaveProperty("level");

    // 8. Owner Veto via /api/v1/vault/:ownerId/veto/:recoveryId
    const vetoRes = await request(app)
      .post(`/api/v1/vault/${vaultId}/veto/${claimId}`)
      .set("Authorization", `Bearer test-owner-token-${vaultId}`)
      .send({ cancelReason: "I am safe and healthy. Cancel claim immediately." });
    expect(vetoRes.status).toBe(200);
    expect(vetoRes.body.data.status).toBe("CANCELLED");
  });
});
