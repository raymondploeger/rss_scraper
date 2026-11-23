import assert from "node:assert/strict";
import {
  CENTRAL_BANK_CACHE_SCOPES,
  createCentralBankCacheService,
} from "../backend/src/services/centralBankCacheService.js";

const now = new Date("2026-11-23T12:00:00.000Z");
const matchingFeed = { id: "feed-central", profileAffinities: ["central_bank"] };
const matchingArticle = {
  id: "matching", feedId: "feed-central", pubDate: new Date("2026-11-20T12:00:00.000Z"),
  profileSignals: ["central_bank"], domains: ["banknotes"], classifications: ["banknote_design"],
};
const rejectedArticle = { ...matchingArticle, id: "rejected", profileSignals: [] };
const extendedOnlyArticle = {
  ...matchingArticle,
  id: "extended-only",
  pubDate: new Date("2026-08-10T12:00:00.000Z"),
};

const persisted = { active: null, error: "", builds: [] };
const repository = {
  async acquireLease({ ownerId }) { return { ownerId, generation: 1 }; },
  async releaseLease() {},
  async loadActive() { return persisted.active; },
  async replaceAtomically(build) {
    persisted.builds.push(build);
    persisted.active = build;
    persisted.error = "";
  },
  async recordFailure(error) { persisted.error = error; },
  async getLastError() { return persisted.error; },
};

let sourceArticles = [matchingArticle, extendedOnlyArticle, rejectedArticle];
const service = createCentralBankCacheService({
  repository,
  listArticles: async () => sourceArticles,
  listFeeds: async () => [matchingFeed],
  toDto: (article, feed) => ({ id: article.id, feedId: feed.id, pubDate: article.pubDate.toISOString() }),
  now: () => now,
});

assert.deepEqual(Object.keys(CENTRAL_BANK_CACHE_SCOPES), ["7", "30", "recent", "extended"]);
assert.equal((await service.read("recent")).state, "never-built");

await service.rebuild();
const recent = await service.read("recent");
assert.equal(recent.state, "ready");
assert.deepEqual(recent.articles.map((article) => article.id), ["matching"]);
assert.equal(recent.window.timezone, "UTC");
assert.equal(recent.window.lookbackDays, 90);
assert.equal((await service.read("7")).articles.length, 1, "7-day rolling scope uses the same UTC contract");
assert.equal((await service.read("30")).articles.length, 1, "30-day rolling scope excludes older cached records");
assert.equal((await service.read("90")).window.lookbackDays, 90, "90 aliases the recent cache scope");
assert.deepEqual((await service.read("extended")).articles.map((article) => article.id), ["matching", "extended-only"]);
assert.equal(persisted.active.articles.length, 2, "only server-authoritative profile matches enter the cache");

const priorBuildId = persisted.active.id;
sourceArticles = [matchingArticle];
repository.replaceAtomically = async () => { throw new Error("simulated atomic write failure"); };
await assert.rejects(() => service.rebuild(), /simulated atomic write failure/);
const stale = await service.read("recent");
assert.equal(stale.state, "stale", "a failed refresh preserves the prior complete cache");
assert.equal(stale.articles[0].id, "matching");
assert.equal(persisted.active.id, priorBuildId);

const failedEmptyRepository = {
  async acquireLease({ ownerId }) { return { ownerId, generation: 1 }; },
  async releaseLease() {},
  async loadActive() { return null; },
  async replaceAtomically() { throw new Error("first build failed"); },
  async recordFailure(error) { this.error = error; },
  async getLastError() { return this.error || ""; },
};
const failedEmptyService = createCentralBankCacheService({
  repository: failedEmptyRepository, listArticles: async () => [], listFeeds: async () => [], now: () => now,
});
await assert.rejects(() => failedEmptyService.rebuild(), /first build failed/);
assert.equal((await failedEmptyService.read("30")).state, "error", "a failed initial build must not authorize live fallback");

const leaseEvents = [];
let currentGeneration = 1;
let authoritativeGeneration = 0;
let publishedGeneration = 0;
let coordinatedLastError = "";
let releaseFirstBuild;
const firstBuildGate = new Promise((resolve) => { releaseFirstBuild = resolve; });
const coordinatedRepository = {
  async acquireLease({ ownerId }) {
    const generation = currentGeneration++;
    authoritativeGeneration = generation;
    leaseEvents.push(["acquire", generation]);
    return { ownerId, generation };
  },
  async replaceAtomically({ lease }) {
    leaseEvents.push(["publish", lease.generation]);
    if (lease.generation === authoritativeGeneration) {
      publishedGeneration = lease.generation;
      coordinatedLastError = "";
    }
  },
  async recordFailure(_error, lease) {
    leaseEvents.push(["failure", lease.generation]);
    if (lease.generation === authoritativeGeneration) coordinatedLastError = _error;
  },
  async releaseLease(lease) {
    leaseEvents.push(["release", lease.generation]);
  },
  async loadActive() { return null; },
  async getLastError() { return ""; },
};
const lateFailureService = createCentralBankCacheService({
  repository: coordinatedRepository,
  listArticles: async () => {
    await firstBuildGate;
    throw new Error("late generation failed");
  },
  listFeeds: async () => [],
  now: () => now,
});
const newerSuccessService = createCentralBankCacheService({
  repository: coordinatedRepository,
  listArticles: async () => [],
  listFeeds: async () => [],
  now: () => now,
});
const lateFailure = lateFailureService.rebuild();
await Promise.resolve();
await newerSuccessService.rebuild();
releaseFirstBuild();
await assert.rejects(lateFailure, /late generation failed/);
assert.deepEqual(
  leaseEvents,
  [["acquire", 1], ["acquire", 2], ["publish", 2], ["release", 2], ["failure", 1], ["release", 1]],
  "each rebuild must release its lease, and the repository receives the failed build's generation so it can ignore a late failure"
);
assert.equal(publishedGeneration, 2, "the newer lease owns the published cache");
assert.equal(coordinatedLastError, "", "a late failure from generation 1 cannot make generation 2 stale");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 19 })}\n`);
