-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ON_WATCHLIST', 'VO_UNKNOWN', 'VO_SOON', 'VB_WISHLIST', 'SHIPPING', 'PROCESSING', 'UPLOADED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'STANDARD', 'LOW');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('UHD_4K', 'BLURAY', 'DVD');

-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('DRAMA', 'KOMOEDIE', 'THRILLER', 'SERIE', 'KRIMI', 'HORROR', 'ACTION', 'DOKU', 'ADULT_18', 'DEUTSCHER_FILM', 'ABENTEUER', 'LOVESTORY', 'FANTASY', 'KIDS', 'ANIMATION', 'SCIFI', 'TV_FILM', 'KRIEGSFILM', 'MUSIK', 'WESTERN', 'RATGEBER', 'ANIME', 'BOLLYWOOD');

-- CreateEnum
CREATE TYPE "TVGenre" AS ENUM ('ACTION_ADVENTURE', 'ANIMATION', 'KOMOEDIE', 'KRIMI', 'DOKUMENTARFILM', 'DRAMA', 'FAMILIE', 'KIDS', 'MYSTERY', 'NEWS', 'REALITY', 'SCIFI_FANTASY', 'SOAP', 'TALK', 'WAR_POLITICS', 'WESTERN');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PreferenceMode" AS ENUM ('EXCLUDE');

