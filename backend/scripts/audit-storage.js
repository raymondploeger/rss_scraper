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

const client = new Client({
  connectionString: databaseUrl,
  application_name: "audit-storage",
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
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    await runQuery(
      "Database Total Size",
      `
        SELECT
          current_database() AS database_name,
          pg_size_pretty(pg_database_size(current_database())) AS total_size,
          pg_database_size(current_database()) AS total_size_bytes
      `
    );

    await runQuery(
      "Table Sizes",
      `
        SELECT
          n.nspname AS schema_name,
          c.relname AS table_name,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
          pg_total_relation_size(c.oid) AS total_size_bytes,
          pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
          pg_relation_size(c.oid) AS table_size_bytes,
          pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
          pg_indexes_size(c.oid) AS indexes_size_bytes,
          COALESCE(s.n_live_tup, c.reltuples)::bigint AS estimated_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE c.relkind = 'r'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(c.oid) DESC
      `
    );

    await runQuery(
      "Index Sizes",
      `
        SELECT
          ns.nspname AS schema_name,
          tbl.relname AS table_name,
          idx.relname AS index_name,
          pg_size_pretty(pg_relation_size(idx.oid)) AS index_size,
          pg_relation_size(idx.oid) AS index_size_bytes,
          COALESCE(stats.idx_scan, 0)::bigint AS idx_scan
        FROM pg_index i
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        LEFT JOIN pg_stat_user_indexes stats ON stats.indexrelid = idx.oid
        WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_relation_size(idx.oid) DESC
      `
    );

    await runQuery(
      "Total Article Count",
      `
        SELECT COUNT(*)::bigint AS total_articles
        FROM articles
      `
    );

    await runQuery(
      "Article Count Per Feed",
      `
        SELECT
          f.name AS feed_name,
          f."sourceType" AS source_type,
          COUNT(a.id)::bigint AS article_count,
          MIN(a."createdAt") AS oldest_imported_at,
          MAX(a."createdAt") AS newest_imported_at,
          MIN(a."pubDate") AS oldest_published_at,
          MAX(a."pubDate") AS newest_published_at
        FROM feeds f
        LEFT JOIN articles a ON a."feedId" = f.id
        GROUP BY f.id, f.name, f."sourceType"
        ORDER BY article_count DESC, newest_imported_at DESC NULLS LAST
      `
    );

    await runQuery(
      "Duplicate URL Counts",
      `
        SELECT
          COALESCE("canonicalLink", link) AS url,
          COUNT(*)::bigint AS duplicate_count,
          MIN("createdAt") AS oldest_imported_at,
          MAX("createdAt") AS newest_imported_at
        FROM articles
        WHERE COALESCE("canonicalLink", link, '') <> ''
        GROUP BY COALESCE("canonicalLink", link)
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC, newest_imported_at DESC
        LIMIT 100
      `
    );

    await runQuery(
      "isDuplicate Counts",
      `
        SELECT
          "isDuplicate",
          COUNT(*)::bigint AS article_count
        FROM articles
        GROUP BY "isDuplicate"
        ORDER BY article_count DESC
      `
    );

    await runQuery(
      "Poll Log Count",
      `
        SELECT
          COUNT(*)::bigint AS total_poll_logs,
          MIN("startedAt") AS oldest_started_at,
          MAX("startedAt") AS newest_started_at
        FROM poll_logs
      `
    );

    await runQuery(
      "Poll Logs Older Than 30/60/90 Days",
      `
        SELECT
          COUNT(*) FILTER (WHERE "startedAt" < NOW() - INTERVAL '30 days')::bigint AS older_than_30_days,
          COUNT(*) FILTER (WHERE "startedAt" < NOW() - INTERVAL '60 days')::bigint AS older_than_60_days,
          COUNT(*) FILTER (WHERE "startedAt" < NOW() - INTERVAL '90 days')::bigint AS older_than_90_days
        FROM poll_logs
      `
    );

    await runQuery(
      "Poll Logs By Status",
      `
        SELECT
          status,
          COUNT(*)::bigint AS poll_log_count,
          COUNT(*) FILTER (WHERE "startedAt" < NOW() - INTERVAL '30 days')::bigint AS older_than_30_days,
          COUNT(*) FILTER (WHERE "startedAt" < NOW() - INTERVAL '60 days')::bigint AS older_than_60_days,
          COUNT(*) FILTER (WHERE "startedAt" < NOW() - INTERVAL '90 days')::bigint AS older_than_90_days,
          MIN("startedAt") AS oldest_started_at,
          MAX("startedAt") AS newest_started_at
        FROM poll_logs
        GROUP BY status
        ORDER BY poll_log_count DESC
      `
    );

    await runQuery(
      "Poll Logs By Feed",
      `
        SELECT
          f.name AS feed_name,
          COUNT(p.id)::bigint AS poll_log_count,
          COUNT(p.id) FILTER (WHERE p."startedAt" < NOW() - INTERVAL '30 days')::bigint AS older_than_30_days,
          COUNT(p.id) FILTER (WHERE p."startedAt" < NOW() - INTERVAL '60 days')::bigint AS older_than_60_days,
          COUNT(p.id) FILTER (WHERE p."startedAt" < NOW() - INTERVAL '90 days')::bigint AS older_than_90_days,
          MIN(p."startedAt") AS oldest_started_at,
          MAX(p."startedAt") AS newest_started_at
        FROM feeds f
        JOIN poll_logs p ON p."feedId" = f.id
        GROUP BY f.id, f.name
        ORDER BY poll_log_count DESC
        LIMIT 100
      `
    );

    await runQuery(
      "Largest Article Text Fields",
      `
        SELECT
          id,
          title,
          "feedName" AS feed_name,
          COALESCE("canonicalLink", link) AS url,
          LENGTH(COALESCE(summary, '')) AS summary_len,
          LENGTH(COALESCE("contentSnippet", '')) AS snippet_len,
          LENGTH(COALESCE("summaryShort", '')) AS summary_short_len,
          LENGTH(COALESCE(thumbnail, '')) AS thumbnail_len,
          (
            LENGTH(COALESCE(summary, '')) +
            LENGTH(COALESCE("contentSnippet", '')) +
            LENGTH(COALESCE("summaryShort", '')) +
            LENGTH(COALESCE(thumbnail, ''))
          ) AS measured_text_len,
          "createdAt" AS imported_at,
          "pubDate" AS published_at
        FROM articles
        ORDER BY measured_text_len DESC
        LIMIT 100
      `
    );

    await runQuery(
      "Feeds With Largest Average Summary/Snippet Size",
      `
        SELECT
          "feedName" AS feed_name,
          COUNT(*)::bigint AS article_count,
          AVG(LENGTH(COALESCE(summary, '')))::int AS avg_summary_len,
          AVG(LENGTH(COALESCE("contentSnippet", '')))::int AS avg_snippet_len,
          AVG(LENGTH(COALESCE(thumbnail, '')))::int AS avg_thumbnail_len,
          MAX(LENGTH(COALESCE(summary, ''))) AS max_summary_len,
          MAX(LENGTH(COALESCE("contentSnippet", ''))) AS max_snippet_len
        FROM articles
        GROUP BY "feedName"
        ORDER BY (AVG(LENGTH(COALESCE(summary, ''))) + AVG(LENGTH(COALESCE("contentSnippet", '')))) DESC
        LIMIT 100
      `
    );

    await client.query("COMMIT");
    console.log("\nRead-only storage audit completed successfully.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to run storage audit.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
