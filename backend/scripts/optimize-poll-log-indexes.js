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
const TARGET_INDEX = "poll_logs_feedId_startedAt_idx";

const client = new Client({
  connectionString: databaseUrl,
  application_name: "optimize-poll-log-indexes",
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

    const [targetIndex] = await runQuery(
      "Poll Log Index Review",
      `
        SELECT
          cls.relname AS index_name,
          ind.indisunique AS is_unique,
          ind.indisprimary AS is_primary,
          pg_get_indexdef(ind.indexrelid) AS index_definition,
          pg_size_pretty(pg_relation_size(ind.indexrelid)) AS index_size,
          pg_relation_size(ind.indexrelid) AS index_size_bytes,
          COALESCE(stat.idx_scan, 0) AS idx_scan,
          COALESCE(stat.idx_tup_read, 0) AS idx_tup_read,
          COALESCE(stat.idx_tup_fetch, 0) AS idx_tup_fetch
        FROM pg_index ind
        JOIN pg_class cls ON cls.oid = ind.indexrelid
        JOIN pg_class tbl ON tbl.oid = ind.indrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        LEFT JOIN pg_stat_user_indexes stat ON stat.indexrelid = ind.indexrelid
        WHERE ns.nspname = 'public'
          AND tbl.relname = 'poll_logs'
          AND cls.relname = $1
      `,
      [TARGET_INDEX]
    );

    await runQuery(
      "All poll_logs Indexes",
      `
        SELECT
          cls.relname AS index_name,
          ind.indisunique AS is_unique,
          ind.indisprimary AS is_primary,
          pg_get_indexdef(ind.indexrelid) AS index_definition,
          pg_size_pretty(pg_relation_size(ind.indexrelid)) AS index_size,
          pg_relation_size(ind.indexrelid) AS index_size_bytes,
          COALESCE(stat.idx_scan, 0) AS idx_scan
        FROM pg_index ind
        JOIN pg_class cls ON cls.oid = ind.indexrelid
        JOIN pg_class tbl ON tbl.oid = ind.indrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        LEFT JOIN pg_stat_user_indexes stat ON stat.indexrelid = ind.indexrelid
        WHERE ns.nspname = 'public'
          AND tbl.relname = 'poll_logs'
        ORDER BY pg_relation_size(ind.indexrelid) DESC, cls.relname ASC
      `
    );

    console.log("\n=== Safe Recommendation ===");
    if (!targetIndex) {
      console.log(`${TARGET_INDEX} was not found. Nothing to review or drop.`);
      await client.query("COMMIT");
      return;
    }

    console.table(
      formatRows([
        {
          index_name: targetIndex.index_name,
          recommendation:
            "Review dropping this large secondary index if poll_logs queries do not depend on feedId + startedAt lookups. Primary key must be kept.",
          rationale:
            "This index is often the main storage driver for poll_logs and may be low value if historical poll log lookups are rare.",
        },
      ])
    );

    await client.query("COMMIT");

    if (!execute) {
      console.log("\nDry run only. No indexes were dropped.");
      console.log("Run with --execute to drop poll_logs_feedId_startedAt_idx.");
      return;
    }

    if (targetIndex.is_primary) {
      console.error("Refusing to drop the primary key index.");
      process.exit(1);
    }

    await client.query(`DROP INDEX IF EXISTS "${TARGET_INDEX}"`);
    console.log(`\nDropped index: ${TARGET_INDEX}`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to optimize poll_logs indexes.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
