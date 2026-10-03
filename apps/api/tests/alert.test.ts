import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Alert Domain & API", () => {
  it("creates an alert across multiple notification channels and lists by owner", async () => {
    // 1. Create owner
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "alert_owner_1" });
    const ownerId = ownerRes.body.data.id;

    // 2. Create Email Alert
    const emailAlertRes = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        type: "HEARTBEAT_REMINDER",
        severity: "INFO",
        recipient: "owner@example.com",
        channel: "EMAIL",
        metadata: { reminderIndex: 1 },
      });

    expect(emailAlertRes.status).toBe(201);
    expect(emailAlertRes.body.data.channel).toBe("EMAIL");
    expect(emailAlertRes.body.data.status).toBe("PENDING");

    // 3. Create WhatsApp Alert
    const waAlertRes = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        type: "WATCH_ENTERED",
        severity: "WARNING",
        recipient: "+1234567890",
        channel: "WHATSAPP",
      });

    expect(waAlertRes.status).toBe(201);
    expect(waAlertRes.body.data.channel).toBe("WHATSAPP");

    // 4. Retrieve alerts for this owner
    const listRes = await request(app)
      .get(`/api/v1/owners/${ownerId}/alerts`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
  });

  it("rejects alert creation with unsupported channel", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "alert_owner_2" });
    const ownerId = ownerRes.body.data.id;

    const res = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        type: "GENERIC",
        severity: "INFO",
        recipient: "fax_number",
        channel: "FAX_MACHINE",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
