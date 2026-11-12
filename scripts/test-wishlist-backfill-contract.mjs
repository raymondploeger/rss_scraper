import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptUrl = new URL("../backend/scripts/backfill-wishlist-matches.js", import.meta.url);
const script = await readFile(scriptUrl, "utf8");

assert.match(
  script,
  /const\s+snapshotArticleIds\s*=\s*\(\s*await\s+prisma\.article\.findMany\(\{[\s\S]*?where:\s*\{\s*wishlistMatches:\s*\{\s*some:\s*\{\s*\}\s*\}\s*,?\s*\}[\s\S]*?select:\s*\{\s*id:\s*true\s*\}[\s\S]*?orderBy:\s*\{\s*id:\s*["']asc["']\s*\}[\s\S]*?\}\s*\)\s*\)\.map\(\(\{\s*id\s*\}\)\s*=>\s*id\)/,
  "the backfill must snapshot sorted IDs for articles that have wishlist matches before mutations"
);
assert.match(
  script,
  /for\s*\(let\s+start\s*=\s*0;\s*start\s*<\s*snapshotArticleIds\.length;\s*start\s*\+=\s*PAGE_SIZE\s*\)\s*\{[\s\S]*?const\s+articleIds\s*=\s*snapshotArticleIds\.slice\(start,\s*start\s*\+\s*PAGE_SIZE\)/,
  "the backfill must process the fixed snapshot ID list in batches"
);
assert.match(
  script,
  /const\s+articles\s*=\s*await\s+prisma\.article\.findMany\(\{[\s\S]*?where:\s*\{\s*id:\s*\{\s*in:\s*articleIds\s*\}\s*,?\s*\}/,
  "each snapshot batch must re-fetch the current articles before matching"
);
assert.doesNotMatch(
  script,
  /\b(cursor|offset)\b/,
  "the mutating backfill must not use cursor or offset pagination"
);

console.log("Wishlist backfill contract checks passed.");
