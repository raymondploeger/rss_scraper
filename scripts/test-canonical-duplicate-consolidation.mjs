import assert from "node:assert/strict";
import {
  buildCanonicalDuplicateConsolidationPlan,
  snapshotCanonicalDuplicateGroups,
} from "../backend/src/services/canonicalDuplicateConsolidationService.js";
import { consolidateCanonicalDuplicates } from "../backend/scripts/consolidate-canonical-duplicates.js";

const canonicalLink = "https://example.test/articles/canonical";
const tiedCanonicalLink = "https://example.test/articles/tied";
const protectedCanonicalLink = "https://example.test/articles/protected";

const records = [
  {
    id: "secondary-late",
    canonicalLink,
    createdAt: new Date("2026-02-03T00:00:00.000Z"),
    title: "Must remain intact",
    source: "Mirror",
    wishlistMatches: [],
    noiseFeedback: [],
  },
  {
    id: "primary-early",
    canonicalLink,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    title: "Primary article",
    source: "Original",
    wishlistMatches: [],
    noiseFeedback: [],
  },
  {
    id: "secondary-middle",
    canonicalLink,
    createdAt: new Date("2026-02-02T00:00:00.000Z"),
    title: "Another mirror",
    source: "Mirror two",
    wishlistMatches: [],
    noiseFeedback: [],
  },
  {
    id: "z-tied",
    canonicalLink: tiedCanonicalLink,
    createdAt: new Date("2026-02-04T00:00:00.000Z"),
    wishlistMatches: [],
    noiseFeedback: [],
  },
  {
    id: "a-tied",
    canonicalLink: tiedCanonicalLink,
    createdAt: new Date("2026-02-04T00:00:00.000Z"),
    wishlistMatches: [],
    noiseFeedback: [],
  },
  {
    id: "protected-primary",
    canonicalLink: protectedCanonicalLink,
    createdAt: new Date("2026-02-05T00:00:00.000Z"),
    wishlistMatches: [{ id: "wishlist-match" }],
    noiseFeedback: [],
  },
  {
    id: "protected-secondary",
    canonicalLink: protectedCanonicalLink,
    createdAt: new Date("2026-02-06T00:00:00.000Z"),
    wishlistMatches: [],
    noiseFeedback: [{ id: "noise-feedback" }],
  },
  {
    id: "existing-duplicate-outside-snapshot",
    canonicalLink: "",
    createdAt: new Date("2026-02-07T00:00:00.000Z"),
    isDuplicate: true,
    duplicateOf: "unrelated-primary",
    wishlistMatches: [],
    noiseFeedback: [],
  },
];
const originalRecords = structuredClone(records);

const snapshot = snapshotCanonicalDuplicateGroups(records);
assert.deepEqual(snapshot.map((group) => group.articleIds), [
  ["primary-early", "secondary-middle", "secondary-late"],
  ["a-tied", "z-tied"],
  ["protected-primary", "protected-secondary"],
]);
assert.deepEqual(records, originalRecords, "snapshotting must not mutate input records");

const plan = buildCanonicalDuplicateConsolidationPlan(snapshot);
assert.equal(plan.snapshotGroupCount, 3);
assert.equal(plan.primaryRecords.length, 2);
assert.equal(plan.markedSecondaryRecords.length, 3);
assert.equal(plan.skippedGroups.length, 1);
assert.deepEqual(plan.skippedGroups[0], {
  canonicalLink: protectedCanonicalLink,
  articleIds: ["protected-primary", "protected-secondary"],
  reasons: ["wishlistMatches", "noiseFeedback"],
});

const canonicalGroup = plan.primaryRecords.find((record) => record.canonicalLink === canonicalLink);
assert.deepEqual(canonicalGroup, {
  canonicalLink,
  primaryId: "primary-early",
  duplicateGroupId: canonicalGroup.duplicateGroupId,
  update: {
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: canonicalGroup.duplicateGroupId,
  },
});
assert.match(canonicalGroup.duplicateGroupId, /^[a-f0-9]{64}$/);
assert.equal(
  canonicalGroup.duplicateGroupId,
  buildCanonicalDuplicateConsolidationPlan(snapshotCanonicalDuplicateGroups([...records].reverse()))
    .primaryRecords.find((record) => record.canonicalLink === canonicalLink).duplicateGroupId,
  "the group ID must be stable regardless of input order"
);
assert.equal(
  plan.primaryRecords.find((record) => record.canonicalLink === tiedCanonicalLink).primaryId,
  "a-tied",
  "equal creation times must choose the lexicographically smallest ID"
);

