import assert from "node:assert/strict";
import {
  buildDiscoveryFeedQualityCleanupPlan,
  buildDiscoveryFeedQualityCleanupOutput,
  applyDiscoveryFeedQualityCleanupPlan,
} from "../backend/src/services/discoveryFeedQualityCleanupService.js";

const googleAlertUrl = "https://www.google.com/alerts/feeds/example";

function article({ id, feedName, title, contentSnippet = "", summary = "", wishlist = false, feedback = false }) {
  return {
    id,
    title,
    contentSnippet,
    summary,
    source: "Google Alerts",
    topic: "General",
    feedName,
    feed: { id: `feed-${feedName}`, name: feedName, rssUrl: googleAlertUrl },
    wishlistMatches: wishlist ? [{ id: `wish-${id}` }] : [],
    noiseFeedback: feedback ? [{ id: `feedback-${id}` }] : [],
  };
}

const snapshot = [
  article({ id: "001", feedName: "OVD", title: "112 melding na ongeluk in Utrecht" }),
  article({ id: "002", feedName: "Security Features", title: "Generic phone security features announced" }),
  article({ id: "003", feedName: "banknotes", title: "Reuters: banknotes are works of art" }),
  article({ id: "004", feedName: "banknotes", title: "A post on X mentions banknotes" }),
  article({ id: "005", feedName: "passports", title: "Passport mentioned during a neighbourhood dispute" }),
  article({ id: "006", feedName: "banknotes", title: "Bank of Ghana unveils new banknotes with hologram security features" }),
  article({ id: "007", feedName: "OVD", title: "OVD document security feature for secure IDs" }),
  article({ id: "008", feedName: "passports", title: "Forged passport detected at the border" }),
  article({ id: "009", feedName: "OVD", title: "112 ambulance dispatch", wishlist: true }),
  article({ id: "010", feedName: "passports", title: "Passport casually mentioned", feedback: true }),
];

const plan = buildDiscoveryFeedQualityCleanupPlan(snapshot);

assert.equal(plan.snapshotCount, 10);
assert.equal(plan.rejectedCount, 7);
assert.equal(plan.eligibleCount, 5);
assert.equal(plan.skippedRelationsCount, 2);
assert.deepEqual(plan.eligible.map((entry) => entry.id), ["001", "002", "003", "004", "005"]);
assert.equal(plan.rejectedByFeed.OVD, 2);
assert.equal(plan.rejectedByFeed["Security Features"], 1);
assert.equal(plan.rejectedByFeed.banknotes, 2);
assert.equal(plan.rejectedByFeed.passports, 2);

const output = buildDiscoveryFeedQualityCleanupOutput({ plan, mode: "dry-run" });
assert.equal(output.preview.length, 5);
assert.equal(Object.hasOwn(output, "eligibleIds"), false);
assert.equal(output.unchangedOutsideSnapshot, 0);
assert.ok(JSON.stringify(output).length < 4_000, "cleanup output stays compact");

const deleteCalls = [];
const cacheInvalidations = [];
const mutationOrder = [];
let rebuildCalls = 0;
const unrelatedProfileState = { id: "unrelated-profile", refreshGeneration: 41, leaseOwner: null };
const unrelatedBuildGeneration = unrelatedProfileState.refreshGeneration;
const fakePrisma = {
  async $transaction(callback) {
    return callback({
      centralBankCacheState: {
        async updateMany({ where, data }) {
          cacheInvalidations.push({ where, data });
          // This state does not contain a soon-to-be-deleted article and has
          // no lease when cleanup starts. It can nevertheless acquire a
          // lease and publish a pre-delete build unless every persistent
          // profile state is included in the maintenance barrier.
          if (Object.keys(where).length === 0) unrelatedProfileState.refreshGeneration += 1;
          mutationOrder.push("invalidate");
          return { count: 3 };
        },
      },
      article: {
        async deleteMany({ where }) {
          deleteCalls.push(where);
          mutationOrder.push("delete");
          return { count: where.id.in.length };
        },
      },
    });
  },
};
const applied = await applyDiscoveryFeedQualityCleanupPlan(fakePrisma, plan, {
  batchSize: 2,
  rebuildProfileCaches: async () => { rebuildCalls += 1; },
});
assert.equal(applied, 5);
assert.equal(rebuildCalls, 1, "a successful cleanup rebuilds profile caches through the authoritative service");
assert.equal(cacheInvalidations.length, 3, "every destructive batch fences active or affected cache builds before deletion");
assert.deepEqual(mutationOrder, ["invalidate", "delete", "invalidate", "delete", "invalidate", "delete"], "each batch invalidates cache state before its delete can commit");
for (const invalidation of cacheInvalidations) {
  assert.deepEqual(invalidation.where, {}, "the maintenance barrier fences every persistent profile-cache state, including unrelated idle states");
  assert.equal(invalidation.data.lastError, "Invalidated by discovery-feed-quality cleanup", "cache state is explicitly stale while deletion/rebuild is in progress");
  assert.deepEqual(invalidation.data.refreshGeneration, { increment: 1 }, "cache fence invalidates an active build lease");
  assert.equal(invalidation.data.leaseOwner, null);
  assert.equal(invalidation.data.leaseExpiresAt, null);
}
assert.equal(unrelatedProfileState.refreshGeneration, 44, "every destructive batch invalidates the unrelated profile state so a concurrent pre-delete build cannot publish");
assert.notEqual(unrelatedProfileState.refreshGeneration, unrelatedBuildGeneration, "an unrelated build that read before its destructive batch loses its publish generation");
assert.deepEqual(deleteCalls.map((where) => where.id.in), [["001", "002"], ["003", "004"], ["005"]]);
for (const where of deleteCalls) {
  assert.deepEqual(where.AND[0].id.in, plan.snapshotIds, "every delete is constrained to snapshot IDs");
  assert.deepEqual(where.wishlistMatches, { none: {} }, "a late Wishlist relation must block deletion");
  assert.deepEqual(where.noiseFeedback, { none: {} }, "late noise feedback must block deletion");
}

await assert.rejects(
  () => applyDiscoveryFeedQualityCleanupPlan({
    async $transaction(callback) {
      return callback({
        centralBankCacheState: { updateMany: async () => ({ count: 0 }) },
        article: { deleteMany: async () => ({ count: 0 }) },
      });
    },
  }, plan, { batchSize: 5, rebuildProfileCaches: async () => {} }),
  /Delete count mismatch/
);

const lateMismatchDeleteCalls = [];
let lateMismatchRebuilds = 0;
await assert.rejects(
  () => applyDiscoveryFeedQualityCleanupPlan({
    async $transaction(callback) {
      return callback({
        centralBankCacheState: { updateMany: async () => ({ count: 1 }) },
        article: {
          async deleteMany({ where }) {
            lateMismatchDeleteCalls.push(where.id.in);
            return { count: lateMismatchDeleteCalls.length === 1 ? where.id.in.length : where.id.in.length - 1 };
          },
        },
      });
    },
  }, plan, { batchSize: 2, rebuildProfileCaches: async () => { lateMismatchRebuilds += 1; } }),
  /Delete count mismatch: expected 2, deleted 1/
);
assert.deepEqual(lateMismatchDeleteCalls, [["001", "002"], ["003", "004"]], "a late mismatch stops before any later destructive batch");
assert.equal(lateMismatchRebuilds, 0, "a mismatched apply cannot report completion by rebuilding as though it succeeded");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 31 })}\n`);
