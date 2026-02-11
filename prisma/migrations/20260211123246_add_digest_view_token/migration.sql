-- CreateTable
CREATE TABLE "digest_view_tokens" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(48) NOT NULL,
    "html" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digest_view_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digest_view_tokens_token_key" ON "digest_view_tokens"("token");

-- CreateIndex
CREATE INDEX "digest_view_tokens_token_idx" ON "digest_view_tokens"("token");

-- CreateIndex
CREATE INDEX "digest_view_tokens_expiresAt_idx" ON "digest_view_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "digest_view_tokens" ADD CONSTRAINT "digest_view_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
