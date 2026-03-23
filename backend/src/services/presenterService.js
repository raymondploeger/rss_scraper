import { env } from "../config/env.js";

export function toFeedDto(feed) {
  return {
    id: String(feed.id || feed._id),
    name: feed.name,
    topic: feed.topic,
    rssUrl: feed.rssUrl,
    sourceType: feed.sourceType || "rss",
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
  return {
    id: String(article.id || article._id),
    title: article.title,
    normalizedTitle: article.normalizedTitle || "",
    link: article.link,
    canonicalLink: article.canonicalLink || article.link,
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
}