-- CreateTable
CREATE TABLE "Series" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "originalTitle" VARCHAR(191),
    "firstAirYear" INTEGER,
    "inProduction" BOOLEAN,
    "statusText" VARCHAR(64),
    "posterUrl" VARCHAR(1024),
    "backdropUrl" VARCHAR(1024),
    "accentColor" VARCHAR(12),
    "accentColorBackdrop" VARCHAR(12),
    "tmdbId" INTEGER,
    "homepage" VARCHAR(500),
    "overview" VARCHAR(4000),
    "tagline" VARCHAR(255),
    "fsk" INTEGER,
    "status" "Status" NOT NULL DEFAULT 'ON_WATCHLIST',
    "priority" "Priority" NOT NULL DEFAULT 'STANDARD',
    "assignedToUserId" INTEGER,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "overview" VARCHAR(4000),
    "posterUrl" VARCHAR(1024),
    "accentColor" VARCHAR(12),
    "accentColorBackdrop" VARCHAR(12),
    "airDate" TIMESTAMP(3),
    "tmdbSeasonId" INTEGER,
    "episodeCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" SERIAL NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "overview" VARCHAR(4000),
    "runtimeMin" INTEGER,
    "airDate" TIMESTAMP(3),
    "stillUrl" VARCHAR(1024),
    "accentColor" VARCHAR(12),
    "tmdbEpisodeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkSum" VARCHAR(500),
    "sizeBeforeBytes" BIGINT,
    "sizeAfterBytes" BIGINT,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesGenre" (
    "seriesId" INTEGER NOT NULL,
    "genre" "TVGenre" NOT NULL,

    CONSTRAINT "SeriesGenre_pkey" PRIMARY KEY ("seriesId","genre")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "posterUrl" VARCHAR(1024),
    "coverUrl" VARCHAR(1024),
    "backdropUrl" VARCHAR(1024),
    "accentColor" VARCHAR(12),
    "accentColorBackdrop" VARCHAR(12),
    "overview" VARCHAR(4000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movie" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "runtimeMin" INTEGER NOT NULL,
    "posterUrl" VARCHAR(1024),
    "accentColor" VARCHAR(12),
    "accentColorBackdrop" VARCHAR(12),
    "tmdbId" INTEGER,
    "backdropUrl" VARCHAR(1024),
    "tagline" VARCHAR(255),
    "overview" VARCHAR(4000),
    "status" "Status" NOT NULL DEFAULT 'ON_WATCHLIST',
    "priority" "Priority" NOT NULL DEFAULT 'STANDARD',
    "assignedToUserId" INTEGER,
    "quality" VARCHAR(32),
    "mediaType" "MediaType",
    "fsk" INTEGER,
    "sizeBeforeBytes" BIGINT,
    "sizeAfterBytes" BIGINT,
    "vbSentAt" TIMESTAMP(3),
    "vbReceivedAt" TIMESTAMP(3),
    "videobusterUrl" VARCHAR(500),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkSum" VARCHAR(500),

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieGenre" (
    "movieId" INTEGER NOT NULL,
    "genre" "Genre" NOT NULL,

    CONSTRAINT "MovieGenre_pkey" PRIMARY KEY ("movieId","genre")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "movieId" INTEGER,
    "episodeId" INTEGER,
    "resolution" VARCHAR(32),
    "codec" VARCHAR(64),
    "audio" VARCHAR(64),
    "sizeBytes" BIGINT,
    "path" VARCHAR(1024) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isMasterAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileImageKey" VARCHAR(1024),
    "profileBannerKey" VARCHAR(1024),
    "profileBannerColor" VARCHAR(12),
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "sshPublicKey" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" VARCHAR(191),
    "fingerprint" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastSuccessfulAuth" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "nonce" VARCHAR(255) NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sid" VARCHAR(255) NOT NULL,
    "userId" INTEGER,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_status_preferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ON_WATCHLIST',

    CONSTRAINT "user_status_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieStatusChange" (
    "id" SERIAL NOT NULL,
    "movieId" INTEGER NOT NULL,
    "from" "Status" NOT NULL,
    "to" "Status" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "changedBy" INTEGER,

    CONSTRAINT "MovieStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "description" VARCHAR(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLabel" (
    "id" SERIAL NOT NULL,
    "movieId" INTEGER,
    "seriesId" INTEGER,
    "labelId" INTEGER NOT NULL,

    CONSTRAINT "MediaLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLabelPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "labelId" INTEGER NOT NULL,
    "mode" "PreferenceMode" NOT NULL DEFAULT 'EXCLUDE',

    CONSTRAINT "UserLabelPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Series_tmdbId_key" ON "Series"("tmdbId");

-- CreateIndex
CREATE INDEX "Series_title_idx" ON "Series"("title");

-- CreateIndex
CREATE INDEX "Series_firstAirYear_idx" ON "Series"("firstAirYear");

-- CreateIndex
CREATE INDEX "Series_status_idx" ON "Series"("status");

-- CreateIndex
CREATE INDEX "Series_priority_idx" ON "Series"("priority");

-- CreateIndex
CREATE INDEX "Series_tmdbId_idx" ON "Series"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_tmdbSeasonId_key" ON "Season"("tmdbSeasonId");

-- CreateIndex
CREATE INDEX "Season_seriesId_seasonNumber_idx" ON "Season"("seriesId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Season_seriesId_seasonNumber_key" ON "Season"("seriesId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_tmdbEpisodeId_key" ON "Episode"("tmdbEpisodeId");

-- CreateIndex
CREATE INDEX "Episode_seriesId_seasonNumber_episodeNumber_idx" ON "Episode"("seriesId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE INDEX "Episode_airDate_idx" ON "Episode"("airDate");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_seriesId_seasonNumber_episodeNumber_key" ON "Episode"("seriesId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE INDEX "idx_collection_name" ON "Collection"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");

-- CreateIndex
CREATE INDEX "Movie_collectionId_idx" ON "Movie"("collectionId");

-- CreateIndex
CREATE INDEX "Movie_addedAt_idx" ON "Movie"("addedAt");

-- CreateIndex
CREATE INDEX "Movie_status_idx" ON "Movie"("status");

-- CreateIndex
CREATE INDEX "Movie_priority_idx" ON "Movie"("priority");

-- CreateIndex
CREATE INDEX "Movie_mediaType_idx" ON "Movie"("mediaType");

-- CreateIndex
CREATE INDEX "Movie_fsk_idx" ON "Movie"("fsk");

-- CreateIndex
CREATE INDEX "idx_movie_title" ON "Movie"("title");

-- CreateIndex
CREATE INDEX "File_movieId_idx" ON "File"("movieId");

-- CreateIndex
CREATE INDEX "File_episodeId_idx" ON "File"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallenge_nonce_key" ON "AuthChallenge"("nonce");

-- CreateIndex
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "user_status_preferences_userId_idx" ON "user_status_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_status_preferences_userId_status_key" ON "user_status_preferences"("userId", "status");

-- CreateIndex
CREATE INDEX "MovieStatusChange_movieId_idx" ON "MovieStatusChange"("movieId");

-- CreateIndex
CREATE INDEX "MovieStatusChange_changedAt_idx" ON "MovieStatusChange"("changedAt");

-- CreateIndex
CREATE INDEX "MovieStatusChange_movieId_changedAt_idx" ON "MovieStatusChange"("movieId", "changedAt");

-- CreateIndex
CREATE INDEX "MovieStatusChange_delivered_idx" ON "MovieStatusChange"("delivered");

-- CreateIndex
CREATE UNIQUE INDEX "Label_slug_key" ON "Label"("slug");

-- CreateIndex
CREATE INDEX "MediaLabel_movieId_idx" ON "MediaLabel"("movieId");

-- CreateIndex
CREATE INDEX "MediaLabel_seriesId_idx" ON "MediaLabel"("seriesId");

-- CreateIndex
CREATE INDEX "MediaLabel_labelId_idx" ON "MediaLabel"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaLabel_movieId_labelId_key" ON "MediaLabel"("movieId", "labelId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaLabel_seriesId_labelId_key" ON "MediaLabel"("seriesId", "labelId");

-- CreateIndex
CREATE INDEX "UserLabelPreference_userId_mode_idx" ON "UserLabelPreference"("userId", "mode");

-- CreateIndex
CREATE INDEX "UserLabelPreference_labelId_idx" ON "UserLabelPreference"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLabelPreference_userId_labelId_mode_key" ON "UserLabelPreference"("userId", "labelId", "mode");

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesGenre" ADD CONSTRAINT "SeriesGenre_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieGenre" ADD CONSTRAINT "MovieGenre_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_status_preferences" ADD CONSTRAINT "user_status_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieStatusChange" ADD CONSTRAINT "MovieStatusChange_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieStatusChange" ADD CONSTRAINT "MovieStatusChange_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLabel" ADD CONSTRAINT "MediaLabel_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLabel" ADD CONSTRAINT "MediaLabel_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLabel" ADD CONSTRAINT "MediaLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLabelPreference" ADD CONSTRAINT "UserLabelPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLabelPreference" ADD CONSTRAINT "UserLabelPreference_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
