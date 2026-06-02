import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { analyzeGoogleNewsPublisherUrl, isGoogleNewsPlaceholderImage } from "../src/services/thumbnailService.js";
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
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Math.min(20, Number(limitArg ? limitArg.split("=")[1] : 5) || 5));

const client = new Client({
  connectionString: databaseUrl,
  application_name: "google-news-analyze-url",
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

async function loadSampleArticles() {
  const result = await client.query(
    `
      SELECT
        id,
        title,
        source,
        link,
        "canonicalLink",
        thumbnail,
        "pubDate",
        "createdAt"
      FROM articles
      WHERE (
        source = 'news.google.com'
        OR link ILIKE 'https://news.google.com%'
        OR "canonicalLink" ILIKE 'https://news.google.com%'
      )
      AND (
        thumbnail IS NULL
        OR thumbnail = ''
        OR thumbnail = $1
        OR link ILIKE 'https://news.google.com%'
        OR "canonicalLink" ILIKE 'https://news.google.com%'
      )
      ORDER BY "createdAt" DESC
      LIMIT $2
    `,
    [env.placeholderImage, limit]
  );

  return result.rows.filter(
    (article) =>
      !article.thumbnail ||
      article.thumbnail === env.placeholderImage ||
      isGoogleNewsPlaceholderImage(article.thumbnail)
  );
}

async function main() {
  try {
    await client.connect();
    const sampleArticles = await loadSampleArticles();

    console.log("\n=== Google News URL Analysis ===");
    console.table(
      formatRows([
        {
          sample_size: sampleArticles.length,
          limit,
        },
      ])
    );

    const rows = [];
    const failureReasonCounts = new Map();

    for (const article of sampleArticles) {
      const analysis = await analyzeGoogleNewsPublisherUrl(article.link || article.canonicalLink || "");
      const candidateSummary = analysis.publisherUrlCandidates
        .slice(0, 5)
        .map((candidate) => `${candidate.method}:${candidate.url}`)
        .join("\n");

      if (analysis.failureReason) {
        failureReasonCounts.set(
          analysis.failureReason,
          (failureReasonCounts.get(analysis.failureReason) || 0) + 1
        );
      }

      rows.push({
        title: article.title || "",
        originalRssUrl: analysis.originalRssUrl || article.link || "",
        httpStatus: analysis.httpStatus || 0,
        redirectChain: (analysis.redirectChain || [])
          .map((entry) => `${entry.status}:${entry.url}${entry.location ? ` -> ${entry.location}` : ""}`)
          .join("\n"),
        finalUrl: analysis.finalUrl || "",
        canonicalUrl: analysis.canonicalUrl || "",
        publisherUrlCandidatesFound: candidateSummary || "",
        extractionMethodUsed: analysis.extractionMethodUsed || "",
        failureReason: analysis.failureReason || "",
      });
    }

    console.log("\n=== Google News URL Analysis Rows ===");
    if (!rows.length) {
      console.log("(no matching Google News rows found)");
    } else {
      console.table(formatRows(rows));
    }

    console.log("\n=== Top Failure Reasons ===");
    if (!failureReasonCounts.size) {
      console.log("(no failures in sample)");
    } else {
      console.table(
        formatRows(
          Array.from(failureReasonCounts.entries())
            .map(([failure_reason, count]) => ({ failure_reason, count }))
            .sort((left, right) => right.count - left.count)
        )
      );
    }
  } catch (error) {
    console.error("Failed to analyze Google News URLs.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