assert.deepEqual(
  plan.markedSecondaryRecords
    .filter((record) => record.canonicalLink === canonicalLink)
    .map(({ id, update }) => ({ id, update })),
  [
    { id: "secondary-middle", update: { isDuplicate: true, duplicateOf: "primary-early", duplicateGroupId: canonicalGroup.duplicateGroupId } },
    { id: "secondary-late", update: { isDuplicate: true, duplicateOf: "primary-early", duplicateGroupId: canonicalGroup.duplicateGroupId } },
  ]
);
assert.ok(
  !plan.primaryRecords.some((record) => record.id === "existing-duplicate-outside-snapshot") &&
  !plan.markedSecondaryRecords.some((record) => record.id === "existing-duplicate-outside-snapshot"),
  "records outside the canonical snapshot must never receive a mutation"
);
assert.deepEqual(records, originalRecords, "planning must not mutate input records or the snapshot source");

let findManyQuery;
let transactionOptions;
const operations = [];
const prisma = {
  article: {
    findMany: async (query) => {
      findManyQuery = query;
      return records;
    },
  },
  $transaction: async (callback, options) => {
    transactionOptions = options;
    return callback({
      article: {
        update: async (query) => operations.push({ type: "update", query }),
        updateMany: async (query) => {
          operations.push({ type: "updateMany", query });
          return { count: query.where.id.in.length };
        },
      },
    });
  },
};
const dryRunSummary = await consolidateCanonicalDuplicates({ prisma, apply: false });
assert.equal(operations.length, 0, "dry-run must not update records");
assert.equal(dryRunSummary.snapshot.groupCount, 3);
assert.equal(dryRunSummary.primaryRecords.length, 2);
assert.equal(dryRunSummary.markedSecondaries.length, 3);
assert.equal(dryRunSummary.skippedGroups.length, 1);
assert.equal(dryRunSummary.unchangedOutsideSnapshot.mutationCount, 0);
assert.ok(!Object.hasOwn(findManyQuery, "skip") && !Object.hasOwn(findManyQuery, "cursor"), "snapshot query must not paginate");

const appliedSummary = await consolidateCanonicalDuplicates({ prisma, apply: true });
assert.equal(appliedSummary.appliedUpdateCount, 5);
assert.deepEqual(transactionOptions, { maxWait: 10_000, timeout: 300_000 });
assert.deepEqual(
  operations,
  [
    { type: "update", query: { where: { id: "primary-early" }, data: canonicalGroup.update } },
    {
      type: "updateMany",
      query: {
        where: { id: { in: ["secondary-middle", "secondary-late"] } },
        data: plan.markedSecondaryRecords.find((record) => record.id === "secondary-middle").update,
      },
    },
    {
      type: "update",
      query: {
        where: { id: "a-tied" },
        data: {
          isDuplicate: false,
          duplicateOf: null,
          duplicateGroupId: plan.primaryRecords.find((record) => record.canonicalLink === tiedCanonicalLink).duplicateGroupId,
        },
      },
    },
    {
      type: "updateMany",
      query: {
        where: { id: { in: ["z-tied"] } },
        data: plan.markedSecondaryRecords.find((record) => record.id === "z-tied").update,
      },
    },
  ],
  "apply uses a primary update plus a snapshot-bounded secondary updateMany for each eligible group"
);
assert.deepEqual(records, originalRecords, "script planning must not mutate loaded records");

const mismatchedUpdatePrisma = {
  article: {
    findMany: async () => records,
  },
  $transaction: async (callback) => callback({
    article: {
      update: async () => undefined,
      updateMany: async () => ({ count: 1 }),
    },
  }),
};
await assert.rejects(
  consolidateCanonicalDuplicates({ prisma: mismatchedUpdatePrisma, apply: true }),
  /secondary update count mismatch: expected 2, received 1/
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 25 })}\n`);
