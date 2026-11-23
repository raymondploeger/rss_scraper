import assert from "node:assert/strict";
import { createProfileCacheService } from "../backend/src/services/profileCacheService.js";
import {
  PROFILE_CACHE_PAGE_SIZE,
  advanceProfileCachePage,
  createProfileCachePageState,
  getProfileCachePageUrl,
} from "../frontend/public/profile-cache-client.js";

const now = new Date("2026-11-23T12:00:00.000Z");
const entries = Array.from({ length: 5_203 }, (_unused, index) => ({
  id: `article-${String(index).padStart(5, "0")}`,
  feedId: "feed-1",
  pubDate: new Date(now.getTime() - Math.floor(index / 3) * 60_000),
  title: `Article ${index}`,
  link: `https://example.test/articles/${index}`,
  canonicalLink: `https://example.test/articles/${index}`,
  source: "Example source",
  topic: "Identity",
  thumbnail: "https://example.test/image.png",
  summary: "x".repeat(20_000),
  contentSnippet: "y".repeat(20_000),
  profileDecisions: Array.from({ length: 40 }, () => ({ rationale: "z".repeat(2_000) })),
  keywords: Array.from({ length: 400 }, () => "large-keyword"),
}));

const persisted = new Map([["passport_authority", {
  id: "build-1",
  generatedAt: now,
  activeBuild: { id: "build-1", generatedAt: now, entries: entries.map((article) => ({ article })) },
}]]);
const service = createProfileCacheService({
  repository: {
    async loadActive(profileId) { return persisted.get(profileId) || null; },
    async getLastError() { return ""; },
  },
  now: () => now,
});

const first = await service.read("passport_authority", "recent", { limit: 999 });
assert.equal(first.state, "ready");
assert.equal(first.total, 5_203);
assert.equal(first.items.length, 100, "profile cache pages are hard capped at 100 cards");
assert.ok(first.nextCursor, "a full page has an opaque next cursor");
assert.equal(first.articles, undefined, "cache response does not expose a whole articles array");
for (const item of first.items) {
  assert.equal(Object.hasOwn(item, "summary"), false, "full summaries are omitted from cache cards");
  assert.equal(Object.hasOwn(item, "contentSnippet"), false, "content snippets are omitted from cache cards");
  assert.equal(Object.hasOwn(item, "profileDecisions"), false, "profile decisions are omitted from cache cards");
  assert.equal(Object.hasOwn(item, "keywords"), false, "unrelated large arrays are omitted from cache cards");
}
assert.ok(Buffer.byteLength(JSON.stringify(first)) < 100_000, "a 100-card response stays compact despite heavyweight cached articles");

const ids = [];
let page = first;
while (page) {
  ids.push(...page.items.map((item) => item.id));
  page = page.nextCursor
    ? await service.read("passport_authority", "recent", { cursor: page.nextCursor, limit: 100 })
    : null;
}
assert.equal(ids.length, 5_203);
assert.equal(new Set(ids).size, 5_203, "cursor traversal has no duplicates");
assert.deepEqual(ids, entries.slice().sort((left, right) => (
  new Date(right.pubDate) - new Date(left.pubDate) || String(left.id).localeCompare(String(right.id))
)).map((article) => article.id), "cursor traversal has no gaps and uses stable pubDate/id ordering");

const failed = createProfileCacheService({
  repository: {
    async loadActive() { return { activeBuild: null, lastError: "build failed" }; },
    async getLastError() { return "build failed"; },
  },
  now: () => now,
});
const failedResponse = await failed.read("passport_authority", "recent");
assert.equal(failedResponse.state, "error");
assert.deepEqual(failedResponse.items, [], "failed initial caches are fail-closed");
assert.equal(failedResponse.total, 0);

let releaseFirstBuild;
const firstBuildGate = new Promise((resolve) => { releaseFirstBuild = resolve; });
const building = createProfileCacheService({
  repository: {
    async acquireLease({ profileId, ownerId }) { return { profileId, ownerId, generation: 1 }; },
    async releaseLease() {},
    async loadActive() { return null; },
    async replaceAtomically() {},
    async recordFailure() {},
    async getLastError() { return ""; },
  },
  listArticles: async () => { await firstBuildGate; return []; },
  listFeeds: async () => [],
  now: () => now,
});
const initialBuild = building.rebuild("passport_authority");
await Promise.resolve();
const buildingResponse = await building.read("passport_authority", "recent");
assert.equal(buildingResponse.state, "building");
assert.deepEqual(buildingResponse.items, [], "an initial build is fail-closed until a successful cache exists");
releaseFirstBuild();
await initialBuild;

assert.equal(PROFILE_CACHE_PAGE_SIZE, 30, "the UI page remains bounded below the API maximum");
const firstUrl = getProfileCachePageUrl("passport_authority", "recent");
assert.match(firstUrl, /scope=recent/);
assert.equal(firstUrl.includes("cursor="), false, "first page requests only page one");
const firstState = createProfileCachePageState({ requestKey: "one", response: { items: [{ id: "one" }], total: 5_203, nextCursor: "cursor-2" } });
const secondState = advanceProfileCachePage(firstState, { requestKey: "one", response: { items: [{ id: "two" }], total: 5_203, nextCursor: "cursor-3" } });
assert.deepEqual(secondState.items.map((item) => item.id), ["two"], "load-more retains only the current bounded page");
assert.equal(secondState.nextCursor, "cursor-3");
assert.equal(advanceProfileCachePage(firstState, { requestKey: "changed", response: { items: [{ id: "stale" }] } }), null, "scope/profile/filter changes invalidate old pagination responses");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 5_223 })}\n`);
