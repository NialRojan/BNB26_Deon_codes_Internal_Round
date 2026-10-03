import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Heartbeat Domain & API", () => {
  it("records a heartbeat event for various generic channels (WhatsApp, Push, Email, App check-in)", async () => {
    // 1. Create owner
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "heartbeat_test_owner" });
    const ownerId = ownerRes.body.data.id;

    // 2. WHATSAPP heartbeat
    const whatsappRes = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "WHATSAPP",
        eventType: "RESPONSE_RECEIVED",
        responseStatus: "RECEIVED",
        metadata: { client: "whatsapp_web" },
      });

    expect(whatsappRes.status).toBe(201);
    expect(whatsappRes.body.data.channel).toBe("WHATSAPP");
    expect(whatsappRes.body.data.eventType).toBe("RESPONSE_RECEIVED");

    // 3. PUSH heartbeat
    const pushRes = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "PUSH",
        eventType: "APP_FOREGROUND",
        responseStatus: "RECEIVED",
      });

    expect(pushRes.status).toBe(201);
    expect(pushRes.body.data.channel).toBe("PUSH");

    // 4. EMAIL heartbeat
    const emailRes = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "EMAIL",
        eventType: "MANUAL_CHECKIN",
        responseStatus: "RECEIVED",
      });

    expect(emailRes.status).toBe(201);
    expect(emailRes.body.data.channel).toBe("EMAIL");

    // 5. APP_CHECKIN heartbeat
    const appRes = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "APP_CHECKIN",
        eventType: "MANUAL_CHECKIN",
        responseStatus: "RECEIVED",
      });

    expect(appRes.status).toBe(201);
    expect(appRes.body.data.channel).toBe("APP_CHECKIN");
  });

  it("rejects an invalid channel", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "channel_test_owner" });
    const ownerId = ownerRes.body.data.id;

    const res = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "TELEPATHY", // Invalid channel
        eventType: "MANUAL_CHECKIN",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing eventType", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "event_type_test_owner" });
    const ownerId = ownerRes.body.data.id;

    const res = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "WHATSAPP",
        eventType: "",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retrieves heartbeat history ordered by timestamp descending", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "history_test_owner" });
    const ownerId = ownerRes.body.data.id;

    await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ channel: "WHATSAPP", eventType: "PING_1" });

    await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({ channel: "PUSH", eventType: "PING_2" });

    const historyRes = await request(app)
      .get(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(historyRes.body.data).toHaveLength(2);
    expect(historyRes.body.data[0].eventType).toBe("PING_2");
    expect(historyRes.body.data[1].eventType).toBe("PING_1");
  });

  it("handles duplicate event deduplication using externalEventId idempotently", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "dedup_test_owner" });
    const ownerId = ownerRes.body.data.id;

    const extId = "msg_whatsapp_unique_tx_999";

    const res1 = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "WHATSAPP",
        eventType: "RESPONSE_RECEIVED",
        externalEventId: extId,
      });

    expect(res1.status).toBe(201);
    const eventId = res1.body.data.id;

    // Send identical externalEventId again
    const res2 = await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "WHATSAPP",
        eventType: "RESPONSE_RECEIVED",
        externalEventId: extId,
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.id).toBe(eventId); // Same event returned without duplication
  });
});
