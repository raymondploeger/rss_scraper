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

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const daysArg = args.find((arg) => arg.startsWith("--days="));
const retentionDays = Math.max(1, Number(daysArg ? daysArg.split("=")[1] : 14) || 14);

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-poll-logs",
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

    const tableCheck = await client.query(
      "SELECT to_regclass('public.poll_logs') AS poll_logs_table"
    );
    if (!tableCheck.rows[0]?.poll_logs_table) {
      console.error("Table public.poll_logs was not found.");
      process.exit(1);
    }

    const [overview] = await runQuery(
      "Poll Logs Cleanup Preview",
      `
        WITH cutoff AS (
          SELECT NOW() - ($1::text || ' days')::interval AS cutoff_at
        )
        SELECT
          $1::int AS retention_days,
          cutoff.cutoff_at,
          COUNT(*)::bigint AS rows_to_delete,
          MIN(pl."startedAt") AS oldest_matching_row,
          MAX(pl."startedAt") AS newest_matching_row,
          pg_size_pretty(pg_total_relation_size('public.poll_logs')) AS current_table_size,
          pg_total_relation_size('public.poll_logs') AS current_table_size_bytes,
          pg_size_pretty(
            COALESCE(
              SUM(
                CASE
                  WHEN pl."startedAt" < cutoff.cutoff_at THEN pg_column_size(pl)
                  ELSE 0
                END
              ),
              0
            )
          ) AS estimated_row_bytes_to_remove,
          COALESCE(
            SUM(
              CASE
                WHEN pl."startedAt" < cutoff.cutoff_at THEN pg_column_size(pl)
                ELSE 0
              END
            ),
            0
          ) AS estimated_row_bytes_to_remove_raw
        FROM poll_logs pl
        CROSS JOIN cutoff
      `,
      [retentionDays]
    );

    await runQuery(
      "Rows Per Day Eligible For Cleanup",
      `
        WITH cutoff AS (
          SELECT NOW() - ($1::text || ' days')::interval AS cutoff_at
        )
        SELECT
          DATE(pl."startedAt") AS day,
          COUNT(*)::bigint AS row_count
        FROM poll_logs pl
        CROSS JOIN cutoff
        WHERE pl."startedAt" < cutoff.cutoff_at
        GROUP BY DATE(pl."startedAt")
        ORDER BY day DESC
        LIMIT 30
      `,
      [retentionDays]
    );

    console.log("\n=== Mode ===");
    if (!execute) {
      console.log("Dry run only. No rows were deleted.");
      console.log("Run with --execute to perform the cleanup.");
      return;
    }

    await client.query("BEGIN");
    const deleteResult = await client.query(
      `
        WITH cutoff AS (
          SELECT NOW() - ($1::text || ' days')::interval AS cutoff_at
        )
        DELETE FROM poll_logs
        WHERE "startedAt" < (SELECT cutoff_at FROM cutoff)
      `,
      [retentionDays]
    );
    await client.query("COMMIT");

    console.log("\n=== Cleanup Result ===");
    console.table(
      formatRows([
        {
          retention_days: retentionDays,
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
    console.error("Failed to clean up poll_logs.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
