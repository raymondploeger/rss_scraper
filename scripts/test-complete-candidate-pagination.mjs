import assert from "node:assert/strict";
import {
  fetchAdaptiveCompleteCandidatePages,
  fetchCompleteCandidatePages,
} from "../frontend/public/complete-candidate-pagination.js";
import {
  getProfileHistoryDateRanges,
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
      candidateSnapshotId: "basic-snapshot-token",
      pagination: { page, limit: 2, total: 5, totalPages: 3 },
    };
  }
);
assert.deepEqual(requestedPages, [1, 2, 3]);
assert.deepEqual(completeResponse.items.map((item) => item.id), ["a", "b", "c", "d", "e"]);
assert.equal(completeResponse.pagination.loadedPages, 3);

const snapshotIdsByPage = [];
await fetchCompleteCandidatePages(
  new URLSearchParams({ includePagination: "true", completeCandidates: "true", limit: "2", page: "1" }),
  async (params) => {
    const page = Number(params.get("page"));
    snapshotIdsByPage.push(params.get("candidateSnapshotId") || "");
    return {
      items: page === 1 ? [{ id: "snapshot-a" }, { id: "snapshot-b" }] : [{ id: "snapshot-c" }],
      candidateSnapshotId: "opaque-snapshot-token",
      pagination: { page, limit: 2, total: 3, totalPages: 2 },
    };
  }
);
assert.deepEqual(snapshotIdsByPage, ["", "opaque-snapshot-token"], "complete pagination must reuse the opaque backend snapshot for later pages");

await assert.rejects(
  () => fetchCompleteCandidatePages(
    new URLSearchParams({ includePagination: "true", completeCandidates: "true", limit: "1", page: "1" }),
    async () => ({
      items: [{ id: "missing-token" }],
      pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
    })
  ),
  /candidateSnapshotId/,
  "multi-page complete retrieval must fail instead of accidentally creating a fresh snapshot per page"
);

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
  { id: "b", canonicalLink: "https://example.test/shared", title: "Shared article", pubDate: new Date("2026-01-04") },
  { id: "c", canonicalLink: "https://example.test/shared", title: "Shared article", pubDate: new Date("2026-01-03") },
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

let datedFindManyQuery = null;
await listCanonicalDedupedArticles({
  from: new Date("2026-03-29T00:00:00.000Z"),
  to: new Date("2026-06-26T23:59:59.999Z"),
}, {
  limit: 2,
  offset: 0,
  complete: true,
  prisma: {
    article: {
      findMany: async (query) => {
        datedFindManyQuery = query;
        return [];
      },
    },
  },
});
assert.equal(datedFindManyQuery.where.pubDate.gte.toISOString(), "2026-03-29T00:00:00.000Z");
assert.equal(datedFindManyQuery.where.pubDate.lte.toISOString(), "2026-06-26T23:59:59.999Z");

assert.equal(normalizeProfileHistoryScope("all"), "extended");
assert.equal(normalizeProfileHistoryScope("unexpected"), "recent");
assert.deepEqual(
  getProfileHistoryDateRanges("recent", new Date(2026, 8, 25, 12, 0, 0)),
  [{ from: "2026-06-27", to: "" }]
);
assert.deepEqual(
  getProfileHistoryDateRanges("extended", new Date(2026, 8, 25, 12, 0, 0)),
  [
    { from: "2026-03-29", to: "2026-06-26" },
    { from: "2026-06-27", to: "" },
  ],
  "The 180-day profile scope must use exact, non-overlapping 90-day windows so each complete query stays bounded."
);

const adaptiveAttemptedRanges = [];
const sourceLimitError = new Error("Candidate snapshot exceeds the configured source limit of 5000 articles.");
sourceLimitError.code = "CANDIDATE_SNAPSHOT_SOURCE_LIMIT";
const adaptiveResponse = await fetchAdaptiveCompleteCandidatePages(
  new URLSearchParams({
    includePagination: "true",
    completeCandidates: "true",
    from: "2026-03-29",
  }),
  async (params) => {
    const range = { from: params.get("from") || "", to: params.get("to") || "" };
    adaptiveAttemptedRanges.push(range);
    if (range.from === "2026-03-29" && !range.to) throw sourceLimitError;
    if (range.from === "2026-03-29" && range.to === "2026-06-27") {
      return {
        items: [{ id: "older", canonicalLink: "   ", link: "https://example.test/duplicate" }],
        pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
      };
    }
    if (range.from === "2026-06-28" && !range.to) {
      return {
        items: [
          { id: "duplicate", canonicalLink: "https://example.test/duplicate" },
          { id: "fallback", canonicalLink: " ", link: "https://example.test/fallback" },
        ],
        pagination: { page: 1, limit: 2, total: 2, totalPages: 1 },
      };
    }
    throw new Error(`Unexpected range: ${JSON.stringify(range)}`);
  },
  { now: new Date(2026, 8, 25, 12, 0, 0) }
);
assert.deepEqual(adaptiveAttemptedRanges, [
  { from: "2026-03-29", to: "" },
  { from: "2026-03-29", to: "2026-06-27" },
  { from: "2026-06-28", to: "" },
]);
assert.deepEqual(
  adaptiveResponse.items.map((item) => item.id),
  ["older", "fallback"],
  "adaptive result merging must use the first non-empty canonical link, then link, then id"
);

const recursiveAttemptedRanges = [];
const recursiveResponse = await fetchAdaptiveCompleteCandidatePages(
  new URLSearchParams({ completeCandidates: "true", from: "2026-09-01", to: "2026-09-25" }),
  async (params) => {
    const range = `${params.get("from")}:${params.get("to")}`;
    recursiveAttemptedRanges.push(range);
    if (range === "2026-09-01:2026-09-25" || range === "2026-09-01:2026-09-13") throw sourceLimitError;
    return { items: [{ id: range }], pagination: { page: 1, limit: 1, total: 1, totalPages: 1 } };
  },
  { minimumWindowDays: 7 }
);
assert.deepEqual(recursiveAttemptedRanges, [
  "2026-09-01:2026-09-25",
  "2026-09-01:2026-09-13",
  "2026-09-01:2026-09-07",
  "2026-09-08:2026-09-13",
  "2026-09-14:2026-09-25",
]);
assert.equal(recursiveResponse.items.length, 3);

await assert.rejects(
  () => fetchAdaptiveCompleteCandidatePages(
    new URLSearchParams({ completeCandidates: "true", from: "2026-09-18", to: "2026-09-25" }),
    async () => { throw sourceLimitError; },
    { minimumWindowDays: 7 }
  ),
  (error) => error === sourceLimitError,
  "source-limit failures must remain fail-closed at the minimum window"
);

const abortError = new Error("aborted");
abortError.name = "AbortError";
await assert.rejects(
  () => fetchAdaptiveCompleteCandidatePages(
    new URLSearchParams({ completeCandidates: "true", from: "2026-09-01", to: "2026-09-25" }),
    async () => { throw abortError; }
  ),
  (error) => error === abortError,
  "abort errors must not be retried or transformed"
);

const progressiveResponse = {
  items: [{ id: "progressive" }],
  pagination: { page: 1, limit: 1, total: 3, totalPages: 3 },
};
const unchangedProgressiveResponse = await fetchAdaptiveCompleteCandidatePages(
  new URLSearchParams({ includePagination: "true", page: "1" }),
  async () => progressiveResponse
);
assert.equal(
  unchangedProgressiveResponse,
  progressiveResponse,
  "non-complete retrieval must retain its progressive pagination response"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 27 })}\n`);
