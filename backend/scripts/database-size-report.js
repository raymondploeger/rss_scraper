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
  application_name: "database-size-report",
});

const formatRows = (rows = []) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value == null ? "" : value])
    )
  );

async function runQuery(label, sql) {
  const result = await client.query(sql);
  console.log(`\n=== ${label} ===`);
  if (!result.rows.length) {
    console.log("(no rows)");
    return result.rows;
  }
  console.table(formatRows(result.rows));
  return result.rows;
}

async function main() {
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const [databaseInfo] = await runQuery(
      "Database Size",
      `
        SELECT
          current_database() AS database_name,
          pg_size_pretty(pg_database_size(current_database())) AS total_database_size,
          pg_database_size(current_database()) AS total_database_size_bytes
      `
    );

    const [indexTotals] = await runQuery(
      "Index Size Totals",
      `
        SELECT
          pg_size_pretty(COALESCE(SUM(pg_indexes_size(c.oid)), 0)) AS total_indexes_size,
          COALESCE(SUM(pg_indexes_size(c.oid)), 0) AS total_indexes_size_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      `
    );

    await runQuery(
      "Largest Tables",
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
        LIMIT 20
      `
    );

    await runQuery(
      "Largest Indexes",
      `
        SELECT
          schemaname AS schema_name,
          tablename AS table_name,
          indexname AS index_name,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
          pg_relation_size(indexrelid) AS index_size_bytes,
          idx_scan
        FROM pg_stat_user_indexes
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
      `
    );

    await client.query("COMMIT");

    console.log("\n=== Summary ===");
    console.log(`Database: ${databaseInfo?.database_name || "(unknown)"}`);
    console.log(`Total database size: ${databaseInfo?.total_database_size || "(unknown)"}`);
    console.log(`Total index size: ${indexTotals?.total_indexes_size || "(unknown)"}`);
    console.log("\nRead-only report completed successfully.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to generate database size report.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
