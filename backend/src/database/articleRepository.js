import { getDatabase } from "../config/db.js";
import { mapArticleRow, serializeKeywords, toIsoString } from "./helpers.js";

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

function buildArticleWhere(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.topic) {
    clauses.push("topic = ?");
    params.push(filters.topic);
  }

  if (filters.feedId) {
    clauses.push("feedId = ?");
    params.push(filters.feedId);
  }

  if (filters.from) {
    clauses.push("pubDate >= ?");
    params.push(toIsoString(filters.from, filters.from));
  }

  if (filters.to) {
    clauses.push("pubDate <= ?");
    params.push(toIsoString(filters.to, filters.to));
  }

  if (filters.excludeDuplicates) {
    clauses.push("isDuplicate != 1");
  }

  if (filters.onlyDuplicates) {
    clauses.push("isDuplicate = 1");
  }

  if (filters.fetchStatuses?.length) {
    clauses.push(`fetchStatus IN (${filters.fetchStatuses.map(() => "?").join(", ")})`);
    params.push(...filters.fetchStatuses);
  }

  if (filters.search) {
    const search = `%${escapeLike(filters.search)}%`;
    clauses.push(
      `(title LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\' OR topic LIKE ? ESCAPE '\\' OR keywords LIKE ? ESCAPE '\\')`
    );
    params.push(search, search, search, search);
  }

  if (filters.since) {
    clauses.push("pubDate >= ?");
    params.push(toIsoString(filters.since, filters.since));
  }

  return {
    whereClause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

export async function findArticleById(id) {
  const db = getDatabase();
  return mapArticleRow(db.prepare(`SELECT * FROM articles WHERE id = ? LIMIT 1`).get(id));
}

export async function createArticle(article) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const record = {
    id: article.id || article._id,
    canonicalLink: article.canonicalLink || "",
    feedId: article.feedId,
    feedName: article.feedName,
    topic: article.topic,
    title: article.title,
    normalizedTitle: article.normalizedTitle || "",
    link: article.link,
    source: article.source,
    pubDate: toIsoString(article.pubDate, new Date().toISOString()),
    thumbnail: article.thumbnail || null,
    summary: article.summary || "",
    summaryShort: article.summaryShort || "",
    keywords: serializeKeywords(article.keywords),
    contentSnippet: article.contentSnippet || "",
    author: article.author || "",
    clusterId: article.clusterId || null,
    duplicateGroupId: article.duplicateGroupId || null,
    isDuplicate: article.isDuplicate ? 1 : 0,
    duplicateOf: article.duplicateOf || null,
    language: article.language || "unknown",
    fetchStatus: article.fetchStatus || "pending",
    articleHash: article.articleHash,
    createdAt: now,
    updatedAt: now
  };

  db.prepare(`
    INSERT INTO articles (
      id, canonicalLink, feedId, feedName, topic, title, normalizedTitle, link, source, pubDate, thumbnail,
      summary, summaryShort, keywords, contentSnippet, author, clusterId, duplicateGroupId, isDuplicate,
      duplicateOf, language, fetchStatus, articleHash, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.canonicalLink,
    record.feedId,
    record.feedName,
    record.topic,
    record.title,
    record.normalizedTitle,
    record.link,
    record.source,
    record.pubDate,
    record.thumbnail,
    record.summary,
    record.summaryShort,
    record.keywords,
    record.contentSnippet,
    record.author,
    record.clusterId,
    record.duplicateGroupId,
    record.isDuplicate,
    record.duplicateOf,
    record.language,
    record.fetchStatus,
    record.articleHash,
    record.createdAt,
    record.updatedAt
  );

  return findArticleById(record.id);
}

export async function updateArticle(id, updates) {
  const db = getDatabase();
  const current = await findArticleById(id);
  if (!current) {
    return null;
  }

  const record = {
    ...current,
    ...updates,
    id,
    keywords: Array.isArray(updates.keywords) ? updates.keywords : current.keywords,
    updatedAt: new Date().toISOString()
  };

  db.prepare(`
    UPDATE articles
    SET canonicalLink = ?, feedId = ?, feedName = ?, topic = ?, title = ?, normalizedTitle = ?, link = ?, source = ?,
        pubDate = ?, thumbnail = ?, summary = ?, summaryShort = ?, keywords = ?, contentSnippet = ?, author = ?,
        clusterId = ?, duplicateGroupId = ?, isDuplicate = ?, duplicateOf = ?, language = ?, fetchStatus = ?, articleHash = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    record.canonicalLink || "",
    record.feedId,
    record.feedName,
    record.topic,
    record.title,
    record.normalizedTitle || "",
    record.link,
    record.source,
    toIsoString(record.pubDate, current.pubDate),
    record.thumbnail || null,
    record.summary || "",
    record.summaryShort || "",
    serializeKeywords(record.keywords),
    record.contentSnippet || "",
    record.author || "",
    record.clusterId || null,
    record.duplicateGroupId || null,
    record.isDuplicate ? 1 : 0,
    record.duplicateOf || null,
    record.language || "unknown",
    record.fetchStatus || "pending",
    record.articleHash,
    record.updatedAt,
    id
  );

  return findArticleById(id);
}

export async function listArticles(filters = {}, options = {}) {
  const db = getDatabase();
  const { whereClause, params } = buildArticleWhere(filters);
  const limit = Math.min(400, Math.max(1, Number(options.limit || 400)));
  const offset = Math.max(0, Number(options.offset || 0));
  const rows = db
    .prepare(`
      SELECT *
      FROM articles
      ${whereClause}
      ORDER BY pubDate DESC, createdAt DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  return rows.map(mapArticleRow);
}

export async function countArticles(filters = {}) {
  const db = getDatabase();
  const { whereClause, params } = buildArticleWhere(filters);
  const row = db.prepare(`SELECT COUNT(*) AS count FROM articles ${whereClause}`).get(...params);
  return Number(row?.count || 0);
}

export async function listDistinctArticleTopics() {
  const db = getDatabase();
  return db
    .prepare(`SELECT DISTINCT topic FROM articles WHERE topic <> '' ORDER BY topic ASC`)
    .all()
    .map((row) => row.topic);
}

export async function deleteArticlesByFeedId(feedId) {
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM articles WHERE feedId = ?`).run(feedId);
  return Number(result.changes || 0);
}

export async function listArticlesForTrends({ since, limit = 400 }) {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT *
      FROM articles
      WHERE pubDate >= ?
      ORDER BY pubDate DESC
      LIMIT ?
    `)
    .all(toIsoString(since, since), Math.max(1, Number(limit || 400)));
  return rows.map(mapArticleRow);
}

export async function listPendingArticles(limit = 20) {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT *
      FROM articles
      WHERE thumbnail IS NULL
         OR thumbnail = ''
         OR summaryShort = ''
         OR fetchStatus = 'pending'
         OR fetchStatus = 'partial'
      ORDER BY createdAt DESC
      LIMIT ?
    `)
    .all(Math.max(1, Number(limit || 20)));
  return rows.map(mapArticleRow);
}
