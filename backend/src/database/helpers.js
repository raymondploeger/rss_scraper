export function toIsoString(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function mapFeedRecord(feed) {
  if (!feed) {
    return null;
  }

  return {
    id: feed.id,
    name: feed.name,
    topic: feed.topic,
    rssUrl: feed.rssUrl,
    sourceType: feed.sourceType,
    sourceFallbackImage: feed.sourceFallbackImage || null,
    isActive: feed.isActive !== false,
    lastFetchedAt: feed.lastFetchedAt,
    lastStatus: feed.lastStatus,
    lastError: feed.lastError,
    lastInsertedCount: Number(feed.lastInsertedCount || 0),
    createdAt: feed.createdAt,
    updatedAt: feed.updatedAt
  };
}

export function mapArticleRecord(article) {
  if (!article) {
    return null;
  }

  return {
    id: article.id,
    _id: article.id,
    canonicalLink: article.canonicalLink || "",
    feedId: article.feedId,
    feedName: article.feedName,
    topic: article.topic,
    title: article.title,
    normalizedTitle: article.normalizedTitle || "",
    link: article.link,
    source: article.source,
    pubDate: article.pubDate,
    thumbnail: article.thumbnail,
    summary: article.summary || "",
    summaryShort: article.summaryShort || "",
    keywords: Array.isArray(article.keywords) ? article.keywords : [],
    contentSnippet: article.contentSnippet || "",
    author: article.author || "",
    clusterId: article.clusterId || null,
    duplicateGroupId: article.duplicateGroupId || null,
    isDuplicate: article.isDuplicate === true,
    duplicateOf: article.duplicateOf || null,
    language: article.language || "unknown",
    fetchStatus: article.fetchStatus || "pending",
    articleHash: article.hash,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt
  };
}

export function mapPollLogRecord(log) {
  if (!log) {
    return null;
  }

  return {
    id: log.id,
    feedId: log.feedId,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    status: log.status,
    newArticles: Number(log.newArticles || 0),
    errorMessage: log.errorMessage || null
  };
}
