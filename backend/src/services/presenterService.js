import { env } from "../config/env.js";
import {
  getCatalogEntryCountry,
  getCatalogEntryMode,
  getCatalogEntrySourceFamily,
  getCatalogEntrySubdivision,
  getCatalogEntrySubdivisionType,
  getDmvCatalogEntry,
} from "./dmvCatalogService.js";

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

function isGovUkPublishingAssetImage(value) {
  try {
    const parsed = new URL(String(value || ""));
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return hostname === "assets.publishing.service.gov.uk" && parsed.pathname.includes("/media/");
  } catch {
    return false;
  }
}

function isPresentableArticleThumbnail(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === env.placeholderImage) {
    return false;
  }

  if (isGovUkPublishingAssetImage(normalized)) {
    return true;
  }

  const lower = normalized.toLowerCase();
  if (["logo", "icon", "avatar", "pixel", "tracking"].some((token) => lower.includes(token))) {
    return false;
  }
  if (/\.(?:jpg|jpeg|png|gif|webp|avif|svg)(?:$|[?#])/i.test(lower)) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname || pathname === "/" || /\.(?:html?|php|aspx?)(?:$|[?#])/i.test(pathname)) {
      return false;
    }
    if (
      pathname.includes("/binaries/content/gallery/") &&
      /\.(?:jpg|jpeg|png|gif|webp|avif|svg)(?:\/|$)/i.test(pathname)
    ) {
      return true;
    }
    return ["/image/", "/images/", "/media/", "/uploads/", "/files/", "/assets/"].some((segment) =>
      pathname.includes(segment)
    );
  } catch {
    return false;
  }
}

export function toFeedDto(feed) {
  const dmvCatalogEntry = getDmvCatalogEntry(feed);
  const dmvCountry = dmvCatalogEntry ? getCatalogEntryCountry(dmvCatalogEntry) : null;

  return {
    id: String(feed.id || feed._id),
    name: feed.name,
    topic: feed.topic,
    rssUrl: feed.rssUrl,
    officialUrl: dmvCatalogEntry?.official_url || null,
    dmvState: dmvCatalogEntry?.state || null,
    dmvAbbr: dmvCatalogEntry?.abbr || null,
    dmvFeedPath: dmvCatalogEntry?.feed_path || null,
    dmvRegion: dmvCatalogEntry ? dmvCatalogEntry.region || dmvCountry : null,
    dmvCountry,
    dmvSubdivision: dmvCatalogEntry ? getCatalogEntrySubdivision(dmvCatalogEntry) : null,
    dmvSubdivisionType: dmvCatalogEntry ? getCatalogEntrySubdivisionType(dmvCatalogEntry) : null,
    dmvSourceFamily: dmvCatalogEntry ? getCatalogEntrySourceFamily(dmvCatalogEntry) : null,
    dmvMode: dmvCatalogEntry ? getCatalogEntryMode(dmvCatalogEntry) : null,
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
    thumbnail: isPresentableArticleThumbnail(article.thumbnail) ? article.thumbnail : env.placeholderImage,
    summary: article.summary || "",
    summaryShort: article.summaryShort || "",
    keywords: Array.isArray(article.keywords) ? article.keywords : [],
    tags: Array.isArray(article.tags)
      ? article.tags
      : Array.isArray(article.keywords)
        ? article.keywords
        : [],
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

  return dto;
}
