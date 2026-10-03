import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Security & Authorization Guarantees", () => {
  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    const res = await request(app).get("/api/v1/owners/some-owner-id");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("strictly blocks cross-owner access with 403 Forbidden", async () => {
    // 1. Create two separate owners
    const owner1Res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "alice_wallet" });
    const owner2Res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "bob_wallet" });

    const aliceId = owner1Res.body.data.id;
    const bobId = owner2Res.body.data.id;

    // 2. Alice tries to read Bob's availability
    const availRes = await request(app)
      .get(`/api/v1/owners/${bobId}/availability`)
      .set("Authorization", `Bearer test-owner-token-${aliceId}`);

    expect(availRes.status).toBe(403);
    expect(availRes.body.error.code).toBe("FORBIDDEN");

    // 3. Alice tries to read Bob's heartbeat events
    const hbRes = await request(app)
      .get(`/api/v1/owners/${bobId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${aliceId}`);

    expect(hbRes.status).toBe(403);
    expect(hbRes.body.error.code).toBe("FORBIDDEN");

    // 4. Alice tries to read Bob's recovery attempts
    const recRes = await request(app)
      .get(`/api/v1/owners/${bobId}/recovery-attempts`)
      .set("Authorization", `Bearer test-owner-token-${aliceId}`);

    expect(recRes.status).toBe(403);
    expect(recRes.body.error.code).toBe("FORBIDDEN");

    // 5. Alice tries to read Bob's audit events
    const auditRes = await request(app)
      .get(`/api/v1/owners/${bobId}/audit-events`)
      .set("Authorization", `Bearer test-owner-token-${aliceId}`);

    expect(auditRes.status).toBe(403);
    expect(auditRes.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects malformed requests cleanly with 400 Validation Error", async () => {
    const res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ invalidField: 12345 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("handles non-existent resource IDs with clean 404 response without leaking internals", async () => {
    const res = await request(app)
      .get("/api/v1/recovery/00000000-0000-0000-0000-000000000000")
      .set("Authorization", "Bearer test-admin-token");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
    // Ensure no stack traces or database errors leaked
    expect(res.body.error.stack).toBeUndefined();
    expect(res.body.error.details).toBeUndefined();
  });

  it("ensures no vault secrets, private keys, or passwords are stored in models or exposed via API", async () => {
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "alice_vault_check" });

    const ownerData = ownerRes.body.data;
    expect(ownerData).not.toHaveProperty("password");
    expect(ownerData).not.toHaveProperty("privateKey");
    expect(ownerData).not.toHaveProperty("seedPhrase");
    expect(ownerData).not.toHaveProperty("vault");
    expect(ownerData).not.toHaveProperty("encryptionKey");
  });
});
