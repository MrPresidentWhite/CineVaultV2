-- CreateEnum
CREATE TYPE "AuthFailureType" AS ENUM ('LOGIN', 'TWO_FA');

-- CreateTable
CREATE TABLE "LoginFailure" (
    "id" SERIAL NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "type" "AuthFailureType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginFailure_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LoginFailure_ipAddress_createdAt_idx" ON "LoginFailure"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "LoginFailure_identifier_createdAt_idx" ON "LoginFailure"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "LoginFailure_createdAt_idx" ON "LoginFailure"("createdAt");
