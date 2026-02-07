-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "statusScheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Movie_status_statusScheduledAt_idx" ON "Movie"("status", "statusScheduledAt");
