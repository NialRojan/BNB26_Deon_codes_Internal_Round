import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AuditService } from "../src/services/auditService.js";

const app = createApp();
const auditService = new AuditService();

describe("Audit Event Domain & API (Append-Only Mechanism)", () => {
  it("records and retrieves audit events across actions in the lifecycle", async () => {
    // 1. Create owner (triggers OWNER_CREATED)
    const ownerRes = await request(app)
      .post("/api/v1/owners")
      .set("Authorization", "Bearer test-admin-token")
      .send({ externalReference: "audit_owner_1" });
    const ownerId = ownerRes.body.data.id;

    // 2. Heartbeat (triggers HEARTBEAT_RECEIVED)
    await request(app)
      .post(`/api/v1/owners/${ownerId}/heartbeat-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`)
      .send({
        channel: "WHATSAPP",
        eventType: "SCHEDULED_PING",
      });

    // 3. Retrieve audit events for this owner
    const auditRes = await request(app)
      .get(`/api/v1/owners/${ownerId}/audit-events`)
      .set("Authorization", `Bearer test-owner-token-${ownerId}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.success).toBe(true);

    const eventTypes = auditRes.body.data.map((e: { eventType: string }) => e.eventType);
    expect(eventTypes).toContain("OWNER_CREATED");
    expect(eventTypes).toContain("HEARTBEAT_RECEIVED");
  });

  it("verifies audit events cannot be modified or deleted via API endpoints (no PUT/PATCH/DELETE)", async () => {
    // Attempting to PUT, PATCH, or DELETE an audit event should yield 404 (route not found)
    const putRes = await request(app)
      .put("/api/v1/owners/some-owner/audit-events/123")
      .set("Authorization", "Bearer test-admin-token")
      .send({ eventType: "TAMPERED_EVENT" });

    expect(putRes.status).toBe(404);

    const patchRes = await request(app)
      .patch("/api/v1/owners/some-owner/audit-events/123")
      .set("Authorization", "Bearer test-admin-token")
      .send({ eventType: "TAMPERED_EVENT" });

    expect(patchRes.status).toBe(404);

    const delRes = await request(app)
      .delete("/api/v1/owners/some-owner/audit-events/123")
      .set("Authorization", "Bearer test-admin-token");

    expect(delRes.status).toBe(404);
  });

  it("sanitizes metadata to ensure vault secrets or passwords are never stored in audit logs", async () => {
    const event = await auditService.recordEvent({
      eventType: "OWNER_CREATED",
      actorId: "owner_secure_1",
      actorType: "OWNER",
      entityId: "owner_secure_1",
      entityType: "Owner",
      metadata: {
        safeField: "heirloom_vault",
        secret: "my_super_secret_seed_phrase",
        vaultPlaintext: "secret_document_content",
        password: "owner_password_123",
      },
    });

    expect(event.metadata).toBeDefined();
    const parsed = JSON.parse(event.metadata!);
    expect(parsed.safeField).toBe("heirloom_vault");
    expect(parsed.secret).toBeUndefined();
    expect(parsed.vaultPlaintext).toBeUndefined();
    expect(parsed.password).toBeUndefined();
  });
});
