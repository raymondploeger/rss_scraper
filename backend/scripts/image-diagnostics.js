import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { env } from "../src/config/env.js";
import { diagnoseArticleImage } from "../src/services/thumbnailService.js";

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
const limit = Math.max(1, Math.min(500, Number(limitArg ? limitArg.split("=")[1] : 120) || 120));

const client = new Client({
  connectionString: databaseUrl,
  application_name: "image-diagnostics",
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

function incrementCount(map, key) {
  const normalizedKey = String(key || "unknown").trim() || "unknown";
  map.set(normalizedKey, (map.get(normalizedKey) || 0) + 1);
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
          link,
          source,
          thumbnail,
          summary,
          "contentSnippet",
          "createdAt",
          "pubDate"
        FROM articles
        WHERE thumbnail IS NULL
          OR thumbnail = ''
          OR thumbnail = $1
        ORDER BY "createdAt" DESC
        LIMIT $2
      `,
      [env.placeholderImage, limit]
    );

    const articles = result.rows;
    console.log("\n=== Image Diagnostics ===");
    console.table(
      formatRows([
        {
          scanned_articles: articles.length,
          placeholder_image: env.placeholderImage,
          limit,
        },
      ])
    );

    const byDomain = new Map();
    const byReason = new Map();
    const failedDiagnostics = [];

    for (const article of articles) {
      const diagnostic = await diagnoseArticleImage(
        article.link,
        article.contentSnippet || article.summary || "",
        article.title || ""
      );

      if (diagnostic.finalThumbnail) {
        continue;
      }

      incrementCount(byDomain, diagnostic.domain || article.source || "unknown");
      if (Array.isArray(diagnostic.rejectedReasons) && diagnostic.rejectedReasons.length) {
        diagnostic.rejectedReasons.forEach((reason) => incrementCount(byReason, reason));
      } else {
        incrementCount(byReason, "no_valid_image_found");
      }

      failedDiagnostics.push({
        domain: diagnostic.domain || article.source || "unknown",
        source: article.source || "",
        title: article.title || "",
        url: article.link || "",
        ogImage: diagnostic.ogImageFound,
        twitterImage: diagnostic.twitterImageFound,
        schemaImage: diagnostic.schemaImageFound,
        articleImage: diagnostic.articleImageFound,
        rejectedReason: Array.isArray(diagnostic.rejectedReasons) && diagnostic.rejectedReasons.length
          ? diagnostic.rejectedReasons.join(", ")
          : "no_valid_image_found",
        publishedAt: article.pubDate,
        importedAt: article.createdAt,
      });
    }

    await client.query("COMMIT");

    console.log("\n=== Top Domains Producing No Image ===");
    console.table(
      formatRows(
        Array.from(byDomain.entries())
          .map(([domain, count]) => ({ domain, no_image_count: count }))
          .sort((left, right) => right.no_image_count - left.no_image_count)
          .slice(0, 20)
      )
    );

    console.log("\n=== Most Common Rejection Reasons ===");
    console.table(
      formatRows(
        Array.from(byReason.entries())
          .map(([reason, count]) => ({ rejection_reason: reason, count }))
          .sort((left, right) => right.count - left.count)
          .slice(0, 20)
      )
    );

    console.log("\n=== Sample Failures ===");
    if (!failedDiagnostics.length) {
      console.log("(no failures found in scanned articles)");
    } else {
      console.table(formatRows(failedDiagnostics.slice(0, 25)));
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to run image diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
