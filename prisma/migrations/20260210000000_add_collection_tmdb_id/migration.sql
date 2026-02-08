-- AlterTable
ALTER TABLE "Collection" ADD COLUMN "tmdbId" INTEGER;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Collection_tmdbId_key" ON "Collection"("tmdbId");
