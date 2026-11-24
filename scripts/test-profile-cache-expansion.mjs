import assert from "node:assert/strict";
import { PROFILE_MODEL, getArticleProfileDecision } from "../backend/src/services/profileDecisionService.js";
import {
  BUILT_IN_PROFILE_CACHE_IDS,
  PROFILE_CACHE_SCOPES,
  createProfileCacheService,
} from "../backend/src/services/profileCacheService.js";
import { getPersistentProfileCacheSelection } from "../frontend/public/profile-cache-client.js";

const now = new Date("2026-11-23T12:00:00.000Z");
const profileIds = Object.keys(PROFILE_MODEL);
assert.deepEqual(BUILT_IN_PROFILE_CACHE_IDS, profileIds, "every built-in backend profile has a cache identity");
assert.deepEqual(Object.keys(PROFILE_CACHE_SCOPES), ["7", "30", "recent", "extended"]);

const matchingArticles = Object.fromEntries(profileIds.map((profileId, index) => {
  const profile = PROFILE_MODEL[profileId];
  return [profileId, {
    id: `${profileId}-article`,
    feedId: `${profileId}-feed`,
    pubDate: new Date(now.getTime() - (index % 2 ? 10 : 2) * 24 * 60 * 60 * 1000),
    profileSignals: profileId === "vendors" || profileId === "researcher" ? [] : [profileId],
    domains: [profile.domains[0]],
    classifications: ["verified_industry_article"],
    title: `${profileId} verified industry update`,
  }];
}));
const feeds = profileIds.map((profileId) => ({ id: `${profileId}-feed`, profileAffinities: [profileId] }));

for (const profileId of profileIds) {
  assert.equal(
    getArticleProfileDecision(matchingArticles[profileId], feeds.find((feed) => feed.id === `${profileId}-feed`), profileId).matched,
    true,
    `${profileId} cache eligibility remains backend-authoritative`
  );
}

const persisted = new Map();
const failures = new Map();
const repository = {
  async acquireLease({ profileId, ownerId }) { return { profileId, ownerId, generation: (persisted.get(profileId)?.generation || 0) + 1 }; },
  async releaseLease() {},
  async loadActive(profileId) { return persisted.get(profileId) || null; },
  async replaceAtomically(build) { persisted.set(build.profileId, { ...build, generation: build.lease.generation }); failures.delete(build.profileId); },
  async recordFailure(profileId, error) { failures.set(profileId, error); },
  async getLastError(profileId) { return failures.get(profileId) || ""; },
};

const service = createProfileCacheService({
  repository,
  listArticles: async () => Object.values(matchingArticles),
  listFeeds: async () => feeds,
  toDto: (article, feed) => ({ id: article.id, feedId: feed.id, pubDate: article.pubDate.toISOString() }),
  now: () => now,
});

await Promise.all(profileIds.map((profileId) => service.rebuild(profileId)));
for (const profileId of profileIds) {
  const response = await service.read(profileId, "recent");
  assert.equal(response.profileId, profileId);
  assert.equal(response.state, "ready");
  assert.deepEqual(response.items.map((article) => article.id), [`${profileId}-article`], `${profileId} reads only its own build`);
  assert.equal((await service.read(profileId, "7")).window.lookbackDays, 7);
  assert.equal((await service.read(profileId, "30")).window.lookbackDays, 30);
  assert.equal((await service.read(profileId, "90")).window.lookbackDays, 90);
  assert.equal((await service.read(profileId, "180")).window.lookbackDays, 180);
}

const coalescedPersisted = new Map();
let candidateScans = 0;
let markSecondProfileStarted;
const secondProfileStarted = new Promise((resolve) => { markSecondProfileStarted = resolve; });
let releaseSecondProfile;
const secondProfileGate = new Promise((resolve) => { releaseSecondProfile = resolve; });
const coalescedService = createProfileCacheService({
  repository: {
    async acquireLease({ profileId, ownerId }) { return { profileId, ownerId, generation: 1 }; },
    async releaseLease() {},
    async loadActive(profileId) { return coalescedPersisted.get(profileId) || null; },
    async replaceAtomically(build) { coalescedPersisted.set(build.profileId, build); },
    async recordFailure() {},
    async getLastError() { return ""; },
  },
  listArticles: async () => {
    candidateScans += 1;
    if (candidateScans === 2) {
      markSecondProfileStarted();
      await secondProfileGate;
    }
    return Object.values(matchingArticles);
  },
  listFeeds: async () => feeds,
  now: () => now,
});
const firstFullRebuild = coalescedService.rebuildAll();
await secondProfileStarted;
const overlappingFullRebuild = coalescedService.rebuildAll();
const singleProfileDuringFullRebuild = coalescedService.rebuild("passport_authority");
assert.strictEqual(overlappingFullRebuild, firstFullRebuild, "overlapping full rebuilds share the service-wide promise");
releaseSecondProfile();
const [fullRebuildResults, repeatedFullRebuildResults, singleProfileResult] = await Promise.all([
  firstFullRebuild,
  overlappingFullRebuild,
  singleProfileDuringFullRebuild,
]);
assert.strictEqual(repeatedFullRebuildResults, fullRebuildResults, "the overlapping caller receives the same full rebuild result");
assert.equal(singleProfileResult.profileId, "passport_authority", "single-profile trigger joins the active full rebuild");
assert.equal(candidateScans, profileIds.length, "an active full rebuild performs no duplicate candidate scans");

