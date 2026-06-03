import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import Parser from "rss-parser";
import { listFeeds } from "../src/database/feedRepository.js";
import { env } from "../src/config/env.js";
import { normalizeText, resolveArticleLink, sanitizeFeedText } from "../src/utils/text.js";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, "../.env");

dotenv.config({ path: envFilePath });

const databaseUrl = process.env.DATABASE_URL || "";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL.");
  console.error("Set DATABASE_URL in the environment or add it to backend/.env before running this script.");
  process.exit(1);
}

const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const sampleSize = Math.max(1, Math.min(20, Number(limitArg ? limitArg.split("=")[1] : 20) || 20));

const parser = new Parser({
  timeout: env.requestTimeoutMs,
  headers: {
    "User-Agent": "RSS Monitor Dashboard/2.0"
  },
  customFields: {
    item: [
      ["source", "source", { keepArray: true }],
      ["media:content", "media:content", { keepArray: true }],
      ["media:thumbnail", "media:thumbnail", { keepArray: true }],
      ["content:encoded", "content:encoded"],
      ["image", "image"],
      ["image:url", "image:url"],
      ["thumbnail", "thumbnail"],
    ]
  }
});

const client = new Client({
  connectionString: databaseUrl,
  application_name: "google-news-trace-source-url",
});

function formatRows(rows = []) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value == null ? "" : value,
      ])
    )
  );
}

