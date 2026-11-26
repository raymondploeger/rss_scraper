import assert from "node:assert/strict";
import {
  buildDiscoveryFeedQualityCleanupPlan,
  buildDiscoveryFeedQualityCleanupOutput,
  applyDiscoveryFeedQualityCleanupPlan,
  discoveryFeedQualityTargetWhere,
} from "../backend/src/services/discoveryFeedQualityCleanupService.js";
import { parseCleanupDiscoveryFeedQualityArgs } from "../backend/scripts/cleanup-discovery-feed-quality.js";

const googleAlertUrl = "https://www.google.com/alerts/feeds/example";
const securityFeaturesGoogleAlertUrl = "https://www.google.com/alerts/feeds/08517052598424393837/1632750707624179991";

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

const scopedArgs = parseCleanupDiscoveryFeedQualityArgs(["--feed", "oVd"]);
assert.deepEqual(scopedArgs, { apply: false, selectedFeeds: ["OVD"] });
const securityFeaturesScopedArgs = parseCleanupDiscoveryFeedQualityArgs(["--feed", "SeCuRiTy-FeAtUrEs"]);
assert.deepEqual(securityFeaturesScopedArgs, { apply: false, selectedFeeds: ["Security Features"] });
assert.deepEqual(
  parseCleanupDiscoveryFeedQualityArgs([]),
  { apply: false, selectedFeeds: ["OVD", "Security Features", "banknotes", "passports"] },
  "default invocation preserves the all-four-target dry-run scope",
);
assert.deepEqual(
  parseCleanupDiscoveryFeedQualityArgs(["--apply", "--feed", "ovd"]),
  { apply: true, selectedFeeds: ["OVD"] },
);
assert.deepEqual(
  discoveryFeedQualityTargetWhere(scopedArgs.selectedFeeds),
  {
    OR: [{
      name: "OVD",
      rssUrl: "https://www.google.com/alerts/feeds/08517052598424393837/16541274970187058676",
    }],
  },
  "the scoped snapshot predicate can target only the exact retired OVD Google Alert feed",
);
assert.deepEqual(
  discoveryFeedQualityTargetWhere(securityFeaturesScopedArgs.selectedFeeds),
  {
    OR: [{
      name: "Security Features",
      rssUrl: securityFeaturesGoogleAlertUrl,
    }],
  },
  "the Security Features scoped snapshot predicate targets only its exact Google Alert feed",
);
assert.throws(
  () => parseCleanupDiscoveryFeedQualityArgs(["--feed"]),
  /Allowed feed selector: ovd, security-features/i,
);
assert.throws(
  () => parseCleanupDiscoveryFeedQualityArgs(["--feed", "other"]),
  /Allowed feed selector: ovd, security-features/i,
);
assert.throws(
  () => parseCleanupDiscoveryFeedQualityArgs(["--feed", "ovd,banknotes"]),
  /Allowed feed selector: ovd, security-features/i,
);
for (const invalidSelector of ["security features", "security_features", "security-features,ovd"]) {
  assert.throws(
    () => parseCleanupDiscoveryFeedQualityArgs(["--feed", invalidSelector]),
    /Allowed feed selector: ovd, security-features/i,
    `${invalidSelector} fails closed`,
  );
}
assert.throws(
  () => parseCleanupDiscoveryFeedQualityArgs(["--feed", "ovd", "--feed", "OVD"]),
  /may only be provided once/i,
);

const plan = buildDiscoveryFeedQualityCleanupPlan(snapshot);

const scopedPlan = buildDiscoveryFeedQualityCleanupPlan([
  ...snapshot,
  article({ id: "011", feedName: "OVD archive", title: "112 melding in an archive" }),
], { selectedFeeds: scopedArgs.selectedFeeds });
assert.deepEqual(scopedPlan.selectedFeeds, ["OVD"]);
assert.deepEqual(scopedPlan.snapshotIds, ["001", "007", "009"]);
assert.deepEqual(scopedPlan.eligible.map((entry) => entry.id), ["001"]);
const scopedOutput = buildDiscoveryFeedQualityCleanupOutput({ plan: scopedPlan, mode: "dry-run" });
assert.deepEqual(scopedOutput.selectedFeeds, ["OVD"]);
assert.deepEqual(Object.keys(scopedOutput.snapshot.perFeed), ["OVD"]);

const securityFeaturesScopedPlan = buildDiscoveryFeedQualityCleanupPlan([
  {
    ...article({ id: "012", feedName: "Security Features", title: "Generic phone security features announced" }),
    feed: { id: "security-features-exact", name: "Security Features", rssUrl: securityFeaturesGoogleAlertUrl },
  },
  {
    ...article({ id: "013", feedName: "Security Features", title: "Generic phone security features announced" }),
    feed: { id: "security-features-other-alert", name: "Security Features", rssUrl: "https://www.google.com/alerts/feeds/other" },
  },
  {
    ...article({ id: "014", feedName: "Security Features archive", title: "Generic phone security features announced" }),
    feed: { id: "security-features-similar", name: "Security Features archive", rssUrl: securityFeaturesGoogleAlertUrl },
  },
], { selectedFeeds: securityFeaturesScopedArgs.selectedFeeds });
assert.deepEqual(securityFeaturesScopedPlan.snapshotIds, ["012"], "a second Security Features Google Alert feed and similarly named feed stay outside the scoped plan");

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
assert.deepEqual(output.selectedFeeds, ["OVD", "Security Features", "banknotes", "passports"]);
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