const centralBeforeFailure = persisted.get("central_bank").id;
repository.replaceAtomically = async (build) => {
  if (build.profileId === "passport_authority") throw new Error("passport atomic replacement failed");
  persisted.set(build.profileId, { ...build, generation: build.lease.generation });
};
await assert.rejects(() => service.rebuild("passport_authority"), /passport atomic replacement failed/);
assert.equal((await service.read("passport_authority", "recent")).state, "stale", "a failed profile keeps its prior complete build");
assert.equal(persisted.get("central_bank").id, centralBeforeFailure, "one profile failure cannot replace another profile's build");
assert.equal((await service.read("central_bank", "recent")).state, "ready", "one profile failure cannot poison another profile state");

const failedInitialRepository = {
  async acquireLease({ profileId, ownerId }) { return { profileId, ownerId, generation: 1 }; },
  async releaseLease() {},
  async loadActive(profileId) { return { id: profileId, activeBuild: null, lastError: this.error || "" }; },
  async replaceAtomically() { throw new Error("first build failed"); },
  async recordFailure(_profileId, error) { this.error = error; },
  async getLastError() { return this.error || ""; },
};
const failedInitialService = createProfileCacheService({ repository: failedInitialRepository, listArticles: async () => [], listFeeds: async () => [], now: () => now });
await assert.rejects(() => failedInitialService.rebuild("border_control"), /first build failed/);
assert.equal((await failedInitialService.read("border_control", "recent")).state, "error", "a failed first build must stay fail-closed even though its lease created a state row");

for (const profileId of profileIds) {
  assert.deepEqual(
    getPersistentProfileCacheSelection({ profileId, filters: { trackedSourcesAll: true } }),
    { profileId, eligible: true },
    `${profileId} exact built-in profile with all tracked sources is cache-first`
  );
}
assert.equal(getPersistentProfileCacheSelection({ profileId: "passport_authority", filters: {} }).eligible, false, "an omitted all-tracked-sources flag bypasses cache");
assert.equal(getPersistentProfileCacheSelection({ profileId: "passport_authority", filters: { trackedSourcesAll: false } }).eligible, false, "a disabled all-tracked-sources flag bypasses cache");
for (const filters of [{ feedId: "feed" }, { sourceGroup: "Vendors" }, { search: "passport" }, { date: "2026-11-20" }, { favoritesOnly: true }]) {
  assert.equal(getPersistentProfileCacheSelection({ profileId: "passport_authority", filters }).eligible, false, "source/search/date/favorites filters bypass cache");
}
assert.equal(getPersistentProfileCacheSelection({ profileId: "custom", filters: {} }).eligible, false, "custom combinations are never cached");
assert.equal(getPersistentProfileCacheSelection({ profileId: "passport_authority", exactProfile: false, filters: {} }).eligible, false, "a built-in template with custom refinements is not cached");

// Regression: the Industry Research profile persisted by older clients retained
// the display spelling "All" for the all-tracked-sources scope. It is the exact
// built-in set (including the legacy document_counterfeiting interest alias),
// not a custom or combined profile, and must remain cache-first.
const storedResearcherProfile = {
  interests: [
    "banknotes",
    "passports",
    "id_cards",
    "document_counterfeiting",
    "icao",
    "digital_identity",
    "identity_verification",
  ],
  activeTemplateId: "researcher",
  activeTemplateIds: ["researcher"],
};
assert.deepEqual(
  getPersistentProfileCacheSelection({
    profileId: storedResearcherProfile.activeTemplateId,
    exactProfile: true,
    filters: { sourceGroup: "All", trackedSourcesAll: true },
  }),
  { profileId: "researcher", eligible: true },
  "the exact stored Industry Research profile with all tracked sources stays cache-first"
);
assert.equal(
  getPersistentProfileCacheSelection({
    profileId: "researcher",
    exactProfile: false,
    filters: { sourceGroup: "All", trackedSourcesAll: true },
  }).eligible,
  false,
  "a refined or multi-template Industry Research state remains ineligible for the cache"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 74 })}\n`);
