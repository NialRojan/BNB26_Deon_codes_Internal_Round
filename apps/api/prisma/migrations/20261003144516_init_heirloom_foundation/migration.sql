-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OwnerAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastHeartbeatAt" DATETIME,
    "nextCheckInDueAt" DATETIME,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "stateReason" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnerAvailability_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeartbeatEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "externalEventId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeartbeatEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecoveryAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "initiatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "riskScore" REAL NOT NULL DEFAULT 0.0,
    "riskLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecoveryAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuardianAttestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recoveryAttemptId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "signature" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianAttestation_recoveryAttemptId_fkey" FOREIGN KEY ("recoveryAttemptId") REFERENCES "RecoveryAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recoveryAttemptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskEvent_recoveryAttemptId_fkey" FOREIGN KEY ("recoveryAttemptId") REFERENCES "RecoveryAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "recoveryAttemptId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_recoveryAttemptId_fkey" FOREIGN KEY ("recoveryAttemptId") REFERENCES "RecoveryAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_externalReference_key" ON "Owner"("externalReference");

-- CreateIndex
CREATE INDEX "Owner_status_idx" ON "Owner"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerAvailability_ownerId_key" ON "OwnerAvailability"("ownerId");

-- CreateIndex
CREATE INDEX "OwnerAvailability_state_idx" ON "OwnerAvailability"("state");

-- CreateIndex
CREATE UNIQUE INDEX "HeartbeatEvent_externalEventId_key" ON "HeartbeatEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "HeartbeatEvent_ownerId_timestamp_idx" ON "HeartbeatEvent"("ownerId", "timestamp");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_ownerId_status_idx" ON "RecoveryAttempt"("ownerId", "status");

-- CreateIndex
CREATE INDEX "RecoveryAttempt_status_idx" ON "RecoveryAttempt"("status");

-- CreateIndex
CREATE INDEX "GuardianAttestation_recoveryAttemptId_idx" ON "GuardianAttestation"("recoveryAttemptId");

-- CreateIndex
CREATE INDEX "GuardianAttestation_guardianId_idx" ON "GuardianAttestation"("guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianAttestation_recoveryAttemptId_guardianId_key" ON "GuardianAttestation"("recoveryAttemptId", "guardianId");

-- CreateIndex
CREATE INDEX "RiskEvent_recoveryAttemptId_timestamp_idx" ON "RiskEvent"("recoveryAttemptId", "timestamp");

-- CreateIndex
CREATE INDEX "RiskEvent_type_idx" ON "RiskEvent"("type");

-- CreateIndex
CREATE INDEX "Alert_ownerId_status_idx" ON "Alert"("ownerId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_entityId_idx" ON "AuditEvent"("entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");
