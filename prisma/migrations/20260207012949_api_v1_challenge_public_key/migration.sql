-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "publicKeySsh" TEXT;

-- AlterTable
ALTER TABLE "AuthChallenge" ADD COLUMN     "usedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ApiKey_fingerprint_idx" ON "ApiKey"("fingerprint");

-- CreateIndex
CREATE INDEX "AuthChallenge_apiKeyId_idx" ON "AuthChallenge"("apiKeyId");
