import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Risk Event Domain & API (Fraud Engine Foundation)", () => {
  it("records generic risk events and calculates baseline risk profile", async () => {
    // 1. Create owner and recovery attempt
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "risk_owner_1" });
    const ownerId = ownerRes.body.data.id;

    const recoveryRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Claim initiated",
        source: "PORTAL",
      });
    const recoveryId = recoveryRes.body.data.id;

    // 2. Record TRIGGER_ANOMALY
    const risk1Res = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/risk-events`)
      .set("Authorization", "Bearer test-admin-token")
      .send({
        type: "TRIGGER_ANOMALY",
        severity: "MEDIUM",
        score: 0.45,
        metadata: { anomalyIndicator: "ip_velocity_spike" },
      });

    expect(risk1Res.status).toBe(201);
    expect(risk1Res.body.data.type).toBe("TRIGGER_ANOMALY");
    expect(risk1Res.body.data.severity).toBe("MEDIUM");

    // 3. Record GUARDIAN_COLLUSION
    const risk2Res = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/risk-events`)
      .set("Authorization", "Bearer test-admin-token")
      .send({
        type: "GUARDIAN_COLLUSION",
        severity: "HIGH",
        score: 0.85,
        metadata: { coLocatedGuardians: ["g1", "g2"] },
      });

    expect(risk2Res.status).toBe(201);
    expect(risk2Res.body.data.type).toBe("GUARDIAN_COLLUSION");

    // 4. Retrieve risk events for this recovery attempt
    const listRes = await request(app)
      .get(`/api/v1/recovery/${recoveryId}/risk-events`)
      .set("Authorization", "Bearer test-admin-token");

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);

    // 5. Query risk profile placeholder
    const profileRes = await request(app)
      .get(`/api/v1/recovery/${recoveryId}/risk-profile`)
      .set("Authorization", "Bearer test-admin-token");

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.level).toBe("HIGH"); // Because score > 0.7 or HIGH severity event present
  });

  it("rejects risk event with invalid severity or out-of-range score", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "risk_owner_2" });
    const ownerId = ownerRes.body.data.id;

    const recoveryRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Claim initiated",
        source: "PORTAL",
      });
    const recoveryId = recoveryRes.body.data.id;

    // Invalid severity
    const invalidSevRes = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/risk-events`)
      .set("Authorization", "Bearer test-admin-token")
      .send({
        type: "BEHAVIOR_DEVIATION",
        severity: "EXTREME_SUPER_BAD",
        score: 0.5,
      });

    expect(invalidSevRes.status).toBe(400);
    expect(invalidSevRes.body.error.code).toBe("VALIDATION_ERROR");

    // Invalid score (> 1.0)
    const invalidScoreRes = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/risk-events`)
      .set("Authorization", "Bearer test-admin-token")
      .send({
        type: "BEHAVIOR_DEVIATION",
        severity: "HIGH",
        score: 9.99,
      });

    expect(invalidScoreRes.status).toBe(400);
    expect(invalidScoreRes.body.error.code).toBe("VALIDATION_ERROR");
  });
});
