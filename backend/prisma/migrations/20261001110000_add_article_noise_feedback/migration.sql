-- Store user-reported article noise separately from editorial quality rules.
CREATE TABLE "article_noise_feedback" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "profileContext" TEXT NOT NULL DEFAULT '',
    "interestIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "articleTitle" TEXT NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "articleSource" TEXT NOT NULL,
    "articleFeedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_noise_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "article_noise_feedback_articleId_clientId_key"
  ON "article_noise_feedback"("articleId", "clientId");
CREATE INDEX "article_noise_feedback_createdAt_idx"
  ON "article_noise_feedback"("createdAt" DESC);
CREATE INDEX "article_noise_feedback_reason_createdAt_idx"
  ON "article_noise_feedback"("reason", "createdAt" DESC);

ALTER TABLE "article_noise_feedback"
  ADD CONSTRAINT "article_noise_feedback_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
