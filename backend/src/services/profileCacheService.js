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
export const PROFILE_CACHE_DEFAULT_PAGE_SIZE = 30;
export const PROFILE_CACHE_MAX_PAGE_SIZE = 100;
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

function normalizePageSize(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Math.min(PROFILE_CACHE_MAX_PAGE_SIZE, Math.max(1, Number.isFinite(parsed) ? parsed : PROFILE_CACHE_DEFAULT_PAGE_SIZE));
}

function makeCursor({ buildId, scope, article }) {
  return Buffer.from(JSON.stringify({ buildId, scope, pubDate: new Date(article.pubDate).toISOString(), id: String(article.id) })).toString("base64url");
}

function parseCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!parsed?.buildId || !parsed?.scope || !parsed?.pubDate || !parsed?.id || Number.isNaN(new Date(parsed.pubDate).getTime())) throw new Error("invalid");
    return parsed;
  } catch {
    throw new Error("Invalid profile cache cursor");
  }
}

function compareArticles(left, right) {
  return new Date(right.pubDate).getTime() - new Date(left.pubDate).getTime() || String(left.id).localeCompare(String(right.id));
}

function toCompactCard(article, feed, toDto) {
  const dto = toDto(article, feed);
  return {
    id: dto.id,
    title: dto.title || "",
    normalizedTitle: dto.normalizedTitle || "",
    link: dto.link || "",
    canonicalLink: dto.canonicalLink || dto.link || "",
    pubDate: dto.pubDate || null,
    source: dto.source || "",
    topic: dto.topic || "",
    feedId: dto.feedId || "",
    thumbnail: dto.thumbnail || "",
    summaryShort: dto.summaryShort || "",
    author: dto.author || "",
    clusterId: dto.clusterId || null,
    duplicateGroupId: dto.duplicateGroupId || null,
    isDuplicate: dto.isDuplicate === true,
    duplicateOf: dto.duplicateOf || null,
    language: dto.language || "unknown",
    fetchStatus: dto.fetchStatus || "pending",
  };
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

  async function read(profileId, scope, options = {}) {
    const id = requireProfileId(profileId);
    const requestedAt = now();
    const window = makeWindow(scope, requestedAt);
    const active = await repository.loadActive(id);
    const lastError = String(active?.lastError || await repository.getLastError?.(id) || "");
    const entries = active?.activeBuild?.entries || active?.entries || active?.articles || [];
    const hasBuild = Boolean(active?.activeBuild || active?.generatedAt || active?.articles);
    const state = hasBuild
      ? (lastError || rebuildPromises.has(id) ? "stale" : "ready")
      : rebuildPromises.has(id) ? "building" : lastError ? "error" : "never-built";
    const buildId = String(active?.activeBuild?.id || active?.id || active?.generatedAt || "");
    const cursor = parseCursor(options.cursor);
    if (cursor && (cursor.buildId !== buildId || cursor.scope !== window.scope)) throw new Error("Profile cache cursor no longer matches the active cache build");
    if (state !== "ready" && state !== "stale") {
      return { profileId: id, state, generatedAt: active?.generatedAt || active?.activeBuild?.generatedAt || null, error: lastError || null, window, total: 0, nextCursor: null, items: [] };
    }
    const articles = entries.map((entry) => entry.article || entry).filter(Boolean)
      .filter((article) => new Date(article.pubDate).getTime() >= new Date(window.from).getTime())
      .sort(compareArticles);
    const afterCursor = cursor
      ? articles.filter((article) => compareArticles(article, { pubDate: cursor.pubDate, id: cursor.id }) > 0)
      : articles;
    const pageSize = normalizePageSize(options.limit);
    const pageArticles = afterCursor.slice(0, pageSize);
    const items = pageArticles.map((article) => toCompactCard(article, article.feed || {}, toDto));
    const last = pageArticles.at(-1);
    return {
      profileId: id, state, generatedAt: active?.generatedAt || active?.activeBuild?.generatedAt || null,
      error: lastError || null, window, total: articles.length, items,
      nextCursor: last && afterCursor.length > pageArticles.length ? makeCursor({ buildId, scope: window.scope, article: last }) : null,
    };
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
