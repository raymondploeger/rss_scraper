import { randomUUID } from "crypto";
import { getDatabase } from "../config/db.js";
import { mapFeedRow, toIsoString } from "./helpers.js";

export async function listFeeds({ activeOnly = false, order = "DESC" } = {}) {
  const db = getDatabase();
  const statement = db.prepare(`
    SELECT *
    FROM feeds
    ${activeOnly ? "WHERE isActive = 1" : ""}
    ORDER BY createdAt ${order === "ASC" ? "ASC" : "DESC"}
  `);
  return statement.all().map(mapFeedRow);
}

export async function listDistinctFeedTopics() {
  const db = getDatabase();
  return db
    .prepare(`SELECT DISTINCT topic FROM feeds WHERE topic <> '' ORDER BY topic ASC`)
    .all()
    .map((row) => row.topic);
}

export async function countFeeds(filters = {}) {
  const db = getDatabase();
  const clauses = [];
  const params = [];

  if (typeof filters.isActive === "boolean") {
    clauses.push("isActive = ?");
    params.push(filters.isActive ? 1 : 0);
  }

  if (filters.lastStatus) {
    clauses.push("lastStatus = ?");
    params.push(filters.lastStatus);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const row = db.prepare(`SELECT COUNT(*) AS count FROM feeds ${whereClause}`).get(...params);
  return Number(row?.count || 0);
}

export async function findFeedById(id) {
  const db = getDatabase();
  return mapFeedRow(db.prepare(`SELECT * FROM feeds WHERE id = ? LIMIT 1`).get(id));
}

export async function findFeedByRssUrl(rssUrl) {
  const db = getDatabase();
  return mapFeedRow(db.prepare(`SELECT * FROM feeds WHERE rssUrl = ? LIMIT 1`).get(rssUrl));
}

export async function createFeed(feed) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const record = {
    id: feed.id || randomUUID(),
    name: feed.name,
    topic: feed.topic,
    rssUrl: feed.rssUrl,
    sourceType: feed.sourceType || "rss",
    isActive: feed.isActive === false ? 0 : 1,
    lastFetchedAt: toIsoString(feed.lastFetchedAt),
    lastStatus: feed.lastStatus || "idle",
    lastError: feed.lastError || null,
    lastInsertedCount: Number(feed.lastInsertedCount || 0),
    createdAt: now,
    updatedAt: now
  };

  db.prepare(`
    INSERT INTO feeds (
      id, name, topic, rssUrl, sourceType, isActive, lastFetchedAt, lastStatus, lastError,
      lastInsertedCount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.name,
    record.topic,
    record.rssUrl,
    record.sourceType,
    record.isActive,
    record.lastFetchedAt,
    record.lastStatus,
    record.lastError,
    record.lastInsertedCount,
    record.createdAt,
    record.updatedAt
  );

  return findFeedById(record.id);
}

export async function updateFeed(id, updates) {
  const db = getDatabase();
  const current = await findFeedById(id);
  if (!current) {
    return null;
  }

  const record = {
    ...current,
    ...updates,
    isActive: typeof updates.isActive === "boolean" ? updates.isActive : current.isActive,
    updatedAt: new Date().toISOString()
  };

  db.prepare(`
    UPDATE feeds
    SET name = ?, topic = ?, rssUrl = ?, sourceType = ?, isActive = ?, lastFetchedAt = ?, lastStatus = ?,
        lastError = ?, lastInsertedCount = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    record.name,
    record.topic,
    record.rssUrl,
    record.sourceType,
    record.isActive ? 1 : 0,
    toIsoString(record.lastFetchedAt),
    record.lastStatus || "idle",
    record.lastError || null,
    Number(record.lastInsertedCount || 0),
    record.updatedAt,
    id
  );

  return findFeedById(id);
}

export async function deleteFeed(id) {
  const db = getDatabase();
  const existing = await findFeedById(id);
  if (!existing) {
    return null;
  }

  db.prepare(`DELETE FROM feeds WHERE id = ?`).run(id);
  return existing;
}
