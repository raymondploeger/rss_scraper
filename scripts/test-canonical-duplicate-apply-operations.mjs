import assert from "node:assert/strict";
import { consolidateCanonicalDuplicates } from "../backend/scripts/consolidate-canonical-duplicates.js";

const eligibleOne = "https://example.test/eligible-one";
const eligibleTwo = "https://example.test/eligible-two";
const protectedCanonical = "https://example.test/protected";
const records = [
  { id: "one-primary", canonicalLink: eligibleOne, createdAt: new Date("2026-01-01"), wishlistMatches: [], noiseFeedback: [] },
  { id: "one-secondary-a", canonicalLink: eligibleOne, createdAt: new Date("2026-01-02"), wishlistMatches: [], noiseFeedback: [] },
  { id: "one-secondary-b", canonicalLink: eligibleOne, createdAt: new Date("2026-01-03"), wishlistMatches: [], noiseFeedback: [] },
  { id: "two-primary", canonicalLink: eligibleTwo, createdAt: new Date("2026-01-04"), wishlistMatches: [], noiseFeedback: [] },
  { id: "two-secondary", canonicalLink: eligibleTwo, createdAt: new Date("2026-01-05"), wishlistMatches: [], noiseFeedback: [] },
  { id: "protected-primary", canonicalLink: protectedCanonical, createdAt: new Date("2026-01-06"), wishlistMatches: [{ id: "match" }], noiseFeedback: [] },
  { id: "protected-secondary", canonicalLink: protectedCanonical, createdAt: new Date("2026-01-07"), wishlistMatches: [], noiseFeedback: [] },
  { id: "outside-snapshot", canonicalLink: "", createdAt: new Date("2026-01-08"), wishlistMatches: [], noiseFeedback: [] },
];

const operations = [];
let transactionOptions;
const prisma = {
  article: { findMany: async () => records },
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

const summary = await consolidateCanonicalDuplicates({ prisma, apply: true });

assert.equal(summary.appliedUpdateCount, 5);
assert.deepEqual(transactionOptions, { maxWait: 10_000, timeout: 300_000 });
assert.equal(operations.length, 4, "each eligible canonical group uses exactly one primary update and one secondary updateMany");

const snapshotIdsByCanonical = new Map([
  [eligibleOne, ["one-primary", "one-secondary-a", "one-secondary-b"]],
  [eligibleTwo, ["two-primary", "two-secondary"]],
]);
const primaryIds = new Set(["one-primary", "two-primary"]);
const updates = operations.filter(({ type }) => type === "update");
const secondaryUpdates = operations.filter(({ type }) => type === "updateMany");

assert.equal(updates.length, 2);
assert.equal(secondaryUpdates.length, 2);
for (const { query } of updates) {
  assert.deepEqual(Object.keys(query.where), ["id"], "primary normalisation filters only by its snapshot ID");
  assert.ok(primaryIds.has(query.where.id));
  assert.ok(!Object.hasOwn(query.where, "canonicalLink"));
}
for (const { query } of secondaryUpdates) {
  assert.deepEqual(Object.keys(query.where), ["id"], "secondary bulk update filters only by snapshot IDs");
  assert.ok(!Object.hasOwn(query.where, "canonicalLink"));
  assert.ok(Array.isArray(query.where.id.in));
  for (const id of query.where.id.in) {
    assert.ok(!primaryIds.has(id), "the primary ID must not be included in its group's secondary updateMany");
    assert.ok([...snapshotIdsByCanonical.values()].flat().includes(id), "no ID outside the fixed snapshot may be updated");
  }
}
assert.deepEqual(
  secondaryUpdates.map(({ query }) => query.where.id.in),
  [["one-secondary-a", "one-secondary-b"], ["two-secondary"]],
  "each updateMany contains only the recorded secondary IDs for its canonical snapshot group"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 16 })}\n`);
