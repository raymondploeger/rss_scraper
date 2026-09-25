import assert from "node:assert/strict";
import { fetchCompleteCandidatePages } from "../frontend/public/complete-candidate-pagination.js";
import {
  getProfileHistorySinceDate,
  normalizeProfileHistoryScope,
} from "../frontend/public/profile-history-scope.js";
import { listCanonicalDedupedArticles } from "../backend/src/database/articleRepository.js";

const requestedPages = [];
const completeResponse = await fetchCompleteCandidatePages(
  new URLSearchParams({ includePagination: "true", completeCandidates: "true", limit: "2", page: "1" }),
  async (params) => {
    const page = Number(params.get("page"));
    requestedPages.push(page);
    const itemsByPage = {
      1: [{ id: "a" }, { id: "b" }],
      2: [{ id: "c" }, { id: "d" }],
      3: [{ id: "e" }],
    };
    return {
      items: itemsByPage[page],
      pagination: { page, limit: 2, total: 5, totalPages: 3 },
    };
  }
);
assert.deepEqual(requestedPages, [1, 2, 3]);
assert.deepEqual(completeResponse.items.map((item) => item.id), ["a", "b", "c", "d", "e"]);
assert.equal(completeResponse.pagination.loadedPages, 3);

const singlePageResponse = { items: [{ id: "only" }], pagination: { page: 1, limit: 1, total: 1, totalPages: 1 } };
let singlePageCalls = 0;
const unchangedResponse = await fetchCompleteCandidatePages(
  new URLSearchParams({ includePagination: "true", limit: "1", page: "1" }),
  async () => {
    singlePageCalls += 1;
    return singlePageResponse;
  }
);
assert.equal(singlePageCalls, 1);
assert.equal(unchangedResponse, singlePageResponse);

const sourceArticles = [
  { id: "a", title: "First", pubDate: new Date("2026-01-05") },
  { id: "b", title: "Shared article", pubDate: new Date("2026-01-04") },
  { id: "c", title: "Shared article", pubDate: new Date("2026-01-03") },
  { id: "d", title: "Fourth", pubDate: new Date("2026-01-02") },
  { id: "e", title: "Fifth", pubDate: new Date("2026-01-01") },
];
let completeFindManyQuery = null;
const completePool = await listCanonicalDedupedArticles({}, {
  limit: 2,
  offset: 2,
  complete: true,
  prisma: {
    article: {
      findMany: async (query) => {
        completeFindManyQuery = query;
        return sourceArticles;
      },
    },
  },
});
assert.equal(Object.hasOwn(completeFindManyQuery, "take"), false);
assert.equal(completePool.total, 4);
assert.equal(completePool.truncated, false);
assert.deepEqual(completePool.items.map((item) => item.id), ["d", "e"]);

let limitedFindManyQuery = null;
await listCanonicalDedupedArticles({}, {
  limit: 2,
  offset: 0,
  candidateLimit: 2,
  prisma: {
    article: {
      findMany: async (query) => {
        limitedFindManyQuery = query;
        return sourceArticles.slice(0, 2);
      },
    },
  },
});
assert.equal(limitedFindManyQuery.take, 2);

assert.equal(normalizeProfileHistoryScope("all"), "all");
assert.equal(normalizeProfileHistoryScope("unexpected"), "recent");
assert.equal(
  getProfileHistorySinceDate("recent", new Date(2026, 8, 25, 12, 0, 0)),
  "2026-06-27"
);
assert.equal(getProfileHistorySinceDate("all", new Date(2026, 8, 25, 12, 0, 0)), "");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 14 })}\n`);
