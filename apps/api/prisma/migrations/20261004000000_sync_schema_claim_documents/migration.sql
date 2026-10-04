-- CreateTable
CREATE TABLE IF NOT EXISTS "ClaimDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recoveryAttemptId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "issuingAuthority" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "documentDate" DATETIME NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedBy" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "rejectionReason" TEXT,
    "rawContent" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClaimDocument_recoveryAttemptId_fkey" FOREIGN KEY ("recoveryAttemptId") REFERENCES "RecoveryAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OwnerAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastHeartbeatAt" DATETIME,
    "nextCheckInDueAt" DATETIME,
    "heartbeatIntervalDays" INTEGER NOT NULL DEFAULT 30,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "stateReason" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnerAvailability_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OwnerAvailability" ("id", "lastHeartbeatAt", "missedCount", "nextCheckInDueAt", "ownerId", "state", "stateReason", "updatedAt") SELECT "id", "lastHeartbeatAt", "missedCount", "nextCheckInDueAt", "ownerId", "state", "stateReason", "updatedAt" FROM "OwnerAvailability";
DROP TABLE "OwnerAvailability";
ALTER TABLE "new_OwnerAvailability" RENAME TO "OwnerAvailability";
CREATE UNIQUE INDEX "OwnerAvailability_ownerId_key" ON "OwnerAvailability"("ownerId");
CREATE INDEX "OwnerAvailability_state_idx" ON "OwnerAvailability"("state");
CREATE INDEX "OwnerAvailability_nextCheckInDueAt_idx" ON "OwnerAvailability"("nextCheckInDueAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClaimDocument_recoveryAttemptId_idx" ON "ClaimDocument"("recoveryAttemptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClaimDocument_verificationStatus_idx" ON "ClaimDocument"("verificationStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_ownerId_type_channel_status_idx" ON "Alert"("ownerId", "type", "channel", "status");
