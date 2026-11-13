import assert from "node:assert/strict";
import { findArticleByCanonicalLink, listCanonicalDedupedArticles } from "../backend/src/database/articleRepository.js";
import { upsertArticle } from "../backend/src/services/rssService.js";

const canonicalLink = "https://hyperallergic.com/europeans-vote-on-new-leonardo-da-vinci-banknote-design/";
const records = new Map();
let createCalls = 0;
let updateCalls = 0;

const repository = {
  findArticleById: async (id) => records.get(id) || null,
  findArticleByCanonicalLink: async (canonical) =>
    [...records.values()]
      .filter((article) => article.canonicalLink === canonical)
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))[0] || null,
  createArticle: async (article) => {
    createCalls += 1;
    const created = { ...article, createdAt: article.createdAt || new Date("2026-01-01T00:00:00.000Z") };
    records.set(created.id, created);
    return created;
  },
  updateArticle: async (id, updates) => {
    updateCalls += 1;
    const updated = { ...records.get(id), ...updates };
    records.set(id, updated);
    return updated;
  },
};
const noOpBroadcast = () => {};

const primary = {
  id: "bing-dynamic-id-one",
  articleHash: "hash-one",
  canonicalLink,
  link: "https://www.bing.com/news/apiclick.aspx?tid=first",
  feedId: "primary-feed",
  feedName: "Primary feed",
  source: "Primary publisher",
  pubDate: "2026-01-01T10:00:00.000Z",
  title: "Original title",
  normalizedTitle: "original title",
  thumbnail: "",
  contentSnippet: "",
  summary: "",
  summaryShort: "",
  topic: "Banknotes",
  keywords: ["banknotes"],
  domains: ["currency"],
  profileSignals: [],
  classifications: ["central_bank"],
  fetchStatus: "pending",
};
const mirror = {
  ...primary,
  id: "bing-dynamic-id-two",
  articleHash: "hash-two",
  link: "https://www.bing.com/news/apiclick.aspx?tid=second",
  feedId: "mirror-feed",
  feedName: "Bing Mirror - banknote design",
  source: "Bing Mirror",
  pubDate: "2026-01-02T10:00:00.000Z",
  title: "Mirror title",
  normalizedTitle: "mirror title",
  thumbnail: "https://images.example.test/banknote.jpg",
  contentSnippet: "A longer enriched description from the mirror feed.",
  summary: "Enriched mirror summary",
  summaryShort: "Enriched summary",
  keywords: ["banknotes", "design"],
  classifications: ["central_bank", "banknote_design"],
  fetchStatus: "enriched",
};

await upsertArticle(primary, { ...repository, broadcast: noOpBroadcast });
await upsertArticle(mirror, { ...repository, broadcast: noOpBroadcast });

assert.equal(createCalls, 1, "different dynamic ids sharing a canonical URL must create one record");
assert.equal(updateCalls, 1, "the canonical match must merge into the primary record");
assert.equal(records.size, 1);
const stored = records.get(primary.id);
assert.equal(stored.link, primary.link, "canonical fallback must retain the primary redirect link");
assert.equal(stored.feedId, primary.feedId, "canonical fallback must retain the primary feed");
assert.equal(stored.feedName, primary.feedName, "canonical fallback must retain the primary feed name");
assert.equal(stored.source, primary.source, "canonical fallback must retain the primary source");
assert.equal(stored.pubDate, primary.pubDate, "canonical fallback must retain the primary date");
assert.equal(stored.thumbnail, mirror.thumbnail, "canonical fallback may backfill a thumbnail");
assert.equal(stored.contentSnippet, mirror.contentSnippet, "canonical fallback may backfill missing content");
assert.deepEqual(stored.classifications, ["central_bank", "banknote_design"]);

let canonicalQuery = null;
const oldest = await findArticleByCanonicalLink("  https://example.test/article  ", {
  prisma: {
    article: {
      findFirst: async (query) => {
        canonicalQuery = query;
        return { id: "oldest", canonicalLink: "https://example.test/article", createdAt: new Date("2026-01-01") };
      },
    },
  },
});
assert.equal(oldest.id, "oldest");
assert.deepEqual(canonicalQuery.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
assert.equal(await findArticleByCanonicalLink("   ", { prisma: { article: { findFirst: async () => { throw new Error("must not query blank canonical links"); } } } }), null);

const apiCandidates = [
  { id: "same-title-a", title: "Shared title", canonicalLink: "https://example.test/a", pubDate: new Date("2026-01-03") },
  { id: "same-title-b", title: "Shared title", canonicalLink: "https://example.test/b", pubDate: new Date("2026-01-02") },
  { id: "same-canonical", title: "Different title", canonicalLink: "https://example.test/a", pubDate: new Date("2026-01-01") },
  { id: "title-fallback-a", title: "No canonical title", canonicalLink: "", pubDate: new Date("2025-12-31") },
  { id: "title-fallback-b", title: "No canonical title", canonicalLink: "", pubDate: new Date("2025-12-30") },
  { id: "whitespace-canonical", title: "Whitespace canonical falls back to title", canonicalLink: "   ", pubDate: new Date("2025-12-29") },
];
const apiResult = await listCanonicalDedupedArticles({}, {
  complete: true,
  prisma: { article: { findMany: async () => apiCandidates } },
});
assert.deepEqual(
  apiResult.items.map((article) => article.id),
  ["same-title-a", "same-title-b", "title-fallback-a", "whitespace-canonical"],
  "API dedupe must use canonical URL first and title only without a canonical URL"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 17 })}\n`);
