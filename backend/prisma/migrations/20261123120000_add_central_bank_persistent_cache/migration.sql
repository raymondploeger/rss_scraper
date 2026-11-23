CREATE TABLE "central_bank_cache_builds" (
  "id" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "central_bank_cache_builds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "central_bank_cache_builds_generatedAt_idx" ON "central_bank_cache_builds"("generatedAt" DESC);

CREATE TABLE "central_bank_cache_state" (
  "id" TEXT NOT NULL DEFAULT 'central_bank',
  "activeBuildId" TEXT,
  "generatedAt" TIMESTAMP(3),
  "lastError" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "central_bank_cache_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "central_bank_cache_state_activeBuildId_key" ON "central_bank_cache_state"("activeBuildId");

CREATE TABLE "central_bank_cache_entries" (
  "buildId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  CONSTRAINT "central_bank_cache_entries_pkey" PRIMARY KEY ("buildId", "articleId")
);

CREATE INDEX "central_bank_cache_entries_articleId_idx" ON "central_bank_cache_entries"("articleId");

ALTER TABLE "central_bank_cache_state" ADD CONSTRAINT "central_bank_cache_state_activeBuildId_fkey"
  FOREIGN KEY ("activeBuildId") REFERENCES "central_bank_cache_builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "central_bank_cache_entries" ADD CONSTRAINT "central_bank_cache_entries_buildId_fkey"
  FOREIGN KEY ("buildId") REFERENCES "central_bank_cache_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "central_bank_cache_entries" ADD CONSTRAINT "central_bank_cache_entries_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
