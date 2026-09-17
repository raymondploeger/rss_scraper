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
const apply = process.argv.slice(2).includes("--apply");

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-keesing-platform-noise",
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

function getCleanupCandidatesCte() {
  return `
    WITH keesing_articles AS (
      SELECT
        a.id,
        a.title,
        a.link,
        a."canonicalLink",
        a.source,
        a.topic,
        a."pubDate",
        a."createdAt",
        f.name AS feed_name,
        f."rssUrl" AS feed_url,
        LOWER(COALESCE(a."canonicalLink", a.link, '')) AS normalized_url,
        LOWER(COALESCE(a.title, '')) AS normalized_title
      FROM articles a
      INNER JOIN feeds f
        ON f.id = a."feedId"
      WHERE
        f.name = 'Keesing Platform'
        OR f."rssUrl" ILIKE '%platform.keesingtechnologies.com%'
        OR a.source ILIKE '%platform.keesingtechnologies.com%'
    ),
    cleanup_candidates AS (
      SELECT
        *,
        CASE
          WHEN normalized_url LIKE '%/author/%' THEN 'author-page'
          WHEN normalized_url LIKE '%/category/%' THEN 'category-page'
          WHEN normalized_url LIKE '%/tag/%' THEN 'tag-page'
          WHEN normalized_url LIKE '%/page/%' THEN 'pagination-page'
          WHEN normalized_url LIKE '%/wp-content/%' THEN 'asset-url'
          WHEN normalized_url ~ '/archives?(/|$|[?#])' THEN 'archive-page'
          WHEN normalized_url ~ '/[^/?#]*-archives?(/|$|[?#])' THEN 'archive-index-page'
          WHEN normalized_url LIKE '%?s=%' OR normalized_url LIKE '%&s=%' THEN 'search-page'
          WHEN normalized_title LIKE '% author at keesing platform' THEN 'author-title'
          WHEN normalized_title LIKE '% archives - keesing platform' THEN 'archive-title'
          ELSE 'review'
        END AS match_reason
      FROM keesing_articles
      WHERE
        normalized_url LIKE '%/author/%'
        OR normalized_url LIKE '%/category/%'
        OR normalized_url LIKE '%/tag/%'
        OR normalized_url LIKE '%/page/%'
        OR normalized_url LIKE '%/wp-content/%'
        OR normalized_url ~ '/archives?(/|$|[?#])'
        OR normalized_url ~ '/[^/?#]*-archives?(/|$|[?#])'
        OR normalized_url LIKE '%?s=%'
        OR normalized_url LIKE '%&s=%'
        OR normalized_title LIKE '% author at keesing platform'
        OR normalized_title LIKE '% archives - keesing platform'
    )
  `;
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

async function main() {
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL.");
    console.error("Set DATABASE_URL in the environment or add it to backend/.env before running this script.");
    process.exit(1);
  }

  try {
    await client.connect();

    const [overview] = await runQuery(
      "Keesing Platform Noise Cleanup Dry Run",
      `
        ${getCleanupCandidatesCte()}
        SELECT
          COUNT(*)::bigint AS total_matching_articles,
          MIN("pubDate") AS oldest_matching_article,
          MAX("pubDate") AS newest_matching_article,
          MIN("createdAt") AS oldest_imported_at,
          MAX("createdAt") AS newest_imported_at
        FROM cleanup_candidates
      `
    );

    await runQuery(
      "Reason Summary",
      `
        ${getCleanupCandidatesCte()}
        SELECT
          match_reason,
          COUNT(*)::bigint AS matching_articles,
          MIN("pubDate") AS oldest_article,
          MAX("pubDate") AS newest_article
        FROM cleanup_candidates
        GROUP BY match_reason
        ORDER BY matching_articles DESC, match_reason ASC
      `
    );

    await runQuery(
      "Sample Rows",
      `
        ${getCleanupCandidatesCte()}
        SELECT
          id,
          title,
          COALESCE("canonicalLink", link) AS url,
          topic,
          match_reason,
          "pubDate",
          "createdAt"
        FROM cleanup_candidates
        ORDER BY "createdAt" DESC, "pubDate" DESC
        LIMIT 40
      `
    );

    const total = Number(overview?.total_matching_articles || 0);
    console.log("\n=== Execution Mode ===");
    if (!apply) {
      console.log("Dry run only. No rows were deleted.");
      console.log("Run with --apply to delete matching Keesing Platform noise articles.");
      return;
    }

    if (!total) {
      console.log("No matching rows to delete.");
      return;
    }

    console.warn("WARNING: --apply mode is enabled.");
    console.warn("This will permanently delete persisted Keesing Platform author/archive/category/search records.");
    console.warn(`Rows selected for deletion: ${total}`);

    await client.query("BEGIN");
    try {
      const result = await client.query(`
        ${getCleanupCandidatesCte()}
        DELETE FROM articles
        WHERE id IN (SELECT id FROM cleanup_candidates)
      `);
      await client.query("COMMIT");
      console.log("\n=== Cleanup Result ===");
      console.table(formatRows([{ deleted_rows: Number(result.rowCount || 0) }]));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
