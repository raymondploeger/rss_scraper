-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "feeds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rssUrl" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'rss',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastError" TEXT,
    "lastInsertedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL,
    "canonicalLink" TEXT,
    "pubDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "feedName" TEXT NOT NULL,
    "thumbnail" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "summaryShort" TEXT NOT NULL DEFAULT '',
    "contentSnippet" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOf" TEXT,
    "duplicateGroupId" TEXT,
    "clusterId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'unknown',
    "fetchStatus" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_logs" (
    "id" SERIAL NOT NULL,
    "feedId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "newArticles" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "poll_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feeds_rssUrl_key" ON "feeds"("rssUrl");

-- CreateIndex
CREATE INDEX "feeds_createdAt_idx" ON "feeds"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "feeds_isActive_createdAt_idx" ON "feeds"("isActive", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "articles_hash_key" ON "articles"("hash");

-- CreateIndex
CREATE INDEX "articles_pubDate_idx" ON "articles"("pubDate" DESC);

-- CreateIndex
CREATE INDEX "articles_feedId_pubDate_idx" ON "articles"("feedId", "pubDate" DESC);

-- CreateIndex
CREATE INDEX "articles_topic_pubDate_idx" ON "articles"("topic", "pubDate" DESC);

-- CreateIndex
CREATE INDEX "articles_isDuplicate_pubDate_idx" ON "articles"("isDuplicate", "pubDate" DESC);

-- CreateIndex
CREATE INDEX "articles_fetchStatus_createdAt_idx" ON "articles"("fetchStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "poll_logs_feedId_startedAt_idx" ON "poll_logs"("feedId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_logs" ADD CONSTRAINT "poll_logs_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
