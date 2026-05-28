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
  application_name: "poll-logs-analysis",
});

const POLL_LOG_COLUMNS = [
  "id",
  "feedId",
  "startedAt",
  "finishedAt",
  "status",
  "newArticles",
  "errorMessage",
];

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

async function runQuery(label, sql) {
  const result = await client.query(sql);
  console.log(`\n=== ${label} ===`);
  if (!result.rows.length) {
    console.log("(no rows)");
    return [];
  }
  console.table(formatRows(result.rows));
  return result.rows;
}

function buildColumnSizeQuery() {
  const averages = POLL_LOG_COLUMNS.map(
    (columnName) =>
      `AVG(pg_column_size(${columnName === "errorMessage" ? `"${columnName}"` : `"${columnName}"`}::text))::numeric(10,2) AS "${columnName}_avg_bytes"`
  );
  const maximums = POLL_LOG_COLUMNS.map(
    (columnName) =>
      `MAX(pg_column_size(${columnName === "errorMessage" ? `"${columnName}"` : `"${columnName}"`}::text)) AS "${columnName}_max_bytes"`
  );

  return `
    SELECT
      ${averages.join(",\n      ")},
      ${maximums.join(",\n      ")}
    FROM poll_logs
  `;
}

async function main() {
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const tableCheck = await client.query(
      "SELECT to_regclass('public.poll_logs') AS poll_logs_table"
    );
    if (!tableCheck.rows[0]?.poll_logs_table) {
      console.error("Table public.poll_logs was not found.");
      await client.query("ROLLBACK");
      process.exit(1);
    }

    const [overview] = await runQuery(
      "Poll Logs Overview",
      `
        SELECT
          COUNT(*)::bigint AS total_row_count,
          MIN("startedAt") AS oldest_started_at,
          MAX("startedAt") AS newest_started_at,
          pg_size_pretty(pg_total_relation_size('public.poll_logs')) AS total_table_size,
          pg_total_relation_size('public.poll_logs') AS total_table_size_bytes,
          pg_size_pretty(pg_relation_size('public.poll_logs')) AS heap_size,
          pg_relation_size('public.poll_logs') AS heap_size_bytes,
          pg_size_pretty(pg_indexes_size('public.poll_logs')) AS total_index_size,
          pg_indexes_size('public.poll_logs') AS total_index_size_bytes,
          AVG(pg_column_size(poll_logs))::numeric(10,2) AS average_row_size_bytes
        FROM poll_logs
      `
    );

    await runQuery(
      "Rows Per Day",
      `
        SELECT
          DATE("startedAt") AS day,
          COUNT(*)::bigint AS row_count
        FROM poll_logs
        GROUP BY DATE("startedAt")
        ORDER BY day DESC
        LIMIT 30
      `
    );

    const columnSizes = await runQuery("Approximate Column Sizes", buildColumnSizeQuery());
    if (columnSizes[0]) {
      const reshaped = POLL_LOG_COLUMNS.map((columnName) => ({
        column_name: columnName,
        avg_bytes: columnSizes[0][`${columnName}_avg_bytes`] ?? "",
        max_bytes: columnSizes[0][`${columnName}_max_bytes`] ?? "",
      }));
      console.log("\n=== Largest Columns (approximate) ===");
      console.table(formatRows(reshaped).sort((left, right) => Number(right.avg_bytes || 0) - Number(left.avg_bytes || 0)));
    }

    await runQuery(
      "Sample Rows",
      `
        SELECT
          "id",
          "feedId",
          "startedAt",
          "finishedAt",
          "status",
          "newArticles",
          LEFT(COALESCE("errorMessage", ''), 180) AS "errorMessage"
        FROM poll_logs
        ORDER BY "startedAt" DESC
        LIMIT 5
      `
    );

    await runQuery(
      "Index Names And Sizes",
      `
        SELECT
          indexname AS index_name,
          indexdef AS index_definition,
          pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size,
          pg_relation_size(indexname::regclass) AS index_size_bytes
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'poll_logs'
        ORDER BY pg_relation_size(indexname::regclass) DESC
      `
    );

    await runQuery(
      "Possible Duplicate / Repetitive Logging",
      `
        SELECT
          "feedId",
          "status",
          "newArticles",
          LEFT(COALESCE("errorMessage", ''), 120) AS error_message_sample,
          COUNT(*)::bigint AS repeat_count,
          MIN("startedAt") AS first_seen,
          MAX("startedAt") AS last_seen
        FROM poll_logs
        GROUP BY
          "feedId",
          "status",
          "newArticles",
          LEFT(COALESCE("errorMessage", ''), 120)
        HAVING COUNT(*) > 1
        ORDER BY repeat_count DESC, last_seen DESC
        LIMIT 20
      `
    );

    await runQuery(
      "Feeds With Most Poll Log Rows",
      `
        SELECT
          "feedId",
          COUNT(*)::bigint AS row_count,
          MIN("startedAt") AS first_seen,
          MAX("startedAt") AS last_seen
        FROM poll_logs
        GROUP BY "feedId"
        ORDER BY row_count DESC
        LIMIT 20
      `
    );

    await client.query("COMMIT");

    console.log("\n=== Summary ===");
    console.log(`Total rows: ${overview?.total_row_count ?? "(unknown)"}`);
    console.log(`Oldest row: ${overview?.oldest_started_at ? new Date(overview.oldest_started_at).toISOString() : "(unknown)"}`);
    console.log(`Newest row: ${overview?.newest_started_at ? new Date(overview.newest_started_at).toISOString() : "(unknown)"}`);
    console.log(`Average row size: ${overview?.average_row_size_bytes ?? "(unknown)"} bytes`);
    console.log(`Total table size: ${overview?.total_table_size ?? "(unknown)"}`);
    console.log(`Total index size: ${overview?.total_index_size ?? "(unknown)"}`);
    console.log("\nRead-only poll_logs analysis completed successfully.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to analyze poll_logs.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
