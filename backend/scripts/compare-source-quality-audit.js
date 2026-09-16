import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "../src/config/env.js";

const DEFAULT_AUDIT_PATH = "/tmp/source-quality-playwright-audit.json";
const DEFAULT_LIMIT = 30;

function parseArgs(argv) {
  const options = {
    auditPath: process.env.SOURCE_QUALITY_AUDIT_PATH || DEFAULT_AUDIT_PATH,
    output: process.env.SOURCE_QUALITY_COMPARE_OUTPUT || "",
    limit: Number(process.env.SOURCE_QUALITY_COMPARE_LIMIT || DEFAULT_LIMIT),
  };

  for (const arg of argv) {
    if (arg.startsWith("--audit=")) {
      options.auditPath = arg.slice("--audit=".length);
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (!arg.startsWith("--") && arg.trim()) {
      options.auditPath = arg.trim();
    }
  }

  return options;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    parsed.hash = "";
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(value).trim();
  }
}

function summarizeImages(items, field = "thumbnail") {
  const counts = new Map();
  for (const item of items) {
    const image = normalizeUrl(item[field]);
    if (!image) {
      continue;
    }
    counts.set(image, (counts.get(image) || 0) + 1);
  }

  const repeatedImages = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([image, count]) => ({ image, count }));

  return {
    totalWithImages: [...counts.values()].reduce((sum, count) => sum + count, 0),
    uniqueImages: counts.size,
    repeatedImages,
    repeatedImageRatio: items.length
      ? Number((repeatedImages.reduce((sum, entry) => sum + entry.count, 0) / items.length).toFixed(2))
      : 0,
  };
}

function toComparableAuditItem(item) {
  return {
    title: normalizeText(item.title),
    link: normalizeUrl(item.link),
    dateText: normalizeText(item.dateText),
    image: normalizeUrl(item.image),
  };
}

function toComparableDbItem(item) {
  return {
    title: normalizeText(item.title),
    link: normalizeUrl(item.link),
    canonicalLink: normalizeUrl(item.canonicalLink),
    pubDate: item.pubDate?.toISOString?.() || "",
    thumbnail: normalizeUrl(item.thumbnail),
    topic: item.topic,
    source: item.source,
  };
}

function buildLinkSet(items) {
  const links = new Set();
  for (const item of items) {
    if (item.link) {
      links.add(item.link);
    }
    if (item.canonicalLink) {
      links.add(item.canonicalLink);
    }
  }
  return links;
}

function findTitleFallbackMatches(auditOnlyItems, dbItems) {
  const dbTitles = new Map(
    dbItems.map((item) => [item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(), item])
  );

  return auditOnlyItems
    .map((item) => {
      const titleKey = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const match = dbTitles.get(titleKey);
      return match
        ? {
            auditTitle: item.title,
            auditLink: item.link,
            dbLink: match.link,
            dbPubDate: match.pubDate,
          }
        : null;
    })
    .filter(Boolean);
}

async function compareSource(prisma, report, limit) {
  const sourceName = report.source?.name || "";
  const feed = await prisma.feed.findFirst({
    where: { name: sourceName },
    select: {
      id: true,
      name: true,
      rssUrl: true,
      sourceType: true,
      topic: true,
      lastStatus: true,
      lastError: true,
      lastFetchedAt: true,
      lastInsertedCount: true,
    },
  });

  if (!feed) {
    return {
      sourceName,
      status: "missing-feed",
      auditCandidateCount: report.items?.length || 0,
      notes: ["Feed not found in database."],
    };
  }

  const dbRows = await prisma.article.findMany({
    where: { feedId: feed.id },
    orderBy: [{ pubDate: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, limit),
    select: {
      title: true,
      link: true,
      canonicalLink: true,
      pubDate: true,
      thumbnail: true,
      topic: true,
      source: true,
    },
  });

  const auditItems = (report.items || []).map(toComparableAuditItem);
  const dbItems = dbRows.map(toComparableDbItem);
  const dbLinks = buildLinkSet(dbItems);
  const auditLinks = buildLinkSet(auditItems);
  const missingFromDb = auditItems.filter((item) => item.link && !dbLinks.has(item.link));
  const missingFromAudit = dbItems.filter((item) => item.link && !auditLinks.has(item.link) && !auditLinks.has(item.canonicalLink));
  const titleFallbackMatches = findTitleFallbackMatches(missingFromDb, dbItems);
  const latestDbArticle = dbItems[0] || null;
  const auditImageSummary = summarizeImages(auditItems, "image");
  const dbImageSummary = summarizeImages(dbItems, "thumbnail");
  const notes = [];

  if (missingFromDb.length) {
    notes.push(`${missingFromDb.length} Playwright candidate(s) are not stored in the latest ${dbItems.length} database article(s).`);
  }
  if (titleFallbackMatches.length) {
    notes.push(`${titleFallbackMatches.length} missing link(s) have title matches in the database, so canonical/link normalization may differ.`);
  }
  if (dbImageSummary.repeatedImageRatio >= 0.5 && dbItems.length >= 4) {
    notes.push("Database thumbnails repeat heavily for this source.");
  }
  if (auditImageSummary.totalWithImages > dbImageSummary.totalWithImages && dbImageSummary.totalWithImages === 0) {
    notes.push("Playwright sees images, but the database has no thumbnails in the compared set.");
  }
  if (!dbItems.length) {
    notes.push("No database articles found for this feed.");
  }

  return {
    sourceName,
    status: "compared",
    feed,
    auditCandidateCount: auditItems.length,
    databaseArticleCountCompared: dbItems.length,
    latestDatabaseArticle: latestDbArticle
      ? {
          title: latestDbArticle.title,
          pubDate: latestDbArticle.pubDate,
          link: latestDbArticle.link,
          thumbnail: latestDbArticle.thumbnail,
        }
      : null,
    auditTopItems: auditItems.slice(0, 5),
    databaseTopItems: dbItems.slice(0, 5),
    missingFromDatabase: missingFromDb.slice(0, 10),
    databaseOnly: missingFromAudit.slice(0, 10),
    titleFallbackMatches: titleFallbackMatches.slice(0, 10),
    auditImageSummary,
    databaseImageSummary: dbImageSummary,
    notes,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const auditPath = path.resolve(options.auditPath);
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const prisma = new PrismaClient();

  try {
    const comparisons = [];
    for (const report of audit.reports || []) {
      comparisons.push(await compareSource(prisma, report, options.limit));
    }

    const result = {
      capturedAt: new Date().toISOString(),
      auditPath,
      comparedSourceCount: comparisons.length,
      comparisons,
    };
    const json = JSON.stringify(result, null, 2);
    if (options.output) {
      fs.writeFileSync(options.output, `${json}\n`);
    }
    console.log(json);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
