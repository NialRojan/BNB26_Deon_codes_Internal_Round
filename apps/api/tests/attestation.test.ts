import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Guardian Attestation Domain & API", () => {
  it("submits a guardian attestation and retrieves attestation list", async () => {
    // 1. Create owner and recovery attempt
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "attest_owner_1" });
    const ownerId = ownerRes.body.data.id;

    const recoveryRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Owner unavailable",
        source: "GUARDIAN_CHECK",
      });
    const recoveryId = recoveryRes.body.data.id;

    // 2. Submit attestation from Guardian 1
    const attest1Res = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/attestations`)
      .set("Authorization", "Bearer test-guardian-token-guardian_alpha")
      .send({
        guardianId: "guardian_alpha",
        status: "VALID",
        signature: "0x_sig_placeholder_for_member_2",
        metadata: { clientVersion: "1.0.0" },
      });

    expect(attest1Res.status).toBe(201);
    expect(attest1Res.body.success).toBe(true);
    expect(attest1Res.body.data.guardianId).toBe("guardian_alpha");
    expect(attest1Res.body.data.status).toBe("VALID");

    // 3. Submit attestation from Guardian 2
    const attest2Res = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/attestations`)
      .set("Authorization", "Bearer test-guardian-token-guardian_beta")
      .send({
        guardianId: "guardian_beta",
        status: "VALID",
        signature: "0x_sig_beta_placeholder",
      });

    expect(attest2Res.status).toBe(201);
    expect(attest2Res.body.data.guardianId).toBe("guardian_beta");

    // 4. Retrieve attestations for this recovery attempt
    const listRes = await request(app)
      .get(`/api/v1/recovery/${recoveryId}/attestations`)
      .set("Authorization", "Bearer test-admin-token");

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
  });

  it("rejects duplicate attestation submission from the same guardian on the same recovery attempt", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "attest_owner_2" });
    const ownerId = ownerRes.body.data.id;

    const recoveryRes = await request(app)
      .post("/api/v1/recovery")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        ownerId,
        reason: "Owner unavailable",
        source: "GUARDIAN_CHECK",
      });
    const recoveryId = recoveryRes.body.data.id;

    // First submission
    await request(app)
      .post(`/api/v1/recovery/${recoveryId}/attestations`)
      .set("Authorization", "Bearer test-guardian-token-guardian_gamma")
      .send({
        guardianId: "guardian_gamma",
        status: "SUBMITTED",
      });

    // Duplicate submission
    const duplicateRes = await request(app)
      .post(`/api/v1/recovery/${recoveryId}/attestations`)
      .set("Authorization", "Bearer test-guardian-token-guardian_gamma")
      .send({
        guardianId: "guardian_gamma",
        status: "VALID",
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.success).toBe(false);
    expect(duplicateRes.body.error.code).toBe("CONFLICT");
  });

  it("rejects attestation on non-existent recovery attempt", async () => {
    const res = await request(app)
      .post("/api/v1/recovery/non-existent-recovery-id/attestations")
      .set("Authorization", "Bearer test-guardian-token-guardian_gamma")
      .send({
        guardianId: "guardian_gamma",
        status: "VALID",
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
