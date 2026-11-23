import { randomUUID } from "node:crypto";
import {
  listCentralBankCacheCandidates,
  loadCentralBankCacheActiveBuild,
  acquireCentralBankCacheLease,
  releaseCentralBankCacheLease,
  recordCentralBankCacheFailure,
  replaceCentralBankCacheAtomically,
} from "../database/centralBankCacheRepository.js";
import { listFeeds as listFeedRecords } from "../database/feedRepository.js";
import { getArticleProfileDecision } from "./profileDecisionService.js";
import { toArticleDto } from "./presenterService.js";

export const CENTRAL_BANK_CACHE_SCOPES = Object.freeze({ "7": 7, "30": 30, recent: 90, extended: 180 });
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeScope(scope) {
  const raw = String(scope || "recent").trim().toLowerCase();
  const key = raw === "90" ? "recent" : raw === "180" ? "extended" : raw;
  return Object.hasOwn(CENTRAL_BANK_CACHE_SCOPES, key) ? key : "recent";
}

function makeWindow(scope, now) {
  const normalizedScope = normalizeScope(scope);
  const lookbackDays = CENTRAL_BANK_CACHE_SCOPES[normalizedScope];
  return { scope: normalizedScope, lookbackDays, timezone: "UTC", rolling: true, from: new Date(now.getTime() - lookbackDays * DAY_MS).toISOString(), to: now.toISOString() };
}

export function createCentralBankCacheService(dependencies = {}) {
  const repository = dependencies.repository || {
    loadActive: loadCentralBankCacheActiveBuild,
    acquireLease: acquireCentralBankCacheLease,
    releaseLease: releaseCentralBankCacheLease,
    replaceAtomically: async (build) => replaceCentralBankCacheAtomically({ generatedAt: build.generatedAt, articleIds: build.articleIds, lease: build.lease }),
    recordFailure: recordCentralBankCacheFailure,
    getLastError: async () => (await loadCentralBankCacheActiveBuild())?.lastError || "",
  };
  const listArticles = dependencies.listArticles || (async () => listCentralBankCacheCandidates({ since: new Date((dependencies.now || (() => new Date()))().getTime() - 180 * DAY_MS) }));
  const listFeeds = dependencies.listFeeds || listFeedRecords;
  const toDto = dependencies.toDto || toArticleDto;
  const now = dependencies.now || (() => new Date());
  let rebuildPromise = null;

  async function rebuild() {
    if (rebuildPromise) return rebuildPromise;
    rebuildPromise = (async () => {
      let lease;
      try {
        lease = await repository.acquireLease({ ownerId: randomUUID() });
        if (!lease) return { skipped: true };
        const [candidates, feeds] = await Promise.all([listArticles(), listFeeds()]);
        const feedsById = new Map(feeds.map((feed) => [String(feed.id), feed]));
        const articles = candidates.filter((article) => getArticleProfileDecision(
          article,
          article.feed || feedsById.get(String(article.feedId)) || {},
          "central_bank"
        ).matched);
        const generatedAt = now();
        await repository.replaceAtomically({ id: randomUUID(), generatedAt, articleIds: articles.map((article) => article.id), articles, lease });
        return { generatedAt, count: articles.length };
      } catch (error) {
        if (lease) {
          try { await repository.recordFailure(String(error?.message || error), lease); } catch (recordError) { console.error("[central-bank-cache] failed to record rebuild error", recordError); }
        }
        throw error;
      } finally {
        if (lease) {
          try { await repository.releaseLease(lease); } catch (releaseError) { console.error("[central-bank-cache] failed to release rebuild lease", releaseError); }
        }
        rebuildPromise = null;
      }
    })();
    return rebuildPromise;
  }

  async function read(scope) {
    const requestedAt = now();
    const window = makeWindow(scope, requestedAt);
    const active = await repository.loadActive();
    const lastError = String(active?.lastError || await repository.getLastError?.() || "");
    const entries = active?.activeBuild?.entries || active?.entries || active?.articles || [];
    const sourceArticles = entries.map((entry) => entry.article || entry).filter(Boolean);
    const articles = sourceArticles
      .filter((article) => new Date(article.pubDate).getTime() >= new Date(window.from).getTime())
      .sort((left, right) => new Date(right.pubDate) - new Date(left.pubDate))
      .map((article) => toDto(article, article.feed || {}));
    const hasBuild = Boolean(active?.activeBuild || active?.id || active?.generatedAt || active?.articles);
    const state = rebuildPromise ? "building" : hasBuild ? (lastError ? "stale" : "ready") : lastError ? "error" : "never-built";
    return { profileId: "central_bank", state, generatedAt: active?.generatedAt || active?.activeBuild?.generatedAt || null, error: lastError || null, window, articles };
  }
  return { rebuild, read, isBuilding: () => Boolean(rebuildPromise) };
}

export const centralBankCacheService = createCentralBankCacheService();
