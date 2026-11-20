import assert from "node:assert/strict";
import {
  CandidateSnapshotCompositeLimitError,
  buildBoundedCanonicalCandidateSnapshotComposite,
} from "../backend/src/database/articleRepository.js";

const requestedWhere = [];
const composite = await buildBoundedCanonicalCandidateSnapshotComposite({
  profileTopic: "Banknotes",
  searchTerms: ["banknote issuance", "currency redesign"],
  excludeDuplicates: true,
}, {
  batchSize: 10,
  maxCandidates: 10,
  maxItems: 10,
  concurrency: 2,
  prisma: {
    article: {
      findMany: async ({ where }) => {
        requestedWhere.push(where);
        if (where.topic === "Banknotes") return [{ id: "topic", canonicalLink: "https://example.test/topic" }];
        if (JSON.stringify(where).includes("banknote")) {
          return [{ id: "issuance", canonicalLink: "https://example.test/shared" }];
        }
        return [
          { id: "duplicate", canonicalLink: "https://example.test/shared" },
          { id: "redesign", canonicalLink: "https://example.test/redesign" },
        ];
      },
    },
  },
});
assert.deepEqual(composite.map((item) => item.id), ["topic", "issuance", "redesign"]);
assert.equal(requestedWhere.length, 3, "topic and each search phrase must remain separately bounded database queries");
assert.equal(requestedWhere[0].topic, "Banknotes");
assert.equal(requestedWhere[1].topic, undefined);
assert.equal(requestedWhere[2].topic, undefined);

await assert.rejects(
  () => buildBoundedCanonicalCandidateSnapshotComposite({ searchTerms: ["banknote", "currency", "redesign", "withdrawal"] }, {
    batchSize: 10,
    maxCandidates: 10,
    maxItems: 1,
    concurrency: 1,
    prisma: {
      article: {
        findMany: async ({ where }) => JSON.stringify(where).includes("banknote")
          ? [{ id: "a", canonicalLink: "https://example.test/a" }]
          : [{ id: "b", canonicalLink: "https://example.test/b" }],
      },
    },
  }),
  (error) => error instanceof CandidateSnapshotCompositeLimitError && error.code === "CANDIDATE_SNAPSHOT_COMPOSITE_LIMIT",
  "a composite snapshot must fail closed instead of silently truncating a complete profile candidate set"
);

let overflowCalls = 0;
await assert.rejects(
  () => buildBoundedCanonicalCandidateSnapshotComposite({ searchTerms: ["banknote", "currency", "redesign", "withdrawal"] }, {
    batchSize: 10,
    maxCandidates: 10,
    maxItems: 1,
    concurrency: 1,
    prisma: {
      article: {
        findMany: async () => {
          overflowCalls += 1;
          return [{ id: `overflow-${overflowCalls}`, canonicalLink: `https://example.test/overflow-${overflowCalls}` }];
        },
      },
    },
  }),
  (error) => error instanceof CandidateSnapshotCompositeLimitError
);
assert.equal(overflowCalls, 2, "composite overflow must stop scheduling later component scans");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 8 })}\n`);
