import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { env } from "../src/config/env.js";

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
const sampleLimitArg = args.find((arg) => arg.startsWith("--sample="));
const sampleLimit = Math.max(1, Math.min(50, Number(sampleLimitArg ? sampleLimitArg.split("=")[1] : 20) || 20));

const client = new Client({
  connectionString: databaseUrl,
  application_name: "google-news-diagnostics",
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

function isGoogleNewsHost(hostname) {
  return hostname === "news.google.com" || hostname.endsWith(".news.google.com");
}

function resolveGoogleNewsUrl(article) {
  const linkHost = getHostname(article.link);
  const canonicalHost = getHostname(article.canonicalLink);

  if (isGoogleNewsHost(linkHost)) {
    return article.link || "";
  }
  if (isGoogleNewsHost(canonicalHost)) {
    return article.canonicalLink || "";
  }
  return "";
}

function resolveOriginalUrl(article) {
  const linkHost = getHostname(article.link);
  const canonicalHost = getHostname(article.canonicalLink);

  if (article.canonicalLink && !isGoogleNewsHost(canonicalHost)) {
    return article.canonicalLink;
  }
  if (article.link && !isGoogleNewsHost(linkHost)) {
    return article.link;
  }
  return "";
}

function getThumbnailSourceLabel(thumbnail) {
  const value = String(thumbnail || "").trim();
  if (!value || value === env.placeholderImage) {
    return "no-image";
  }

  const host = getHostname(value);
  if (host.includes("googleusercontent.com") || isGoogleNewsHost(host)) {
    return "google-news-thumbnail";
  }

  return "original-thumbnail";
}

async function main() {
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const result = await client.query(
      `
        SELECT
          id,
          title,
          source,
          link,
          "canonicalLink",
          thumbnail,
          "createdAt",
          "pubDate"
        FROM articles
        WHERE source = 'news.google.com'
           OR link ILIKE 'https://news.google.com%'
           OR "canonicalLink" ILIKE 'https://news.google.com%'
        ORDER BY "createdAt" DESC
      `
    );

    const articles = result.rows.map((article) => {
      const googleNewsUrl = resolveGoogleNewsUrl(article);
      const originalUrl = resolveOriginalUrl(article);
      const thumbnailSource = getThumbnailSourceLabel(article.thumbnail);
      return {
        ...article,
        googleNewsUrl,
        originalUrl,
        originalUrlAvailable: Boolean(originalUrl),
        thumbnailSource,
      };
    });

    await client.query("COMMIT");

    const totalGoogleNewsArticles = articles.length;
    const withOriginalUrl = articles.filter((article) => article.originalUrlAvailable).length;
    const withoutOriginalUrl = totalGoogleNewsArticles - withOriginalUrl;
    const usingGoogleNewsThumbnail = articles.filter((article) => article.thumbnailSource === "google-news-thumbnail").length;
    const usingOriginalThumbnail = articles.filter((article) => article.thumbnailSource === "original-thumbnail").length;
    const noImage = articles.filter((article) => article.thumbnailSource === "no-image").length;

    console.log("\n=== Google News Diagnostics ===");
    console.table(
      formatRows([
        {
          totalGoogleNewsArticles,
          articlesWithOriginalUrlAvailable: withOriginalUrl,
          articlesWithoutOriginalUrl: withoutOriginalUrl,
          articlesUsingGoogleNewsThumbnail: usingGoogleNewsThumbnail,
          articlesUsingOriginalThumbnail: usingOriginalThumbnail,
          articlesWithNoImage: noImage,
        },
      ])
    );

    console.log("\n=== Sample Rows ===");
    console.table(
      formatRows(
        articles.slice(0, sampleLimit).map((article) => ({
          title: article.title || "",
          googleNewsUrl: article.googleNewsUrl || "",
          originalUrl: article.originalUrl || "",
          thumbnailUrl: article.thumbnail || "",
          thumbnailSource: article.thumbnailSource,
        }))
      )
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to run Google News diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
