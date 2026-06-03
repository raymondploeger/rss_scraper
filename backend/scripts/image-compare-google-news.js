import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import Parser from "rss-parser";
import { listFeeds } from "../src/database/feedRepository.js";
import { env } from "../src/config/env.js";
import { diagnoseArticleImage, isGoogleNewsPlaceholderImage } from "../src/services/thumbnailService.js";

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
const sampleArg = args.find((arg) => arg.startsWith("--sample="));
const sampleSize = Math.max(1, Math.min(25, Number(sampleArg ? sampleArg.split("=")[1] : 10) || 10));

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
  application_name: "image-compare-google-news",
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

function isGoogleNewsArticle(article) {
  return (
    article.source === "news.google.com" ||
    getHostname(article.link) === "news.google.com" ||
    getHostname(article.canonicalLink) === "news.google.com"
  );
}

function getCurrentImageStatus(thumbnail) {
  const value = String(thumbnail || "").trim();
  if (!value || value === env.placeholderImage || value.toLowerCase() === "no image") {
    return "no_image";
  }
  if (isGoogleNewsPlaceholderImage(value)) {
    return "google_placeholder";
  }
  if (/^https?:\/\//i.test(value)) {
    return "real_image";
  }
  return "unknown";
}

function incrementCount(map, key) {
  const normalized = String(key || "unknown").trim() || "unknown";
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function chooseDomainLabel(article, diagnostic) {
  return (
    getHostname(diagnostic?.resolvedPublisherUrl) ||
    getHostname(diagnostic?.attemptedUrl) ||
    getHostname(article.thumbnail) ||
    article.source ||
    article.feedName ||
    "unknown"
  );
}

async function loadGoogleNewsArticles() {
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
        summary,
        "contentSnippet",
        "pubDate",
        "createdAt"
      FROM articles
      WHERE source = 'news.google.com'
         OR link ILIKE 'https://news.google.com%'
         OR "canonicalLink" ILIKE 'https://news.google.com%'
      ORDER BY "createdAt" DESC
    `
  );

  return result.rows.filter(isGoogleNewsArticle);
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
    const resolved = String(candidate || "").trim();
    if (resolved) {
      return resolved;
    }
  }
  return "";
}

function extractItemSourceUrl(item) {
  const entries = Array.isArray(item?.source) ? item.source : item?.source ? [item.source] : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = String(
      entry.url || entry.href || entry.$?.url || entry.$?.href || entry["@_url"] || entry["@_href"] || ""
    ).trim();
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

async function buildGoogleNewsSourceUrlMap(feedIds = []) {
  const sourceUrlMap = new Map();
  const feeds = await listFeeds({ activeOnly: true, order: "DESC" });
  const relevantFeeds = feeds.filter(
    (feed) =>
      feedIds.includes(feed.id) ||
      String(feed.rssUrl || "").toLowerCase().includes("news.google.com")
  );

  for (const feed of relevantFeeds) {
    try {
      const parsedFeed = await parser.parseURL(feed.rssUrl);
      const items = Array.isArray(parsedFeed.items) ? parsedFeed.items : [];
      for (const item of items) {
        const itemLink = resolveItemLink(item);
        const sourceUrl = extractItemSourceUrl(item);
        if (!itemLink || !sourceUrl) {
          continue;
        }
        if (!sourceUrlMap.has(itemLink)) {
          sourceUrlMap.set(itemLink, sourceUrl);
        }
      }
    } catch {
      // Diagnostics should continue even if one feed fails.
    }
  }

  return sourceUrlMap;
}

function selectThumbnailExtractionTarget(article, sourceUrlMap) {
  const sourceUrl = String(sourceUrlMap.get(article.link) || "").trim();
  if (sourceUrl) {
    return {
      sourceUrl,
      selectedThumbnailExtractionUrl: sourceUrl,
      selectedBy: "source_url",
    };
  }

  const enrichmentUrl = String(article.canonicalLink || "").trim();
  if (enrichmentUrl && enrichmentUrl !== article.link) {
    return {
      sourceUrl: "",
      selectedThumbnailExtractionUrl: enrichmentUrl,
      selectedBy: "enrichment_url",
    };
  }

  return {
    sourceUrl: "",
    selectedThumbnailExtractionUrl: article.link || "",
    selectedBy: "article_link",
  };
}

async function diagnoseArticle(article, sourceUrlMap) {
  const selection = selectThumbnailExtractionTarget(article, sourceUrlMap);
  const diagnostic = await diagnoseArticleImage(
    selection.selectedThumbnailExtractionUrl,
    article.contentSnippet || article.summary || "",
    article.title || "",
    {
      existingThumbnail: "",
      rssThumbnailSource: "",
    }
  );

  return {
    ...selection,
    ...diagnostic,
    selectedThumbnailUrl: diagnostic.finalThumbnail || "",
    rejectionReason:
      Array.isArray(diagnostic.rejectedReasons) && diagnostic.rejectedReasons.length
        ? diagnostic.rejectedReasons.join(", ")
        : "",
  };
}

async function main() {
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const allGoogleNewsArticles = await loadGoogleNewsArticles();
    const sourceUrlMap = await buildGoogleNewsSourceUrlMap(
      Array.from(new Set(allGoogleNewsArticles.map((article) => String(article.feedId || "")).filter(Boolean)))
    );
    const workingArticles = allGoogleNewsArticles.filter(
      (article) => getCurrentImageStatus(article.thumbnail) === "real_image"
    );
    const failingArticles = allGoogleNewsArticles.filter((article) => {
      const status = getCurrentImageStatus(article.thumbnail);
      return status === "google_placeholder" || status === "no_image";
    });

    const workingSample = workingArticles.slice(0, sampleSize);
    const failingSample = failingArticles.slice(0, sampleSize);

    console.log("\n=== Google News Image Comparison ===");
    console.table(
      formatRows([
        {
          total_google_news_articles: allGoogleNewsArticles.length,
          working_count: workingArticles.length,
          failing_count: failingArticles.length,
          sample_size_per_group: sampleSize,
        },
      ])
    );

    const workingRows = [];
    const failingRows = [];
    const workingDomains = new Map();
    const failingDomains = new Map();
    const failureReasons = new Map();
    let testedUsingSourceUrl = 0;
    let testedUsingArticleLink = 0;
    let testedUsingOtherUrl = 0;

    for (const article of workingSample) {
      const diagnostic = await diagnoseArticle(article, sourceUrlMap);
      if (diagnostic.selectedBy === "source_url") testedUsingSourceUrl += 1;
      else if (diagnostic.selectedBy === "article_link") testedUsingArticleLink += 1;
      else testedUsingOtherUrl += 1;
      incrementCount(workingDomains, chooseDomainLabel(article, diagnostic));
      workingRows.push({
        id: article.id,
        title: article.title || "",
        storedLink: article.link || "",
        sourceUrl: diagnostic.sourceUrl || "",
        selectedThumbnailExtractionUrl: diagnostic.selectedThumbnailExtractionUrl || "",
        selectedBy: diagnostic.selectedBy || "",
        currentThumbnail: article.thumbnail || "",
        feedOrSourceName: article.feedName || article.source || "",
        publishedDate: article.pubDate,
        currentImageStatus: getCurrentImageStatus(article.thumbnail),
        extractionAttemptedUrl: diagnostic.attemptedUrl || "",
        ogImageFound: diagnostic.ogImageFound,
        twitterImageFound: diagnostic.twitterImageFound,
        schemaImageFound: diagnostic.schemaImageFound,
        articleImageFound: diagnostic.articleImageFound,
        selectedThumbnailUrl: diagnostic.selectedThumbnailUrl,
        rejectionReason: diagnostic.rejectionReason,
        failureReason: diagnostic.failureReason || "",
      });
    }

    for (const article of failingSample) {
      const diagnostic = await diagnoseArticle(article, sourceUrlMap);
      if (diagnostic.selectedBy === "source_url") testedUsingSourceUrl += 1;
      else if (diagnostic.selectedBy === "article_link") testedUsingArticleLink += 1;
      else testedUsingOtherUrl += 1;
      incrementCount(failingDomains, chooseDomainLabel(article, diagnostic));
      incrementCount(failureReasons, diagnostic.failureReason || diagnostic.rejectionReason || "unknown");
      failingRows.push({
        id: article.id,
        title: article.title || "",
        storedLink: article.link || "",
        sourceUrl: diagnostic.sourceUrl || "",
        selectedThumbnailExtractionUrl: diagnostic.selectedThumbnailExtractionUrl || "",
        selectedBy: diagnostic.selectedBy || "",
        currentThumbnail: article.thumbnail || "",
        feedOrSourceName: article.feedName || article.source || "",
        publishedDate: article.pubDate,
        currentImageStatus: getCurrentImageStatus(article.thumbnail),
        extractionAttemptedUrl: diagnostic.attemptedUrl || "",
        ogImageFound: diagnostic.ogImageFound,
        twitterImageFound: diagnostic.twitterImageFound,
        schemaImageFound: diagnostic.schemaImageFound,
        articleImageFound: diagnostic.articleImageFound,
        selectedThumbnailUrl: diagnostic.selectedThumbnailUrl,
        rejectionReason: diagnostic.rejectionReason,
        failureReason: diagnostic.failureReason || "",
      });
    }

    await client.query("COMMIT");

    console.log("\n=== Summary ===");
    console.table(
      formatRows([
        {
          working_count: workingArticles.length,
          failing_count: failingArticles.length,
          tested_using_source_url: testedUsingSourceUrl,
          tested_using_article_link: testedUsingArticleLink,
          tested_using_other_url: testedUsingOtherUrl,
          working_domains: Array.from(workingDomains.entries())
            .sort((left, right) => right[1] - left[1])
            .map(([domain, count]) => `${domain}:${count}`)
            .join(", "),
          failing_domains: Array.from(failingDomains.entries())
            .sort((left, right) => right[1] - left[1])
            .map(([domain, count]) => `${domain}:${count}`)
            .join(", "),
        },
      ])
    );

    console.log("\n=== Top Failure Reasons ===");
    if (!failureReasons.size) {
      console.log("(no failure reasons recorded in failing sample)");
    } else {
      console.table(
        formatRows(
          Array.from(failureReasons.entries())
            .map(([reason, count]) => ({ failure_reason: reason, count }))
            .sort((left, right) => right.count - left.count)
        )
      );
    }

    console.log("\n=== Working Google News Articles ===");
    if (!workingRows.length) {
      console.log("(no working Google News articles found in sample)");
    } else {
      console.table(formatRows(workingRows));
    }

    console.log("\n=== Failing Google News Articles ===");
    if (!failingRows.length) {
      console.log("(no failing Google News articles found in sample)");
    } else {
      console.table(formatRows(failingRows));
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures.
    }
    console.error("Failed to compare Google News image outcomes.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
