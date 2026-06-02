import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { env } from "../src/config/env.js";
import { isGoogleNewsPlaceholderImage, scrapeArticleMetadata } from "../src/services/thumbnailService.js";

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
const execute = args.includes("--execute");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Math.min(250, Number(limitArg ? limitArg.split("=")[1] : 75) || 75));

const client = new Client({
  connectionString: databaseUrl,
  application_name: "google-news-thumbnail-backfill",
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
  const sourceHost = getHostname(article.source);
  const linkHost = getHostname(article.link);
  const canonicalHost = getHostname(article.canonicalLink);

  return (
    article.source === "news.google.com" ||
    sourceHost === "news.google.com" ||
    linkHost === "news.google.com" ||
    canonicalHost === "news.google.com"
  );
}

function hasMissingThumbnail(article) {
  const thumbnail = String(article.thumbnail || "").trim();
  return !thumbnail || thumbnail === env.placeholderImage;
}

function hasGooglePlaceholderThumbnail(article) {
  if (hasMissingThumbnail(article)) {
    return false;
  }

  return isGoogleNewsPlaceholderImage(article.thumbnail);
}

function needsGoogleNewsThumbnailBackfill(article) {
  if (!isGoogleNewsArticle(article)) {
    return false;
  }

  return hasMissingThumbnail(article) || hasGooglePlaceholderThumbnail(article);
}

function summarizeBySource(articles = []) {
  const counts = new Map();
  for (const article of articles) {
    const key = article.source || getHostname(article.link) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, matching_articles: count }))
    .sort((left, right) => right.matching_articles - left.matching_articles)
    .slice(0, 15);
}

async function loadGoogleNewsCandidates() {
  const result = await client.query(
    `
      SELECT
        id,
        title,
        source,
        link,
        "canonicalLink",
        thumbnail,
        summary,
        "contentSnippet",
        "pubDate",
        "createdAt",
        "updatedAt"
      FROM articles
      WHERE source = 'news.google.com'
         OR link ILIKE 'https://news.google.com%'
         OR "canonicalLink" ILIKE 'https://news.google.com%'
      ORDER BY "createdAt" DESC
    `
  );

  return result.rows.filter(needsGoogleNewsThumbnailBackfill);
}

async function main() {
  try {
    await client.connect();
    const candidates = await loadGoogleNewsCandidates();
    const placeholderCount = candidates.filter(hasGooglePlaceholderThumbnail).length;
    const missingCount = candidates.filter(hasMissingThumbnail).length;
    const oldestArticle = candidates.reduce(
      (min, article) => (!min || new Date(article.pubDate) < new Date(min.pubDate) ? article : min),
      null
    );
    const newestArticle = candidates.reduce(
      (max, article) => (!max || new Date(article.pubDate) > new Date(max.pubDate) ? article : max),
      null
    );

    console.log("\n=== Google News Thumbnail Backfill Dry Run ===");
    console.table(
      formatRows([
        {
          total_matching_google_news_articles: candidates.length,
          google_placeholder_thumbnails: placeholderCount,
          missing_thumbnails: missingCount,
          oldest_matching_article: oldestArticle?.pubDate || "",
          newest_matching_article: newestArticle?.pubDate || "",
          execute_mode: execute,
          limit,
        },
      ])
    );

    console.log("\n=== Source / Domain Summary ===");
    console.table(formatRows(summarizeBySource(candidates)));

    console.log("\n=== Sample Rows ===");
    console.table(
      formatRows(
        candidates.slice(0, 20).map((article) => ({
          id: article.id,
          title: article.title || "",
          url: article.canonicalLink || article.link || "",
          current_thumbnail: article.thumbnail || "",
          published_at: article.pubDate,
          imported_at: article.createdAt,
        }))
      )
    );

    if (!execute) {
      console.log("\nDry run only. No articles were updated.");
      console.log("Run with --execute to retry thumbnails for matching Google News articles.");
      return;
    }

    const batch = candidates.slice(0, limit);
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const updatedSamples = [];

    for (const article of batch) {
      try {
        const enriched = await scrapeArticleMetadata(
          article.link,
          article.contentSnippet || article.summary || "",
          article.title || "",
          {
            existingThumbnail: article.thumbnail,
            rssThumbnailSource:
              article.thumbnail &&
              article.thumbnail !== env.placeholderImage &&
              !isGoogleNewsPlaceholderImage(article.thumbnail)
                ? "article-existing"
                : "",
          }
        );

        const nextThumbnail = String(enriched?.thumbnail || "").trim();
        const currentThumbnail = String(article.thumbnail || "").trim();
        const currentIsRealPublisherThumbnail =
          currentThumbnail &&
          currentThumbnail !== env.placeholderImage &&
          !isGoogleNewsPlaceholderImage(currentThumbnail);

        if (
          !nextThumbnail ||
          nextThumbnail === env.placeholderImage ||
          isGoogleNewsPlaceholderImage(nextThumbnail) ||
          currentIsRealPublisherThumbnail ||
          nextThumbnail === currentThumbnail
        ) {
          skippedCount += 1;
          continue;
        }

        await client.query(
          `
            UPDATE articles
            SET
              thumbnail = $2,
              "updatedAt" = NOW()
            WHERE id = $1
          `,
          [article.id, nextThumbnail]
        );

        updatedCount += 1;
        if (updatedSamples.length < 12) {
          updatedSamples.push({
            id: article.id,
            title: article.title || "",
            old_thumbnail: currentThumbnail || "",
            new_thumbnail: nextThumbnail,
            thumbnail_source: enriched?.thumbnailSource || "",
            url: article.canonicalLink || article.link || "",
          });
        }
      } catch (error) {
        failedCount += 1;
        console.error(
          `Backfill failed for article ${article.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    console.log("\n=== Backfill Result ===");
    console.table(
      formatRows([
        {
          processed_count: batch.length,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          failed_count: failedCount,
          limit,
        },
      ])
    );

    console.log("\n=== Sample Updated Rows ===");
    if (!updatedSamples.length) {
      console.log("(no articles updated in this run)");
    } else {
      console.table(formatRows(updatedSamples));
    }
  } catch (error) {
    console.error("Failed to run Google News thumbnail backfill.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
