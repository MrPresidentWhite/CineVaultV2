-- CreateTable
CREATE TABLE "MovieAdditionalAssignee" (
    "movieId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "MovieAdditionalAssignee_pkey" PRIMARY KEY ("movieId","userId")
);

-- CreateIndex
CREATE INDEX "MovieAdditionalAssignee_userId_idx" ON "MovieAdditionalAssignee"("userId");

-- AddForeignKey
ALTER TABLE "MovieAdditionalAssignee" ADD CONSTRAINT "MovieAdditionalAssignee_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieAdditionalAssignee" ADD CONSTRAINT "MovieAdditionalAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
