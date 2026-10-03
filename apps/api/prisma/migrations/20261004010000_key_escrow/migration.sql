-- CreateTable
CREATE TABLE "EscrowKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vaultAddress" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SealedSecret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vaultAddress" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EscrowShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secretId" TEXT NOT NULL,
    "guardian" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "encryptedShare" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscrowShare_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "SealedSecret" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrowKey_vaultAddress_address_role_key" ON "EscrowKey"("vaultAddress", "address", "role");

-- CreateIndex
CREATE INDEX "SealedSecret_vaultAddress_idx" ON "SealedSecret"("vaultAddress");

-- CreateIndex
CREATE INDEX "EscrowShare_recipient_kind_idx" ON "EscrowShare"("recipient", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowShare_secretId_guardian_recipient_kind_key" ON "EscrowShare"("secretId", "guardian", "recipient", "kind");
