import { randomUUID } from "node:crypto";
import {
  acquireProfileCacheLease, listProfileCacheCandidates, loadProfileCacheActiveBuild,
  recordProfileCacheFailure, releaseProfileCacheLease, replaceProfileCacheAtomically,
} from "../database/profileCacheRepository.js";
import { listFeeds as listFeedRecords } from "../database/feedRepository.js";
import { PROFILE_MODEL, getArticleProfileDecision } from "./profileDecisionService.js";
import { toArticleDto } from "./presenterService.js";

export const BUILT_IN_PROFILE_CACHE_IDS = Object.freeze(Object.keys(PROFILE_MODEL));
export const PROFILE_CACHE_SCOPES = Object.freeze({ "7": 7, "30": 30, recent: 90, extended: 180 });
const DAY_MS = 24 * 60 * 60 * 1000;

function requireProfileId(profileId) {
  const normalized = String(profileId || "").trim();
  if (!BUILT_IN_PROFILE_CACHE_IDS.includes(normalized)) throw new Error(`Unsupported persistent profile cache: ${normalized || "unknown"}`);
  return normalized;
}

function normalizeScope(scope) {
  const raw = String(scope || "recent").trim().toLowerCase();
  const key = raw === "90" ? "recent" : raw === "180" ? "extended" : raw;
  return Object.hasOwn(PROFILE_CACHE_SCOPES, key) ? key : "recent";
}

function makeWindow(scope, now) {
  const normalizedScope = normalizeScope(scope);
  const lookbackDays = PROFILE_CACHE_SCOPES[normalizedScope];
  return { scope: normalizedScope, lookbackDays, timezone: "UTC", rolling: true, from: new Date(now.getTime() - lookbackDays * DAY_MS).toISOString(), to: now.toISOString() };
}

export function createProfileCacheService(dependencies = {}) {
  const repository = dependencies.repository || {
    loadActive: loadProfileCacheActiveBuild,
    acquireLease: acquireProfileCacheLease,
    releaseLease: releaseProfileCacheLease,
    replaceAtomically: replaceProfileCacheAtomically,
    recordFailure: recordProfileCacheFailure,
    getLastError: async (profileId) => (await loadProfileCacheActiveBuild(profileId))?.lastError || "",
  };
  const now = dependencies.now || (() => new Date());
  const listArticles = dependencies.listArticles || (async () => listProfileCacheCandidates({ since: new Date(now().getTime() - 180 * DAY_MS) }));
  const listFeeds = dependencies.listFeeds || listFeedRecords;
  const toDto = dependencies.toDto || toArticleDto;
  const rebuildPromises = new Map();
  let rebuildAllPromise = null;

  function rebuildProfile(profileId) {
    const id = requireProfileId(profileId);
    if (rebuildPromises.has(id)) return rebuildPromises.get(id);
    const promise = (async () => {
      let lease;
      try {
        lease = await repository.acquireLease({ profileId: id, ownerId: randomUUID() });
        if (!lease) return { skipped: true, profileId: id };
        const [candidates, feeds] = await Promise.all([listArticles(), listFeeds()]);
        const feedsById = new Map(feeds.map((feed) => [String(feed.id), feed]));
        const articles = candidates.filter((article) => getArticleProfileDecision(article, article.feed || feedsById.get(String(article.feedId)) || {}, id).matched);
        const generatedAt = now();
        await repository.replaceAtomically({ id: randomUUID(), profileId: id, generatedAt, articleIds: articles.map((article) => article.id), articles, lease });
        return { profileId: id, generatedAt, count: articles.length };
      } catch (error) {
        if (lease) {
          try { await repository.recordFailure(id, String(error?.message || error), lease); } catch (recordError) { console.error(`[profile-cache:${id}] failed to record rebuild error`, recordError); }
        }
        throw error;
      } finally {
        if (lease) {
          try { await repository.releaseLease(lease); } catch (releaseError) { console.error(`[profile-cache:${id}] failed to release rebuild lease`, releaseError); }
        }
        rebuildPromises.delete(id);
      }
    })();
    rebuildPromises.set(id, promise);
    return promise;
  }

  function rebuild(profileId) {
    const id = requireProfileId(profileId);
    if (rebuildAllPromise) {
      return rebuildAllPromise.then((results) => results.find((result) => result.profileId === id));
    }
    return rebuildProfile(id);
  }

  async function read(profileId, scope) {
    const id = requireProfileId(profileId);
    const requestedAt = now();
    const window = makeWindow(scope, requestedAt);
    const active = await repository.loadActive(id);
    const lastError = String(active?.lastError || await repository.getLastError?.(id) || "");
    const entries = active?.activeBuild?.entries || active?.entries || active?.articles || [];
    const articles = entries.map((entry) => entry.article || entry).filter(Boolean)
      .filter((article) => new Date(article.pubDate).getTime() >= new Date(window.from).getTime())
      .sort((left, right) => new Date(right.pubDate) - new Date(left.pubDate))
      .map((article) => toDto(article, article.feed || {}));
    const hasBuild = Boolean(active?.activeBuild || active?.generatedAt || active?.articles);
    const state = rebuildPromises.has(id) ? "building" : hasBuild ? (lastError ? "stale" : "ready") : lastError ? "error" : "never-built";
    return { profileId: id, state, generatedAt: active?.generatedAt || active?.activeBuild?.generatedAt || null, error: lastError || null, window, articles };
  }

  function rebuildAll() {
    if (rebuildAllPromise) return rebuildAllPromise;
    const promise = (async () => {
      try {
        const results = [];
        for (const profileId of BUILT_IN_PROFILE_CACHE_IDS) {
          results.push(await rebuildProfile(profileId));
        }
        return results;
      } finally {
        if (rebuildAllPromise === promise) rebuildAllPromise = null;
      }
    })();
    rebuildAllPromise = promise;
    return promise;
  }

  return { rebuild, rebuildAll, read, isBuilding: (profileId) => rebuildPromises.has(requireProfileId(profileId)) };
}

export const profileCacheService = createProfileCacheService();