function getHostname(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isGoogleNewsFeed(feed) {
  const rssUrl = String(feed.rssUrl || "").toLowerCase();
  const name = String(feed.name || "").toLowerCase();
  return (
    rssUrl.includes("news.google.com") ||
    name.includes("google alert") ||
    name.includes("google news")
  );
}

function isGoogleNewsArticle(article) {
  return (
    article.source === "news.google.com" ||
    getHostname(article.link) === "news.google.com" ||
    getHostname(article.canonicalLink) === "news.google.com"
  );
}

function extractAtomLinkHref(linkValue) {
  if (!linkValue) {
    return "";
  }
  if (typeof linkValue === "string") {
    return linkValue;
  }
  if (Array.isArray(linkValue)) {
    for (const entry of linkValue) {
      const href = extractAtomLinkHref(entry);
      if (href) {
        return href;
      }
    }
    return "";
  }
  if (typeof linkValue === "object") {
    if (typeof linkValue.href === "string" && linkValue.href.trim()) {
      return linkValue.href;
    }
    if (typeof linkValue.url === "string" && linkValue.url.trim()) {
      return linkValue.url;
    }
    if (linkValue.$ && typeof linkValue.$.href === "string" && linkValue.$.href.trim()) {
      return linkValue.$.href;
    }
  }
  return "";
}

function resolveItemLink(item) {
  const candidates = [
    item?.link,
    item?.guid,
    item?.id,
    item?.url,
    extractAtomLinkHref(item?.link),
    extractAtomLinkHref(item?.links),
    extractAtomLinkHref(item?.atomLink),
  ];

  for (const candidate of candidates) {
    const resolved = resolveArticleLink(normalizeText(candidate));
    if (resolved) {
      return resolved;
    }
  }

  return "";
}

function extractItemSourceMetadata(item) {
  const entries = Array.isArray(item?.source) ? item.source : item?.source ? [item.source] : [];

  for (const entry of entries) {
    if (typeof entry === "string") {
      const name = sanitizeFeedText(entry, "");
      if (name) {
        return { name, url: "" };
      }
      continue;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const name = sanitizeFeedText(
      entry._ || entry.text || entry.name || entry.title || "",
      ""
    );
    const url = normalizeText(
      entry.url || entry.href || entry.$?.url || entry.$?.href || entry["@_url"] || entry["@_href"],
      ""
    );

    if (name || url) {
      return { name, url };
    }
  }

  return { name: "", url: "" };
}

function normalizeDiagnosticItem(itemLink, item) {
  const sourceMeta = extractItemSourceMetadata(item);
  const source = sanitizeFeedText(sourceMeta.name || item.creator || item.author || getHostname(itemLink), "Unknown");
  const sourceUrlCandidate =
    getHostname(itemLink) === "news.google.com" &&
    sourceMeta.url &&
    getHostname(sourceMeta.url) !== "news.google.com"
      ? sourceMeta.url
      : "";

  return {
    title: sanitizeFeedText(item.title, "Untitled Article"),
    source,
    sourceUrlCandidate,
    enrichmentUrl: sourceUrlCandidate || itemLink,
    link: itemLink,
  };
}

async function loadGoogleNewsArticles(limit) {
  const result = await client.query(
    `
      SELECT
        id,
        title,
        link,
        "canonicalLink",
        source,
        "feedId",
        "feedName",
        thumbnail,
        "pubDate",
        "createdAt"
      FROM articles
      WHERE source = 'news.google.com'
         OR link ILIKE 'https://news.google.com%'
         OR "canonicalLink" ILIKE 'https://news.google.com%'
      ORDER BY "createdAt" DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.filter(isGoogleNewsArticle);
}

async function buildCurrentFeedItemMap(feedIds = []) {
  const relevantFeedIds = new Set(feedIds.filter(Boolean).map(String));
  const feeds = await listFeeds({ activeOnly: true, order: "DESC" });
  const googleFeeds = feeds.filter(
    (feed) => relevantFeedIds.has(String(feed.id)) || isGoogleNewsFeed(feed)
  );
  const itemMap = new Map();

  for (const feed of googleFeeds) {
    try {
      const parsedFeed = await parser.parseURL(feed.rssUrl);
      const items = Array.isArray(parsedFeed.items) ? parsedFeed.items : [];
      for (const item of items) {
        const itemLink = resolveItemLink(item);
        if (!itemLink || itemMap.has(itemLink)) {
          continue;
        }
        itemMap.set(itemLink, {
          feedId: String(feed.id || ""),
          feedName: feed.name || "",
          rssUrl: feed.rssUrl || "",
          item,
          sourceMeta: extractItemSourceMetadata(item),
          normalized: normalizeDiagnosticItem(itemLink, item),
        });
      }
    } catch {
      // Continue across feed failures; this script is diagnostic only.
    }
  }

  return itemMap;
}

function buildImageCompareView(article, feedMatch) {
  const sourceUrl = String(feedMatch?.normalized?.sourceUrlCandidate || "").trim();
  if (sourceUrl) {
    return {
      sourceUrlAvailable: "yes",
      selectedThumbnailExtractionUrl: sourceUrl,
      selectedBy: "source_url",
    };
  }

  const enrichmentUrl = String(article.canonicalLink || "").trim();
  if (enrichmentUrl && enrichmentUrl !== article.link) {
    return {
      sourceUrlAvailable: "no",
      selectedThumbnailExtractionUrl: enrichmentUrl,
      selectedBy: "enrichment_url",
    };
  }

  return {
    sourceUrlAvailable: "no",
    selectedThumbnailExtractionUrl: article.link || "",
    selectedBy: "article_link",
  };
}

async function main() {
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadGoogleNewsArticles(sampleSize);
    const feedItemMap = await buildCurrentFeedItemMap(
      Array.from(new Set(articles.map((article) => String(article.feedId || "")).filter(Boolean)))
    );

    const rows = [];
    let rssItemsWithSourceUrl = 0;
    let normalizedItemsWithSourceUrl = 0;
    let storedArticlesWithSourceUrl = 0;
    let imageCompareArticlesWithSourceUrl = 0;

    for (const article of articles) {
      const feedMatch = feedItemMap.get(article.link);
      const rawSourceName = feedMatch?.sourceMeta?.name || "";
      const rawSourceUrl = feedMatch?.sourceMeta?.url || "";
      const normalized = feedMatch?.normalized || null;
      const imageCompare = buildImageCompareView(article, feedMatch);

      if (rawSourceUrl) {
        rssItemsWithSourceUrl += 1;
      }
      if (normalized?.sourceUrlCandidate) {
        normalizedItemsWithSourceUrl += 1;
      }
      if (imageCompare.selectedBy === "source_url") {
        imageCompareArticlesWithSourceUrl += 1;
      }

      rows.push({
        articleId: article.id,
        rawTitle: feedMatch?.item?.title || "",
        rawSourceName,
        rawSourceUrl,
        normalizedTitle: normalized?.title || "",
        normalizedSource: normalized?.source || "",
        normalizedSourceUrlCandidate: normalized?.sourceUrlCandidate || "",
        normalizedEnrichmentUrl: normalized?.enrichmentUrl || "",
        normalizedArticleLink: normalized?.link || article.link || "",
        storedTitle: article.title || "",
        storedLink: article.link || "",
        storedSource: article.source || "",
        storedSourceUrl: "no",
        canonicalLink: article.canonicalLink || "",
        originalLink: "",
        thumbnail: article.thumbnail || "",
        imageCompareSourceUrlAvailable: imageCompare.sourceUrlAvailable,
        selectedThumbnailExtractionUrl: imageCompare.selectedThumbnailExtractionUrl || "",
        selectedBy: imageCompare.selectedBy || "",
        currentFeedMatchFound: feedMatch ? "yes" : "no",
      });
    }

    await client.query("COMMIT");

    console.log("\n=== Google News Source URL Trace ===");
    console.table(
      formatRows([
        {
          sampled_articles: articles.length,
          rss_items_with_source_url: rssItemsWithSourceUrl,
          normalized_items_with_source_url: normalizedItemsWithSourceUrl,
          stored_articles_with_source_url: storedArticlesWithSourceUrl,
          image_compare_articles_with_source_url: imageCompareArticlesWithSourceUrl,
          source_url_lost_stage: "database_storage",
          why_lost: "source.url is transient during ingest and is not persisted on Article rows",
          expected: "yes",
          diagnostics_can_recover_source_url: "only when the article still exists in the current live Google News feed window",
          schema_change_required_for_permanent_retention: "yes",
          smallest_safe_schema_change: "add nullable Article.sourceUrl or Article.publisherUrl",
        },
      ])
    );

    console.log("\n--- RAW RSS ---");
    console.table(
      formatRows(
        rows.map((row) => ({
          articleId: row.articleId,
          title: row.rawTitle || row.storedTitle,
          sourceName: row.rawSourceName,
          sourceUrl: row.rawSourceUrl,
          currentFeedMatchFound: row.currentFeedMatchFound,
        }))
      )
    );

    console.log("\n--- NORMALIZED ARTICLE ---");
    console.table(
      formatRows(
        rows.map((row) => ({
          articleId: row.articleId,
          title: row.normalizedTitle || row.storedTitle,
          source: row.normalizedSource,
          sourceUrlCandidate: row.normalizedSourceUrlCandidate,
          enrichmentUrl: row.normalizedEnrichmentUrl,
          articleLink: row.normalizedArticleLink,
        }))
      )
    );

    console.log("\n--- DATABASE RECORD ---");
    console.table(
      formatRows(
        rows.map((row) => ({
          articleId: row.articleId,
          title: row.storedTitle,
          storedLink: row.storedLink,
          storedSource: row.storedSource,
          sourceUrlStored: row.storedSourceUrl,
          canonicalLink: row.canonicalLink,
          originalLink: row.originalLink,
          thumbnail: row.thumbnail,
        }))
      )
    );

    console.log("\n--- IMAGE COMPARE VIEW ---");
    console.table(
      formatRows(
        rows.map((row) => ({
          articleId: row.articleId,
          title: row.storedTitle,
          sourceUrlAvailable: row.imageCompareSourceUrlAvailable,
          selectedThumbnailExtractionUrl: row.selectedThumbnailExtractionUrl,
          selectedBy: row.selectedBy,
        }))
      )
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures.
    }
    console.error("Failed to trace Google News source.url flow.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
