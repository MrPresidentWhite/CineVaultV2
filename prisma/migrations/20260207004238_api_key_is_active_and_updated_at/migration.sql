/*
  Warnings:

  - Added the required column `updatedAt` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "isActiveKey" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_isActiveKey_idx" ON "ApiKey"("userId", "isActiveKey");
