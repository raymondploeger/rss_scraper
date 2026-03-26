import { getDatabase } from "../config/db.js";
import { mapFeedRecord, toIsoString } from "./helpers.js";

export async function listFeeds({ activeOnly = false, order = "DESC" } = {}) {
  const prisma = getDatabase();
  const feeds = await prisma.feed.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: {
      createdAt: order === "ASC" ? "asc" : "desc",
    },
  });

  return feeds.map(mapFeedRecord);
}

export async function listDistinctFeedTopics() {
  const prisma = getDatabase();
  const rows = await prisma.feed.findMany({
    where: {
      topic: {
        not: "",
      },
    },
    distinct: ["topic"],
    select: {
      topic: true,
    },
    orderBy: {
      topic: "asc",
    },
  });

  return rows.map((row) => row.topic);
}

export async function countFeeds(filters = {}) {
  const prisma = getDatabase();
  const where = {};

  if (typeof filters.isActive === "boolean") {
    where.isActive = filters.isActive;
  }

  if (filters.lastStatus) {
    where.lastStatus = filters.lastStatus;
  }

  return prisma.feed.count({ where });
}

export async function findFeedById(id) {
  const prisma = getDatabase();
  const feed = await prisma.feed.findUnique({ where: { id } });
  return mapFeedRecord(feed);
}

export async function findFeedByRssUrl(rssUrl) {
  const prisma = getDatabase();
  const feed = await prisma.feed.findUnique({ where: { rssUrl } });
  return mapFeedRecord(feed);
}

export async function createFeed(feed) {
  const prisma = getDatabase();
  const created = await prisma.feed.create({
    data: {
      name: feed.name,
      topic: feed.topic,
      rssUrl: feed.rssUrl,
      sourceType: feed.sourceType || "rss",
      sourceFallbackImage: feed.sourceFallbackImage || null,
      isActive: feed.isActive !== false,
      lastFetchedAt: feed.lastFetchedAt ? new Date(toIsoString(feed.lastFetchedAt, new Date().toISOString())) : null,
      lastStatus: feed.lastStatus || "idle",
      lastError: feed.lastError || null,
      lastInsertedCount: Number(feed.lastInsertedCount || 0),
    },
  });

  return mapFeedRecord(created);
}

export async function updateFeed(id, updates) {
  const prisma = getDatabase();
  const current = await prisma.feed.findUnique({ where: { id } });
  if (!current) {
    return null;
  }

  const updated = await prisma.feed.update({
    where: { id },
    data: {
      ...(typeof updates.name === "string" ? { name: updates.name } : {}),
      ...(typeof updates.topic === "string" ? { topic: updates.topic } : {}),
      ...(typeof updates.rssUrl === "string" ? { rssUrl: updates.rssUrl } : {}),
      ...(typeof updates.sourceType === "string" ? { sourceType: updates.sourceType } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "sourceFallbackImage")
        ? { sourceFallbackImage: updates.sourceFallbackImage || null }
        : {}),
      ...(typeof updates.isActive === "boolean" ? { isActive: updates.isActive } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "lastFetchedAt")
        ? {
            lastFetchedAt: updates.lastFetchedAt
              ? new Date(toIsoString(updates.lastFetchedAt, new Date().toISOString()))
              : null,
          }
        : {}),
      ...(typeof updates.lastStatus === "string" ? { lastStatus: updates.lastStatus } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "lastError") ? { lastError: updates.lastError } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "lastInsertedCount")
        ? { lastInsertedCount: Number(updates.lastInsertedCount || 0) }
        : {}),
    },
  });

  return mapFeedRecord(updated);
}

export async function deleteFeed(id) {
  const prisma = getDatabase();
  const existing = await prisma.feed.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const deleted = await prisma.feed.delete({ where: { id } });
  return mapFeedRecord(deleted);
}
