import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

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

const execute = process.argv.slice(2).includes("--execute");

const PRODUCT_URL_SEGMENTS = [
  "/products/",
  "/product/",
  "/solutions/",
  "/solution/",
  "/services/",
  "/service/",
  "/platform/",
  "/portfolio/",
  "/capabilities/",
  "/offerings/",
  "/industries/",
  "/use-cases/",
  "/use-case/",
];

const NEWS_URL_SEGMENTS = [
  "/news/",
  "/press/",
  "/media/",
  "/blog/",
  "/article/",
  "/announcement/",
  "/case-study/",
  "/case-studies/",
];

const PRODUCT_TITLE_PATTERNS = [
  "Document Readers",
  "Manual Devices",
  "Manual Control Devices",
  "Identity Verification Devices",
  "Biometric and Document Verification Software",
  "Biometric Verification Software",
  "Border Management eGates",
  "Self-Kiosks",
  "Seamless Travel Solutions",
  "Identity Management",
  "Product Overview",
  "Solution Overview",
  "Our Products",
  "Our Solutions",
];

const NEWS_TITLE_INDICATORS = [
  "press release",
  "news release",
  "media release",
  "announcement",
  "launched",
  "launch",
  "rollout",
  "deployment",
  "contract",
  "partnership",
  "award",
  "awarded",
  "implemented",
  "implementation",
  "expanded",
];

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-product-pages",
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

function buildLikePatterns(segments = []) {
  return segments.map((segment) => `%${String(segment || "").toLowerCase()}%`);
}

function buildTitlePatterns(phrases = []) {
  return phrases.map((phrase) => `%${String(phrase || "").toLowerCase()}%`);
}

async function runQuery(label, sql, values = []) {
  const result = await client.query(sql, values);
  console.log(`\n=== ${label} ===`);
  if (!result.rows.length) {
    console.log("(no rows)");
    return [];
  }
  console.table(formatRows(result.rows));
  return result.rows;
}

function getMatchingArticlesCte() {
  return `
    WITH article_flags AS (
      SELECT
        a.id,
        a.title,
        a.link,
        a."canonicalLink",
        a.source,
        a."feedName",
        a."pubDate",
        a."createdAt",
        a."updatedAt",
        LOWER(COALESCE(a."canonicalLink", a.link, '')) AS normalized_url,
        LOWER(COALESCE(a.title, '')) AS normalized_title,
        f."sourceType" AS feed_source_type
      FROM articles a
      LEFT JOIN feeds f
        ON f.id = a."feedId"
    ),
    matching_articles AS (
      SELECT
        *,
        normalized_url LIKE ANY($1::text[]) AS product_url_match,
        normalized_url LIKE ANY($2::text[]) AS news_url_match,
        normalized_title LIKE ANY($3::text[]) AS product_title_match,
        normalized_title LIKE ANY($4::text[]) AS news_title_match
      FROM article_flags
      WHERE (
        (
          normalized_url LIKE ANY($1::text[])
          AND NOT (normalized_url LIKE ANY($2::text[]))
        )
        OR normalized_title LIKE ANY($3::text[])
      )
    ),
    cleanup_candidates AS (
      SELECT
        *,
        CASE
          WHEN product_url_match AND NOT news_url_match THEN 'product-url'
          WHEN product_title_match AND NOT news_title_match AND NOT news_url_match THEN 'product-title'
          ELSE 'review'
        END AS match_reason
      FROM matching_articles
      WHERE
        (product_url_match AND NOT news_url_match)
        OR (product_title_match AND NOT news_title_match AND NOT news_url_match)
    )
  `;
}

async function main() {
  const productUrlPatterns = buildLikePatterns(PRODUCT_URL_SEGMENTS);
  const newsUrlPatterns = buildLikePatterns(NEWS_URL_SEGMENTS);
  const productTitlePatterns = buildTitlePatterns(PRODUCT_TITLE_PATTERNS);
  const newsTitlePatterns = buildTitlePatterns(NEWS_TITLE_INDICATORS);
  const queryValues = [productUrlPatterns, newsUrlPatterns, productTitlePatterns, newsTitlePatterns];

  try {
    await client.connect();

    const tableCheck = await client.query(
      "SELECT to_regclass('public.articles') AS articles_table"
    );
    if (!tableCheck.rows[0]?.articles_table) {
      console.error("Table public.articles was not found.");
      process.exit(1);
    }

    const [overview] = await runQuery(
      "Product Page Cleanup Dry Run",
      `
        ${getMatchingArticlesCte()}
        SELECT
          COUNT(*)::bigint AS total_matching_articles,
          MIN("pubDate") AS oldest_matching_article,
          MAX("pubDate") AS newest_matching_article,
          MIN("createdAt") AS oldest_imported_at,
          MAX("createdAt") AS newest_imported_at
        FROM cleanup_candidates
      `,
      queryValues
    );

    await runQuery(
      "Source / Domain Summary",
      `
        ${getMatchingArticlesCte()}
        SELECT
          source,
          COALESCE(feed_source_type, '') AS feed_source_type,
          COUNT(*)::bigint AS matching_articles,
          MIN("pubDate") AS oldest_article,
          MAX("pubDate") AS newest_article
        FROM cleanup_candidates
        GROUP BY source, feed_source_type
        ORDER BY matching_articles DESC, newest_article DESC
      `,
      queryValues
    );

    await runQuery(
      "Sample Rows",
      `
        ${getMatchingArticlesCte()}
        SELECT
          id,
          title,
          COALESCE("canonicalLink", link) AS url,
          source,
          "feedName" AS feed_name,
          feed_source_type,
          "pubDate" AS published_at,
          "createdAt" AS imported_at,
          match_reason
        FROM cleanup_candidates
        ORDER BY "pubDate" DESC, "createdAt" DESC
        LIMIT 20
      `,
      queryValues
    );

    console.log("\n=== Execution Mode ===");
    if (!execute) {
      console.log("Dry run only. No rows were deleted.");
      console.log("Run with --execute to delete matching product / solution pages.");
      return;
    }

    await client.query("BEGIN");
    const deleteResult = await client.query(
      `
        ${getMatchingArticlesCte()}
        DELETE FROM articles
        WHERE id IN (SELECT id FROM cleanup_candidates)
      `,
      queryValues
    );
    await client.query("COMMIT");

    console.log("\n=== Cleanup Result ===");
    console.table(
      formatRows([
        {
          deleted_rows: Number(deleteResult.rowCount || 0),
        },
      ])
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to clean up product / solution pages.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
