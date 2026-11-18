import assert from "node:assert/strict";
import {
  CandidateSnapshotSourceLimitError,
  buildBoundedCanonicalCandidateSnapshot,
} from "../backend/src/database/articleRepository.js";

const sourceArticles = [
  { id: "a", canonicalLink: "https://example.test/a", title: "A", pubDate: new Date("2026-01-05") },
  { id: "b", canonicalLink: "https://example.test/shared", title: "Shared old", pubDate: new Date("2026-01-04") },
  { id: "c", canonicalLink: "https://example.test/shared", title: "Shared new", pubDate: new Date("2026-01-03") },
  { id: "d", canonicalLink: "https://example.test/d", title: "Same title", pubDate: new Date("2026-01-02") },
  { id: "e", canonicalLink: "https://example.test/e", title: "Same title", pubDate: new Date("2026-01-01") },
];

const calls = [];
const prisma = {
  article: {
    findMany: async ({ skip, take }) => {
      calls.push({ skip, take });
      return sourceArticles.slice(skip, skip + take);
    },
  },
};

const snapshot = await buildBoundedCanonicalCandidateSnapshot({}, {
  prisma,
  batchSize: 2,
  maxCandidates: 5,
});
assert.deepEqual(snapshot.map((article) => article.id), ["a", "b", "d", "e"]);
assert.deepEqual(calls, [{ skip: 0, take: 2 }, { skip: 2, take: 2 }, { skip: 4, take: 2 }]);
assert.ok(calls.every((call) => call.take <= 2), "snapshot loading must use bounded database batches");

const duplicateInclusiveSnapshot = await buildBoundedCanonicalCandidateSnapshot({}, {
  prisma,
  batchSize: 2,
  maxCandidates: 5,
  dedupe: false,
});
assert.deepEqual(duplicateInclusiveSnapshot.map((article) => article.id), ["a", "b", "c", "d", "e"]);

const noCanonicalSnapshot = await buildBoundedCanonicalCandidateSnapshot({}, {
  batchSize: 10,
  maxCandidates: 2,
  prisma: {
    article: {
      findMany: async ({ skip = 0, take = 10 }) => [
        { id: "no-canonical-a", canonicalLink: "", title: "Same fallback title" },
        { id: "no-canonical-b", canonicalLink: "", title: "Same fallback title" },
      ].slice(skip, skip + take),
    },
  },
});
assert.deepEqual(
  noCanonicalSnapshot.map((article) => article.id),
  ["no-canonical-a", "no-canonical-b"],
  "Articles without canonical URLs must fall back to ID, not collapse solely because their titles match."
);

const whitespaceCanonicalSnapshot = await buildBoundedCanonicalCandidateSnapshot({}, {
  batchSize: 10,
  maxCandidates: 2,
  prisma: {
    article: {
      findMany: async ({ skip = 0, take = 10 }) => [
        { id: "whitespace-a", canonicalLink: "  ", link: "https://example.test/whitespace", title: "Whitespace" },
        { id: "whitespace-b", canonicalLink: "", link: "https://example.test/whitespace", title: "Whitespace mirror" },
      ].slice(skip, skip + take),
    },
  },
});
assert.deepEqual(whitespaceCanonicalSnapshot.map((article) => article.id), ["whitespace-a"]);

const sourceBoundCalls = [];
const sourceBoundRows = Array.from({ length: 501 }, (_, index) => ({
  id: `bound-${index}`,
  canonicalLink: `https://example.test/bound-${index}`,
}));
await assert.rejects(
  () => buildBoundedCanonicalCandidateSnapshot({}, {
    batchSize: 200,
    maxCandidates: 500,
    prisma: {
      article: {
        findMany: async ({ skip, take }) => {
          sourceBoundCalls.push({ skip, take });
          return sourceBoundRows.slice(skip, skip + take);
        },
      },
    },
  }),
  (error) => error instanceof CandidateSnapshotSourceLimitError && error.code === "CANDIDATE_SNAPSHOT_SOURCE_LIMIT"
);
assert.deepEqual(sourceBoundCalls, [{ skip: 0, take: 200 }, { skip: 200, take: 200 }, { skip: 400, take: 101 }]);

await assert.rejects(
  () => buildBoundedCanonicalCandidateSnapshot({}, {
    prisma,
    batchSize: 2,
    maxCandidates: 4,
  }),
  (error) => error instanceof CandidateSnapshotSourceLimitError && error.code === "CANDIDATE_SNAPSHOT_SOURCE_LIMIT"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 4 })}\n`);
