-- CreateTable
CREATE TABLE "AuditAnchorBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "root" TEXT NOT NULL,
    "firstSeq" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anchorSeq" INTEGER,
    "anchorBatchId" INTEGER,
    CONSTRAINT "AuditEvent_anchorBatchId_fkey" FOREIGN KEY ("anchorBatchId") REFERENCES "AuditAnchorBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditEvent" ("actorId", "actorType", "createdAt", "entityId", "entityType", "eventType", "id", "metadata", "timestamp") SELECT "actorId", "actorType", "createdAt", "entityId", "entityType", "eventType", "id", "metadata", "timestamp" FROM "AuditEvent";
DROP TABLE "AuditEvent";
ALTER TABLE "new_AuditEvent" RENAME TO "AuditEvent";
CREATE UNIQUE INDEX "AuditEvent_anchorSeq_key" ON "AuditEvent"("anchorSeq");
CREATE INDEX "AuditEvent_entityId_idx" ON "AuditEvent"("entityId");
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");
CREATE INDEX "AuditEvent_anchorBatchId_idx" ON "AuditEvent"("anchorBatchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
