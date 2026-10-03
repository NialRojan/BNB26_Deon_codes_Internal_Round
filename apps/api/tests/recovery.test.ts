import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Recovery Attempt Domain & API", () => {
  it("initiates a new recovery attempt with PENDING status and UNKNOWN risk level", async () => {
    // 1. Create owner
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "recovery_owner_1" });
    const ownerId = ownerRes.body.data.id;

    // 2. Initiate recovery
    const res = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Owner missed 3 consecutive check-ins and entered WATCH",
        source: "GUARDIAN_CONSENSUS_INITIATION",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.riskLevel).toBe("UNKNOWN");
    expect(res.body.data.riskScore).toBe(0.0);
    expect(res.body.data.ownerId).toBe(ownerId);
  });

  it("retrieves a recovery attempt by ID and lists for owner", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "recovery_owner_2" });
    const ownerId = ownerRes.body.data.id;

    const createRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Heir submitted death claim",
        source: "HEIR_REQUEST",
      });
    const recoveryId = createRes.body.data.id;

    // Retrieve by ID
    const getRes = await request(app)
      .get(`/api/v1/recovery/${recoveryId}`)
      .set("Authorization", "Bearer test-admin-token");

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(recoveryId);

    // List by owner
    const listRes = await request(app)
      .get(`/api/v1/owners/${ownerId}/recovery-attempts`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(recoveryId);
  });

  it("prevents creating duplicate concurrent active recovery attempts for the same owner", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "recovery_owner_3" });
    const ownerId = ownerRes.body.data.id;

    // First recovery attempt
    await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "First attempt",
        source: "GUARDIAN_INITIATED",
      });

    // Second recovery attempt while first is still pending
    const conflictRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Second attempt",
        source: "GUARDIAN_INITIATED",
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.error.code).toBe("CONFLICT");
  });

  it("supports cancellation (Owner Veto) and resets owner availability to ACTIVE", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "recovery_owner_4" });
    const ownerId = ownerRes.body.data.id;

    const createRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Unresponsive owner",
        source: "SYSTEM_WATCH_ESCALATION",
      });
    const recoveryId = createRes.body.data.id;

    // Owner vetoes recovery attempt
    const cancelRes = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/cancel`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        cancelReason: "I am alive and well, false recovery trigger",
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("CANCELLED");
    expect(cancelRes.body.data.cancelReason).toContain("false recovery trigger");

    // Check availability was restored to ACTIVE
    const availRes = await request(app)
      .get(`/api/v1/owners/${ownerId}/availability`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(availRes.body.data.state).toBe("ACTIVE");

    // Check audit logs for OWNER_VETO_RECEIVED
    const auditRes = await request(app)
      .get(`/api/v1/owners/${ownerId}/audit-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    const vetoEvent = auditRes.body.data.find(
      (ev: { eventType: string }) => ev.eventType === "OWNER_VETO_RECEIVED"
    );
    expect(vetoEvent).toBeDefined();
  });

  it("forbids non-owner from cancelling recovery attempt (cross-owner veto prevention)", async () => {
    const owner1Res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "owner_veto_1" });
    const owner2Res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "owner_veto_2" });

    const owner1Id = owner1Res.body.data.id;
    const owner2Id = owner2Res.body.data.id;

    const createRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId: owner1Id,
        reason: "Claim initiated",
        source: "HEIR",
      });
    const recoveryId = createRes.body.data.id;

    // Owner 2 attempts to cancel Owner 1's recovery
    const res = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/cancel`)
      .set("Authorization", `Bearer test-owner-token-${owner2Id}`)
      .send({ cancelReason: "Malicious veto attempt" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
