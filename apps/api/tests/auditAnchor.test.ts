import { describe, it, expect } from "vitest";
import request from "supertest";
import type { Hex } from "viem";
import { verifyProof } from "@heirloom/shared";
import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { AuditAnchorService, auditHealth, proofForRecord, type AnchorWriter } from "../src/chain/auditAnchor.js";
import { AuditRepository } from "../src/repositories/auditRepository.js";

/** In-memory stand-in for HeirloomAuditAnchor: same contiguity rule, records roots. */
function fakeWriter() {
  const roots: Hex[] = [];
  let next = 0;
  const w: AnchorWriter & { roots: Hex[] } = {
    contract: "0x00000000000000000000000000000000000a11ce",
    chainId: 11155111,
    roots,
    nextSeq: async () => next,
    anchor: async (root, firstSeq, count) => {
      if (firstSeq !== next) throw new Error("NonContiguous");
      roots.push(root);
      next = firstSeq + count;
      return { batchId: roots.length - 1, txHash: `0xtx${roots.length - 1}` };
    },
  };
  return w;
}

const repo = new AuditRepository();
const add = (eventType: string) =>
  repo.create({ eventType, actorId: "0xabc", actorType: "SYSTEM", entityId: "0xvault", entityType: "Owner", metadata: { contract: "0xvault", n: eventType } });

describe("Audit log anchoring (HeirloomAuditAnchor)", () => {
  it("anchors pending records in contiguous batches and proves each one", async () => {
    const writer = fakeWriter();
    const svc = new AuditAnchorService(writer, prisma);
    for (const t of ["A", "B", "C"]) await add(t);

    const b0 = await svc.anchorPending();
    expect(b0).toMatchObject({ batchId: 0, firstSeq: 0, count: 3 });
    expect(await svc.anchorPending()).toBeNull(); // nothing new

    for (const t of ["D", "E"]) await add(t);
    const b1 = await svc.anchorPending();
    expect(b1).toMatchObject({ batchId: 1, firstSeq: 3, count: 2 });

    const all = await prisma.auditEvent.findMany({ orderBy: { anchorSeq: "asc" } });
    expect(all.map((e) => e.anchorSeq)).toEqual([0, 1, 2, 3, 4]);
    for (const e of all) {
      const p = await proofForRecord(e.id, prisma);
      expect(p?.anchored).toBe(true);
      if (!p?.anchored) continue;
      expect(p.matchesAnchoredRoot).toBe(true);
      expect(verifyProof(p.recordHash, p.proof, writer.roots[p.batchId]!)).toBe(true);
    }
  });

  it("detects a record edited after anchoring", async () => {
    const svc = new AuditAnchorService(fakeWriter(), prisma);
    const ev = await add("GUARDIAN_ATTESTATION_RECEIVED");
    await add("RECOVERY_INITIATED");
    await svc.anchorPending();

    await prisma.auditEvent.update({ where: { id: ev.id }, data: { eventType: "NOTHING_HAPPENED" } }); // tamper
    const p = await proofForRecord(ev.id, prisma);
    expect(p?.anchored && p.matchesAnchoredRoot).toBe(false);
  });

  it("exposes anchors and proofs over the API", async () => {
    const app = createApp();
    const ev = await add("HEARTBEAT_RECEIVED");
    let res = await request(app).get(`/api/v1/audit/proof/${ev.id}`);
    expect(res.body.data.anchored).toBe(false);

    await new AuditAnchorService(fakeWriter(), prisma).anchorPending();
    res = await request(app).get(`/api/v1/audit/proof/${ev.id}`);
    expect(res.body.data).toMatchObject({ anchored: true, batchId: 0, matchesAnchoredRoot: true });

    const anchors = await request(app).get("/api/v1/audit/anchors");
    expect(anchors.body.data.batches).toHaveLength(1);
    expect(anchors.body.data.pendingRecords).toBe(0);
  });

  it("health: silent when all is well, flags tampering, deletions and stalled anchoring", async () => {
    const svc = new AuditAnchorService(fakeWriter(), prisma);
    const a = await add("A");
    const b = await add("B");
    await svc.anchorPending();
    let h = await auditHealth(prisma, { anchoringEnabled: true, intervalMs: 300000 });
    expect(h.ok).toBe(true);
    expect(h.issues).toHaveLength(0);

    await prisma.auditEvent.update({ where: { id: a.id }, data: { actorId: "0xforged" } });
    h = await auditHealth(prisma, { anchoringEnabled: true, intervalMs: 300000 });
    expect(h.ok).toBe(false);
    expect(h.issues[0]!.severity).toBe("critical");
    expect(h.issues[0]!.message).toContain("changed after");

    await prisma.auditEvent.delete({ where: { id: b.id } });
    h = await auditHealth(prisma, { anchoringEnabled: true, intervalMs: 300000 });
    expect(h.issues.some((i) => i.message.includes("missing"))).toBe(true);

    await add("C"); // waiting, and pretend 20 minutes passed with no anchor
    h = await auditHealth(prisma, { anchoringEnabled: true, intervalMs: 300000, now: Date.now() + 20 * 60000 });
    expect(h.issues.some((i) => i.severity === "warning" && i.message.includes("behind"))).toBe(true);
    h = await auditHealth(prisma, { anchoringEnabled: false, intervalMs: 300000, now: Date.now() + 20 * 60000 });
    expect(h.issues.some((i) => i.message.includes("behind"))).toBe(false);
  });
});
