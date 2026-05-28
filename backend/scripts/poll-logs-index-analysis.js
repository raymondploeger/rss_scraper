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
  application_name: "poll-logs-index-analysis",
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

function normalizeIndexColumns(indexColumns = "") {
  return String(indexColumns || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function buildRecommendations(indexRows) {
  const recommendations = [];
  const normalizedRows = indexRows.map((row) => ({
    ...row,
    normalizedColumns: normalizeIndexColumns(row.indexed_columns),
    usageCount: Number(row.idx_scan || 0),
    sizeBytes: Number(row.index_size_bytes || 0),
  }));

  normalizedRows.forEach((row) => {
    if (row.usageCount === 0 && row.index_name !== "poll_logs_pkey") {
      recommendations.push({
        type: "unused-index-review",
        index_name: row.index_name,
        recommendation: "No scans recorded in pg_stat_user_indexes. Review whether this index is still needed before considering removal.",
      });
    }
  });

  for (let i = 0; i < normalizedRows.length; i += 1) {
    for (let j = i + 1; j < normalizedRows.length; j += 1) {
      const left = normalizedRows[i];
      const right = normalizedRows[j];
      if (!left.normalizedColumns.length || !right.normalizedColumns.length) {
        continue;
      }

      const sameColumns =
        left.normalizedColumns.length === right.normalizedColumns.length &&
        left.normalizedColumns.every((value, index) => value === right.normalizedColumns[index]);

      if (sameColumns) {
        recommendations.push({
          type: "duplicate-index-review",
          index_name: `${left.index_name} / ${right.index_name}`,
          recommendation: "These indexes appear to cover the same columns in the same order. Check uniqueness, predicates, and query plans before removing either one.",
        });
        continue;
      }

      const leftIsPrefixOfRight =
        left.normalizedColumns.length < right.normalizedColumns.length &&
        left.normalizedColumns.every((value, index) => value === right.normalizedColumns[index]);
      const rightIsPrefixOfLeft =
        right.normalizedColumns.length < left.normalizedColumns.length &&
        right.normalizedColumns.every((value, index) => value === left.normalizedColumns[index]);

      if (leftIsPrefixOfRight && left.usageCount === 0) {
        recommendations.push({
          type: "prefix-index-review",
          index_name: left.index_name,
          recommendation: `${left.index_name} is an unused prefix of ${right.index_name}. Review whether the wider index already covers its workload.`,
        });
      }

      if (rightIsPrefixOfLeft && right.usageCount === 0) {
        recommendations.push({
          type: "prefix-index-review",
          index_name: right.index_name,
          recommendation: `${right.index_name} is an unused prefix of ${left.index_name}. Review whether the wider index already covers its workload.`,
        });
      }
    }
  }

  if (!recommendations.length) {
    recommendations.push({
      type: "no-obvious-redundancy",
      index_name: "",
      recommendation: "No obvious duplicate or unused poll_logs indexes were detected from catalog metadata alone.",
    });
  }

  return recommendations;
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

    const indexRows = await runQuery(
      "Poll Logs Index Details",
      `
        SELECT
          cls.relname AS index_name,
          ind.indisunique AS is_unique,
          ind.indisprimary AS is_primary,
          pg_get_indexdef(ind.indexrelid) AS index_definition,
          ARRAY_TO_STRING(
            ARRAY(
              SELECT pg_get_indexdef(ind.indexrelid, k + 1, TRUE)
              FROM generate_subscripts(ind.indkey, 1) AS k
              ORDER BY k
            ),
            ', '
          ) AS indexed_columns,
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
        ORDER BY pg_relation_size(ind.indexrelid) DESC, cls.relname ASC
      `
    );

    const redundantIndexes = indexRows
      .map((row) => ({
        index_name: row.index_name,
        indexed_columns: row.indexed_columns,
        is_unique: row.is_unique,
        is_primary: row.is_primary,
      }));

    console.log("\n=== Duplicate / Redundant Index Candidates ===");
    const duplicateRows = [];
    for (let i = 0; i < redundantIndexes.length; i += 1) {
      for (let j = i + 1; j < redundantIndexes.length; j += 1) {
        const leftCols = normalizeIndexColumns(redundantIndexes[i].indexed_columns);
        const rightCols = normalizeIndexColumns(redundantIndexes[j].indexed_columns);
        const sameColumns =
          leftCols.length === rightCols.length &&
          leftCols.every((value, index) => value === rightCols[index]);

        const prefixOverlap =
          (leftCols.length < rightCols.length && leftCols.every((value, index) => value === rightCols[index])) ||
          (rightCols.length < leftCols.length && rightCols.every((value, index) => value === leftCols[index]));

        if (sameColumns || prefixOverlap) {
          duplicateRows.push({
            left_index: redundantIndexes[i].index_name,
            right_index: redundantIndexes[j].index_name,
            overlap_type: sameColumns ? "same-columns" : "prefix-overlap",
            left_columns: redundantIndexes[i].indexed_columns,
            right_columns: redundantIndexes[j].indexed_columns,
          });
        }
      }
    }
    if (!duplicateRows.length) {
      console.log("(no obvious duplicate or prefix-overlap indexes)");
    } else {
      console.table(formatRows(duplicateRows));
    }

    const recommendations = buildRecommendations(indexRows);
    console.log("\n=== Safe Review Recommendations ===");
    console.table(formatRows(recommendations));

    await client.query("COMMIT");

    console.log("\n=== Summary ===");
    console.log(`Indexes found: ${indexRows.length}`);
    console.log("This report is read-only and does not remove or alter any index.");
    console.log("Use it to decide whether a follow-up cleanup plan is warranted.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures after connection issues.
    }
    console.error("Failed to analyze poll_logs indexes.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
