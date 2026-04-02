import { env } from "../config/env.js";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DMV_BASE_URL = "https://rssdmv-production.up.railway.app";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DMV_CATALOG_PATH = path.resolve(__dirname, "../../data/dmvFeeds.json");

let cachedDmvCatalog = null;

function loadDmvCatalog() {
  if (cachedDmvCatalog) {
    return cachedDmvCatalog;
  }

  try {
    const raw = readFileSync(DMV_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    cachedDmvCatalog = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedDmvCatalog = [];
  }

  return cachedDmvCatalog;
}

function getDmvCatalogEntry(feed) {
  const rssUrl = String(feed?.rssUrl || "");
  if (!rssUrl.includes(`${DMV_BASE_URL}/feeds/`)) {
    return null;
  }

  return (
    loadDmvCatalog().find((entry) => {
      const feedPath = String(entry?.feed_path || "");
      return feedPath && rssUrl.endsWith(feedPath);
    }) || null
  );
}

function isNotafiliaUrl(value) {
  try {
    return new URL(String(value || "")).hostname === "news.notafilia.pl";
  } catch {
    return false;
  }
}

function resolveCanonicalLink(canonicalLink, link) {
  if (!canonicalLink) {
    return link;
  }

  try {
    return new URL(canonicalLink).toString();
  } catch {
    try {
      return new URL(canonicalLink, link).toString();
    } catch {
      return link;
    }
  }
}

export function toFeedDto(feed) {
  const dmvCatalogEntry = getDmvCatalogEntry(feed);

  return {
    id: String(feed.id || feed._id),
    name: feed.name,
    topic: feed.topic,
    rssUrl: feed.rssUrl,
    officialUrl: dmvCatalogEntry?.official_url || null,
    dmvState: dmvCatalogEntry?.state || null,
    dmvAbbr: dmvCatalogEntry?.abbr || null,
    dmvFeedPath: dmvCatalogEntry?.feed_path || null,
    sourceType: feed.sourceType || "rss",
    sourceFallbackImage: feed.sourceFallbackImage || null,
    isActive: feed.isActive !== false,
    lastFetchedAt: feed.lastFetchedAt || null,
    lastStatus: feed.lastStatus || "idle",
    lastInsertedCount: typeof feed.lastInsertedCount === "number" ? feed.lastInsertedCount : 0,
    lastError: feed.lastError || null,
    createdAt: feed.createdAt,
    updatedAt: feed.updatedAt
  };
}

export function toArticleDto(article) {
  const dto = {
    id: String(article.id || article._id),
    title: article.title,
    normalizedTitle: article.normalizedTitle || "",
    link: article.link,
    canonicalLink: resolveCanonicalLink(article.canonicalLink, article.link),
    pubDate: article.pubDate,
    source: article.source,
    topic: article.topic,
    feedId: String(article.feedId),
    thumbnail: article.thumbnail || env.placeholderImage,
    summary: article.summary || "",
    summaryShort: article.summaryShort || "",
    keywords: Array.isArray(article.keywords) ? article.keywords : [],
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    contentSnippet: article.contentSnippet || "",
    author: article.author || "",
    clusterId: article.clusterId || null,
    duplicateGroupId: article.duplicateGroupId || null,
    isDuplicate: article.isDuplicate === true,
    duplicateOf: article.duplicateOf || null,
    language: article.language || "unknown",
    fetchStatus: article.fetchStatus || "pending"
  };

  if (isNotafiliaUrl(dto.link) || isNotafiliaUrl(dto.canonicalLink) || isNotafiliaUrl(dto.thumbnail)) {
    console.log(`[notafilia][api] articleUrl=${dto.canonicalLink || dto.link} returnedThumbnail=${dto.thumbnail || ""}`);
  }

  return dto;
}
