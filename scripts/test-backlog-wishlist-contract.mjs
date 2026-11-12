import assert from "node:assert/strict";
import fs from "node:fs";

const rssServiceSource = fs.readFileSync(
  new URL("../backend/src/services/rssService.js", import.meta.url),
  "utf8"
);

assert.match(
  rssServiceSource,
  /const updatedArticle = await updateArticle\([\s\S]*?const wishlistMatches = await matchAndStoreArticleWishlistSignals\(updatedArticle\);[\s\S]*?updatedArticle\.wishlistMatches\s*=[\s\S]*?broadcast\("article:update", \{ type: "article:update", article: updatedArticle \}\);/,
  "backlog enrichment must recalculate wishlist matches and broadcast the current result"
);

process.stdout.write("Backlog wishlist contract checks passed.\n");
