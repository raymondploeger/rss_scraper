import { getDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { mapArticleRecord, toIsoString } from "./helpers.js";

function buildArticleWhere(filters = {}) {
  const where = {};
  const andConditions = [];

  if (filters.topic) {
    where.topic = filters.topic;
  }

  if (filters.feedId) {
    where.feedId = filters.feedId;
  }

  if (filters.from || filters.to || filters.since) {
    where.pubDate = {};
    if (filters.from) {
      where.pubDate.gte = new Date(toIsoString(filters.from, filters.from));
    }
    if (filters.to) {
      where.pubDate.lte = new Date(toIsoString(filters.to, filters.to));
    }
    if (filters.since) {
      where.pubDate.gte = new Date(toIsoString(filters.since, filters.since));
    }
  }

  if (filters.excludeDuplicates) {
    where.isDuplicate = false;
  }

  if (filters.onlyDuplicates) {
    where.isDuplicate = true;
  }

  if (filters.fetchStatuses?.length) {
    where.fetchStatus = {
      in: filters.fetchStatuses,
    };
  }

  if (filters.search) {
    andConditions.push({
      OR: [
      { title: { contains: filters.search, mode: "insensitive" } },
      { source: { contains: filters.search, mode: "insensitive" } },
      { topic: { contains: filters.search, mode: "insensitive" } },
      { feedName: { contains: filters.search, mode: "insensitive" } },
      { contentSnippet: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  if (filters.tag) {
    where.keywords = {
      has: String(filters.tag).trim(),
    };
  }

  if (filters.signalKeywords?.length) {
    andConditions.push({
      OR: filters.signalKeywords.map((keyword) => ({
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { source: { contains: keyword, mode: "insensitive" } },
          { feedName: { contains: keyword, mode: "insensitive" } },
          { summary: { contains: keyword, mode: "insensitive" } },
          { summaryShort: { contains: keyword, mode: "insensitive" } },
          { contentSnippet: { contains: keyword, mode: "insensitive" } },
          { normalizedTitle: { contains: keyword, mode: "insensitive" } },
        ],
      })),
    });
  }

  if (andConditions.length) {
    where.AND = andConditions;
  }

  return where;
}

export async function findArticleById(id) {
  const prisma = getDatabase();
  const article = await prisma.article.findUnique({ where: { id } });
  return mapArticleRecord(article);
}

export async function createArticle(article) {
  const prisma = getDatabase();
  const created = await prisma.article.create({
    data: {
      id: article.id || article._id,
      canonicalLink: article.canonicalLink || "",
      feedId: article.feedId,
      feedName: article.feedName,
      topic: article.topic,
      title: article.title,
      normalizedTitle: article.normalizedTitle || "",
      link: article.link,
      source: article.source,
      pubDate: new Date(toIsoString(article.pubDate, new Date().toISOString())),
      thumbnail: article.thumbnail || null,
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
      hash: article.articleHash,
    },
  });

  return mapArticleRecord(created);
}

export async function updateArticle(id, updates) {
  const prisma = getDatabase();
  const current = await prisma.article.findUnique({ where: { id } });
  if (!current) {
    return null;
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      ...(Object.prototype.hasOwnProperty.call(updates, "canonicalLink") ? { canonicalLink: updates.canonicalLink || "" } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "feedId") ? { feedId: updates.feedId } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "feedName") ? { feedName: updates.feedName } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "topic") ? { topic: updates.topic } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "title") ? { title: updates.title } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "normalizedTitle")
        ? { normalizedTitle: updates.normalizedTitle || "" }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "link") ? { link: updates.link } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "source") ? { source: updates.source } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "pubDate")
        ? { pubDate: new Date(toIsoString(updates.pubDate, current.pubDate)) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "thumbnail") ? { thumbnail: updates.thumbnail || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "summary") ? { summary: updates.summary || "" } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "summaryShort")
        ? { summaryShort: updates.summaryShort || "" }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "keywords")
        ? { keywords: Array.isArray(updates.keywords) ? updates.keywords : [] }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "contentSnippet")
        ? { contentSnippet: updates.contentSnippet || "" }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "author") ? { author: updates.author || "" } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "clusterId") ? { clusterId: updates.clusterId || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "duplicateGroupId")
        ? { duplicateGroupId: updates.duplicateGroupId || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "isDuplicate") ? { isDuplicate: updates.isDuplicate === true } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "duplicateOf") ? { duplicateOf: updates.duplicateOf || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "language") ? { language: updates.language || "unknown" } : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "fetchStatus")
        ? { fetchStatus: updates.fetchStatus || "pending" }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, "articleHash") ? { hash: updates.articleHash } : {}),
    },
  });

  return mapArticleRecord(updated);
}

export async function listArticles(filters = {}, options = {}) {
  const prisma = getDatabase();
  const items = await prisma.article.findMany({
    where: buildArticleWhere(filters),
    orderBy: [{ pubDate: "desc" }, { createdAt: "desc" }],
    take: Math.min(env.maxArticlePageSize, Math.max(1, Number(options.limit || env.maxArticlePageSize))),
    skip: Math.max(0, Number(options.offset || 0)),
  });

  return items.map(mapArticleRecord);
}

export async function countArticles(filters = {}) {
  const prisma = getDatabase();
  return prisma.article.count({
    where: buildArticleWhere(filters),
  });
}

export async function listDistinctArticleTopics() {
  const prisma = getDatabase();
  const rows = await prisma.article.findMany({
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

export async function deleteArticlesByFeedId(feedId) {
  const prisma = getDatabase();
  const result = await prisma.article.deleteMany({
    where: { feedId },
  });
  return Number(result.count || 0);
}

export async function listArticlesForTrends({ since, limit = 400 }) {
  const prisma = getDatabase();
  const rows = await prisma.article.findMany({
    where: {
      pubDate: {
        gte: new Date(toIsoString(since, since)),
      },
    },
    orderBy: {
      pubDate: "desc",
    },
    take: Math.max(1, Number(limit || 400)),
  });

  return rows.map(mapArticleRecord);
}

export async function listPendingArticles(limit = 20) {
  const prisma = getDatabase();
  const rows = await prisma.article.findMany({
    where: {
      OR: [
        { thumbnail: null },
        { thumbnail: "" },
        { summaryShort: "" },
        { fetchStatus: "pending" },
        { fetchStatus: "partial" },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Math.max(1, Number(limit || 20)),
  });

  return rows.map(mapArticleRecord);
}
