import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("Owner Domain & API", () => {
  it("creates a new owner and returns 201 with initial ACTIVE status", async () => {
    const res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({
        externalReference: "wallet_0x1234567890abcdef",
        status: "ACTIVE",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.externalReference).toBe("wallet_0x1234567890abcdef");
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.availability).toBeDefined();
    expect(res.body.data.availability.state).toBe("ACTIVE");
  });

  it("retrieves an existing owner by ID", async () => {
    // Create owner
    const createRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "user_owner_abc" });

    const ownerId = createRes.body.data.id;

    // Retrieve owner as that owner
    const getRes = await request(app)
      .get(`/api/v1/owners/${ownerId}`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.id).toBe(ownerId);
    expect(getRes.body.data.externalReference).toBe("user_owner_abc");
  });

  it("rejects creating an owner with duplicate externalReference", async () => {
    await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "duplicate_ref" });

    const duplicateRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "duplicate_ref" });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.success).toBe(false);
    expect(duplicateRes.body.error.code).toBe("CONFLICT");
  });

  it("rejects creating an owner with empty externalReference", async () => {
    const res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for non-existent owner ID", async () => {
    const res = await request(app)
      .get("/api/v1/owners/non-existent-uuid")
      .set("Authorization", "Bearer test-admin-token");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("enforces cross-owner authorization (owner cannot access another owner)", async () => {
    const owner1Res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "owner_1" });
    const owner2Res = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "owner_2" });

    const owner1Id = owner1Res.body.data.id;
    const owner2Id = owner2Res.body.data.id;

    // Owner 1 attempts to access Owner 2
    const res = await request(app)
      .get(`/api/v1/owners/${owner2Id}`)
      .set("Authorization", `Bearer test-owner-token-${owner1Id}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
