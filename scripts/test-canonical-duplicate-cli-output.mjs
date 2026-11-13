import assert from "node:assert/strict";
import { formatCanonicalDuplicateCliSummary } from "../backend/scripts/consolidate-canonical-duplicates.js";

const summary = {
  mode: "applied",
  snapshot: {
    groupCount: 21,
    articleCount: 63,
    groups: [{ canonicalLink: "https://example.test/group", articleIds: ["article-1", "article-2"] }],
  },
  primaryRecords: [{ canonicalLink: "https://example.test/group", primaryId: "primary-1" }],
  markedSecondaries: [{ canonicalLink: "https://example.test/group", id: "secondary-1", primaryId: "primary-1" }],
  skippedGroups: Array.from({ length: 21 }, (_, index) => ({
    canonicalLink: `https://example.test/skipped/${index}`,
    articleIds: [`article-${index}`],
    reasons: ["wishlistMatches"],
  })),
  appliedUpdateCount: 42,
  unchangedOutsideSnapshot: { mutationCount: 0, reason: "Snapshot IDs only" },
};

const stdout = JSON.stringify(formatCanonicalDuplicateCliSummary(summary));
const output = JSON.parse(stdout);

assert.equal(output.mode, "applied");
assert.deepEqual(output.snapshot, { groupCount: 21, articleCount: 63 });
assert.equal(output.primaryRecordCount, 1);
assert.equal(output.markedSecondaryCount, 1);
assert.equal(output.skippedGroupCount, 21);
assert.equal(output.skippedGroups.length, 20);
assert.deepEqual(output.skippedGroups[0], {
  canonicalLink: "https://example.test/skipped/0",
  reason: "wishlistMatches",
});
assert.equal(output.appliedUpdateCount, 42);
assert.deepEqual(output.unchangedOutsideSnapshot, { mutationCount: 0, reason: "Snapshot IDs only" });
assert.doesNotMatch(stdout, /articleIds|article-1|primary-1|secondary-1/);
assert.doesNotMatch(stdout, /"groups"|"primaryRecords"|"markedSecondaries"/);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 11 })}\n`);
