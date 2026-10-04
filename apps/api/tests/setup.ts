import { beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "../src/database/prisma.js";

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean up tables in reverse foreign key order
  await prisma.firmClient.deleteMany({});
  await prisma.firm.deleteMany({});
  await prisma.auditEvent.updateMany({ data: { anchorBatchId: null, anchorSeq: null } });
  await prisma.auditAnchorBatch.deleteMany({});
  await prisma.escrowShare.deleteMany({});
  await prisma.sealedSecret.deleteMany({});
  await prisma.escrowKey.deleteMany({});
  await prisma.auditEvent.deleteMany({});
  await prisma.riskEvent.deleteMany({});
  await prisma.guardianAttestation.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.recoveryAttempt.deleteMany({});
  await prisma.heartbeatEvent.deleteMany({});
  await prisma.ownerAvailability.deleteMany({});
  await prisma.owner.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});
