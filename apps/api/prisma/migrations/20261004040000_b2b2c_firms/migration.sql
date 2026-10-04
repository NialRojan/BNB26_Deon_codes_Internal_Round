-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lawyerName" TEXT NOT NULL,
    "license" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FirmClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "creationTx" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientWallet" TEXT NOT NULL,
    "heirs" TEXT NOT NULL,
    "guardians" TEXT NOT NULL,
    "executorLabel" TEXT,
    "assets" TEXT NOT NULL DEFAULT '[]',
    "onboardingToken" TEXT NOT NULL,
    "certStatus" TEXT NOT NULL DEFAULT 'None',
    "certFileName" TEXT,
    "certHash" TEXT,
    "certUploadedBy" TEXT,
    "certUploadedAt" DATETIME,
    "certReviewedBy" TEXT,
    "certReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FirmClient_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Firm_wallet_key" ON "Firm"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "FirmClient_vaultAddress_key" ON "FirmClient"("vaultAddress");

-- CreateIndex
CREATE UNIQUE INDEX "FirmClient_onboardingToken_key" ON "FirmClient"("onboardingToken");

-- CreateIndex
CREATE INDEX "FirmClient_firmId_idx" ON "FirmClient"("firmId");

-- CreateIndex
CREATE INDEX "FirmClient_clientWallet_idx" ON "FirmClient"("clientWallet");
