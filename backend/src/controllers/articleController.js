import {
  countArticles,
  listArticles as listArticleRecords,
  listDistinctArticleTopics
} from "../database/articleRepository.js";
import { env } from "../config/env.js";
import { listFeeds } from "../database/feedRepository.js";
import { endOfDay, startOfDay } from "../utils/date.js";
import { toArticleDto, toFeedDto } from "../services/presenterService.js";
import { isRuntimeReady } from "../services/runtimeState.js";

const SIGNAL_QUERY_KEYWORDS = {
  "new-releases": ["issued", "released", "launched", "introduced", "unveiled"],
  regulations: ["regulation", "law", "requirement", "compliance", "policy", "directive"],
  "design-changes": ["redesign", "new design", "updated design", "new series", "portrait"],
  "security-features": ["security feature", "hologram", "watermark", "microprint", "uv ink", "intaglio"],
  technology: ["biometric", "verification", "digital id", "nfc", "mrz", "identity verification"],
  fraud: ["fraud", "fraudulent", "forged passport", "fake passport", "identity theft"],
  counterfeit: ["counterfeit", "fake notes", "forged notes", "counterfeit banknotes"],
  withdrawal: ["withdrawal", "withdrawn from circulation", "legal tender", "demonetisation", "demonetization"],
  redesign: ["redesign", "new family", "new artwork", "updated portrait"],
  polymer: ["polymer", "substrate", "plastic banknote", "polymer migration"],
  commemorative: ["commemorative", "anniversary note", "centennial"],
  rollout: ["rollout", "launched", "implemented", "deployment", "go-live"],
  delay: ["delay", "backlog", "queue", "technical outage", "technical problem"],
  "travel-disruption": ["travel disruption", "border delays", "airport delays", "entry disruption"],
  "criminal-misuse": ["terror", "terrorist", "criminal misuse", "fake passport", "forged passport"],
  biometric: ["biometric", "biometrics", "biometric checks", "fingerprint", "facial recognition"],
  "identity-theft": ["identity theft", "stolen identity"],
  "border-control": ["border control", "customs", "immigration control", "border checks"],
};

function normalizeFeedQueryValue(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const normalizedUrl = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return raw.toLowerCase();
  }
}

function getFeedQueryDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const normalizedUrl = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(normalizedUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function resolveFeedIdFromQuery(feedQuery) {
  const rawValue = String(feedQuery || "").trim();
  if (!rawValue) {
    return "";
  }

  const feeds = await listFeeds();
  const exactUrl = normalizeFeedQueryValue(rawValue);
  const domain = getFeedQueryDomain(rawValue);
  const normalizedName = rawValue.toLowerCase();

  const matchedFeed = feeds.find((feed) => {
    const feedId = String(feed.id || "").trim();
    const feedUrl = normalizeFeedQueryValue(feed.rssUrl || "");
    const feedDomain = getFeedQueryDomain(feed.rssUrl || "");
    const feedName = String(feed.name || "").trim().toLowerCase();
    return (
      feedId === rawValue
      || feedUrl === exactUrl
      || (domain && feedDomain === domain)
      || feedName === normalizedName
    );
  });

  return matchedFeed ? String(matchedFeed.id || "").trim() : "";
}

export async function listArticles(request, response) {
  try {
    if (!isRuntimeReady()) {
      response.json([]);
      return;
    }

    const {
      topic,
      feedId: requestedFeedId,
      feed,
      from,
      to,
      date,
      page = 1,
      limit = env.maxArticlePageSize,
      search,
      tag,
      signal,
      showDuplicates,
    } = request.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(env.maxArticlePageSize, Math.max(1, Number(limit) || env.maxArticlePageSize));
    const resolvedFeedId = requestedFeedId
      ? String(requestedFeedId).trim()
      : await resolveFeedIdFromQuery(feed);
    const signalKeywords = SIGNAL_QUERY_KEYWORDS[String(signal || "").trim()] || [];
    const dateFrom = date ? startOfDay(date) : null;
    const dateTo = date ? endOfDay(date) : null;

    const filters = {
      topic,
      feedId: resolvedFeedId || null,
      from: dateFrom || (from ? startOfDay(from) : null),
      to: dateTo || (to ? endOfDay(to) : null),
      search,
      tag,
      signalKeywords,
      excludeDuplicates: false
    };

    const [items, total] = await Promise.all([
      listArticleRecords(filters, {
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize
      }),
      countArticles(filters)
    ]);

    if (request.query.includePagination === "true") {
      const articleDtos = items.map(toArticleDto);
      response.json({
        items: articleDtos,
        articles: articleDtos,
        totalCount: total,
        page: pageNumber,
        limit: pageSize,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
      });
      return;
    }

    response.json(items.map(toArticleDto));
  } catch (error) {
    console.error("Articles error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to load articles" });
  }
}

export async function getArticleFilters(request, response) {
  try {
    if (!isRuntimeReady()) {
      response.json({ topics: [], feeds: [] });
      return;
    }

    const [topics, feeds] = await Promise.all([
      listDistinctArticleTopics(),
      listFeeds()
    ]);

    response.json({ topics: topics.sort(), feeds: feeds.map(toFeedDto) });
  } catch (error) {
    console.error("Article filters error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to load article filters" });
  }
}
