CREATE TABLE "wishlist_items" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "acquisitionStatus" TEXT NOT NULL DEFAULT 'Wishlist',
  "workflowStatus" TEXT NOT NULL DEFAULT 'Not started',
  "priority" TEXT NOT NULL DEFAULT 'Medium',
  "category" TEXT NOT NULL DEFAULT '',
  "sourceReference" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wishlist_items_normalizedTitle_key" ON "wishlist_items"("normalizedTitle");
CREATE INDEX "wishlist_items_isActive_priority_idx" ON "wishlist_items"("isActive", "priority");

CREATE TABLE "article_wishlist_matches" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "wishlistItemId" TEXT NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'candidate',
  "matchedTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "imageCandidate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_wishlist_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "article_wishlist_matches_articleId_wishlistItemId_key" ON "article_wishlist_matches"("articleId", "wishlistItemId");
CREATE INDEX "article_wishlist_matches_wishlistItemId_createdAt_idx" ON "article_wishlist_matches"("wishlistItemId", "createdAt" DESC);
CREATE INDEX "article_wishlist_matches_articleId_createdAt_idx" ON "article_wishlist_matches"("articleId", "createdAt" DESC);

ALTER TABLE "article_wishlist_matches" ADD CONSTRAINT "article_wishlist_matches_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "article_wishlist_matches" ADD CONSTRAINT "article_wishlist_matches_wishlistItemId_fkey"
  FOREIGN KEY ("wishlistItemId") REFERENCES "wishlist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
