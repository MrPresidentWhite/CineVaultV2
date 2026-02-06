-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "environment" VARCHAR(10) NOT NULL DEFAULT 'prod';

-- CreateIndex
CREATE INDEX "Session_environment_idx" ON "Session"("environment");
