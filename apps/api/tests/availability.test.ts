import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Owner Availability State Machine", () => {
  it("initializes new owner with ACTIVE availability state", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "avail_owner_1" });

    const ownerId = ownerRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/owners/${ownerId}/availability`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe("ACTIVE");
    expect(res.body.data.missedCount).toBe(0);
  });

  it("handles valid state transitions: ACTIVE -> CHECK_IN_PENDING -> MISSED -> WATCH", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "avail_owner_2" });
    const ownerId = ownerRes.body.data.id;

    // 1. ACTIVE -> CHECK_IN_PENDING
    const step1 = await request(app)
      .post(`/api/v1/owners/${ownerId}/availability/transition`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ state: "CHECK_IN_PENDING", reason: "Scheduled heartbeat ping sent" });

    expect(step1.status).toBe(200);
    expect(step1.body.data.state).toBe("CHECK_IN_PENDING");

    // 2. CHECK_IN_PENDING -> MISSED
    const step2 = await request(app)
      .post(`/api/v1/owners/${ownerId}/availability/transition`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ state: "MISSED", reason: "Check-in window expired without response" });

    expect(step2.status).toBe(200);
    expect(step2.body.data.state).toBe("MISSED");
    expect(step2.body.data.missedCount).toBe(1);

    // 3. MISSED -> WATCH (Threshold reached: monitoring required, owner not presumed dead)
    const step3 = await request(app)
      .post(`/api/v1/owners/${ownerId}/availability/transition`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        state: "WATCH",
        reason: "Threshold of missed check-ins reached; recovery monitoring initiated",
      });

    expect(step3.status).toBe(200);
    expect(step3.body.data.state).toBe("WATCH");

    // Check that audit event was recorded for OWNER_ENTERED_WATCH
    const auditRes = await request(app)
      .get(`/api/v1/owners/${ownerId}/audit-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    const watchEvent = auditRes.body.data.find(
      (ev: { eventType: string }) => ev.eventType === "OWNER_ENTERED_WATCH"
    );
    expect(watchEvent).toBeDefined();
    expect(watchEvent.metadata).toContain("WATCH does NOT mean owner is deceased");
  });

  it("rejects an invalid state transition (e.g. directly ACTIVE -> WATCH)", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "avail_owner_3" });
    const ownerId = ownerRes.body.data.id;

    // Direct transition from ACTIVE to WATCH should be rejected
    const invalidRes = await request(app)
      .post(`/api/v1/owners/${ownerId}/availability/transition`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ state: "WATCH", reason: "Skipping intermediate states" });

    expect(invalidRes.status).toBe(422);
    expect(invalidRes.body.success).toBe(false);
    expect(invalidRes.body.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("restores ACTIVE state from WATCH when owner checks in or exercises veto", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "avail_owner_4" });
    const ownerId = ownerRes.body.data.id;

    // Move to WATCH via valid path
    await request(app)
      .post(`/api/v1/owners/${ownerId}/availability/transition`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ state: "CHECK_IN_PENDING" });

    await request(app)
      .post(`/api/v1/owners/${ownerId}/availability/transition`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ state: "MISSED" });

    await request(app)
      .post(`/api/v1/owners/${ownerId}/availability/transition`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ state: "WATCH" });

    // Restore to ACTIVE through heartbeat check-in
    await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "WHATSAPP",
        eventType: "MANUAL_CHECKIN",
        responseStatus: "RECEIVED",
      });

    const restoredAvail = await request(app)
      .get(`/api/v1/owners/${ownerId}/availability`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(restoredAvail.status).toBe(200);
    expect(restoredAvail.body.data.state).toBe("ACTIVE");
    expect(restoredAvail.body.data.missedCount).toBe(0);
  });
});
