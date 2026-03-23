export function toIsoString(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function parseKeywords(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeKeywords(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export function mapFeedRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    topic: row.topic,
    rssUrl: row.rssUrl,
    sourceType: row.sourceType,
    isActive: row.isActive === 1,
    lastFetchedAt: row.lastFetchedAt,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    lastInsertedCount: Number(row.lastInsertedCount || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function mapArticleRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    canonicalLink: row.canonicalLink || "",
    feedId: row.feedId,
    feedName: row.feedName,
    topic: row.topic,
    title: row.title,
    normalizedTitle: row.normalizedTitle || "",
    link: row.link,
    source: row.source,
    pubDate: row.pubDate,
    thumbnail: row.thumbnail,
    summary: row.summary || "",
    summaryShort: row.summaryShort || "",
    keywords: parseKeywords(row.keywords),
    contentSnippet: row.contentSnippet || "",
    author: row.author || "",
    clusterId: row.clusterId || null,
    duplicateGroupId: row.duplicateGroupId || null,
    isDuplicate: row.isDuplicate === 1,
    duplicateOf: row.duplicateOf || null,
    language: row.language || "unknown",
    fetchStatus: row.fetchStatus || "pending",
    articleHash: row.articleHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function mapPollLogRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    feedId: row.feedId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: row.status,
    newArticles: Number(row.newArticles || 0),
    errorMessage: row.errorMessage || null
  };
}
