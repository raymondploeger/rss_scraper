import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
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

async function diagnoseArticle(article) {
  const diagnostic = await diagnoseArticleImage(
    article.link,
    article.contentSnippet || article.summary || "",
    article.title || "",
    {
      existingThumbnail: "",
      rssThumbnailSource: "",
    }
  );

  return {
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

    for (const article of workingSample) {
      const diagnostic = await diagnoseArticle(article);
      incrementCount(workingDomains, chooseDomainLabel(article, diagnostic));
      workingRows.push({
        id: article.id,
        title: article.title || "",
        storedLink: article.link || "",
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
      const diagnostic = await diagnoseArticle(article);
      incrementCount(failingDomains, chooseDomainLabel(article, diagnostic));
      incrementCount(failureReasons, diagnostic.failureReason || diagnostic.rejectionReason || "unknown");
      failingRows.push({
        id: article.id,
        title: article.title || "",
        storedLink: article.link || "",
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
