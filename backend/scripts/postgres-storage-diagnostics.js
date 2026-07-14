import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const envFilePath = path.resolve(backendDir, ".env");
const prismaSchemaPath = path.resolve(backendDir, "prisma/schema.prisma");
const reportPath = path.resolve(backendDir, "data/source-analysis/postgres-storage-diagnostics.txt");

dotenv.config({ path: envFilePath });

const databaseUrl = process.env.DATABASE_URL || "";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL.");
  console.error("Set DATABASE_URL in the environment or add it to backend/.env before running this script.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  application_name: "postgres-storage-diagnostics",
});

const IMPORTANT_MODEL_NAMES = ["Article", "Feed", "PollLog", "Topic", "Signal"];
const ARTICLE_DATE_PRIORITY = ["pubDate", "publishedAt", "createdAt", "updatedAt"];
const POLL_LOG_DATE_PRIORITY = ["startedAt", "finishedAt", "createdAt", "updatedAt"];

function redactSecrets(value) {
  return String(value || "")
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgres://[redacted]@")
    .replace(/DATABASE_URL=([^\s]+)/gi, "DATABASE_URL=[redacted]");
}

function toBigInt(value) {
  if (value == null || value === "") {
    return 0n;
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }
  return BigInt(String(value));
}

function toNumber(value) {
  if (value == null || value === "") {
    return 0;
  }
  return Number(value);
}

function formatBytes(value) {
  const bytes = Number(toBigInt(value));
  if (!Number.isFinite(bytes)) {
    return "(unknown)";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function formatPercent(part, total) {
  const denominator = Number(toBigInt(total));
  if (!denominator) {
    return "0.00%";
  }
  return `${((Number(toBigInt(part)) / denominator) * 100).toFixed(2)}%`;
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function tableIdentifier(table) {
  return `${quoteIdent(table.schemaName)}.${quoteIdent(table.tableName)}`;
}

function normalizeForComparison(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIndexColumns(indexColumns = "") {
  return String(indexColumns || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function parsePrismaModels(schemaText) {
  const models = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match;

  while ((match = modelRegex.exec(schemaText)) !== null) {
    const [, modelName, block] = match;
    const tableMap = block.match(/@@map\("([^"]+)"\)/);
    const dateFields = [];

    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) {
        continue;
      }
      const fieldMatch = trimmed.match(/^(\w+)\s+DateTime\b/);
      if (fieldMatch) {
        dateFields.push(fieldMatch[1]);
      }
    }

    models.push({
      modelName,
      tableName: tableMap?.[1] || modelName,
      dateFields,
    });
  }

  return models;
}

function renderRows(rows, columns) {
  if (!rows.length) {
    return "(none)";
  }

  const widths = columns.map((column) => {
    const values = rows.map((row) => String(row[column.key] ?? ""));
    return Math.min(
      column.maxWidth || 48,
      Math.max(column.label.length, ...values.map((value) => value.length))
    );
  });

  const renderCell = (value, width) => {
    const text = String(value ?? "");
    if (text.length <= width) {
      return text.padEnd(width, " ");
    }
    return `${text.slice(0, Math.max(0, width - 1))}…`;
  };

  const header = columns.map((column, index) => renderCell(column.label, widths[index])).join("  ");
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const body = rows
    .map((row) => columns.map((column, index) => renderCell(row[column.key], widths[index])).join("  "))
    .join("\n");

  return `${header}\n${divider}\n${body}`;
}

async function safeQuery(label, sql, params = []) {
  try {
    const result = await client.query(sql, params);
    return { ok: true, rows: result.rows };
  } catch (error) {
    return {
      ok: false,
      rows: [],
      error: `${label} unavailable: ${redactSecrets(error instanceof Error ? error.message : error)}`,
    };
  }
}

async function findActualTables(prismaModels) {
  const result = await safeQuery(
    "application table discovery",
    `
      SELECT
        table_schema AS "schemaName",
        table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_schema NOT LIKE 'pg_toast%'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_schema, table_name
    `
  );

  if (!result.ok) {
    return { tables: [], error: result.error };
  }

  const modelByTable = new Map(prismaModels.map((model) => [model.tableName, model]));
  const prismaTableNames = new Set(prismaModels.map((model) => model.tableName));
  const matchedTables = result.rows
    .filter((row) => prismaTableNames.has(row.tableName))
    .map((row) => ({
      schemaName: row.schemaName,
      tableName: row.tableName,
      modelName: modelByTable.get(row.tableName)?.modelName || "",
    }));

  const tables = matchedTables.length
    ? matchedTables
    : result.rows.map((row) => ({
        schemaName: row.schemaName,
        tableName: row.tableName,
        modelName: modelByTable.get(row.tableName)?.modelName || "",
      }));

  return { tables, error: null };
}

async function getExactRowCount(table) {
  const result = await safeQuery(
    `row count for ${table.tableName}`,
    `SELECT COUNT(*)::bigint AS "rowCount" FROM ${tableIdentifier(table)}`
  );
  return result.ok ? result.rows[0]?.rowCount || "0" : null;
}

async function findDateColumn(table, priority) {
  const result = await safeQuery(
    `date column discovery for ${table.tableName}`,
    `
      SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND data_type IN (
          'timestamp without time zone',
          'timestamp with time zone',
          'date'
        )
    `,
    [table.schemaName, table.tableName]
  );

  if (!result.ok) {
    return null;
  }

  const columns = result.rows.map((row) => row.columnName);
  for (const preferred of priority) {
    if (columns.includes(preferred)) {
      return preferred;
    }
  }
  return columns[0] || null;
}

async function buildAgeAnalysis(table, datePriority, windows) {
  const dateColumn = await findDateColumn(table, datePriority);
  if (!dateColumn) {
    return {
      ok: false,
      message: `${table.modelName || table.tableName} age analysis unavailable: no timestamp/date column found.`,
    };
  }

  const countExpressions = windows
    .map(
      (days) =>
        `COUNT(*) FILTER (WHERE ${quoteIdent(dateColumn)} < NOW() - INTERVAL '${Number(days)} days')::bigint AS "olderThan${days}Days"`
    )
    .join(",\n        ");

  const result = await safeQuery(
    `${table.tableName} age analysis`,
    `
      SELECT
        COUNT(*)::bigint AS "totalRows",
        ${countExpressions},
        MIN(${quoteIdent(dateColumn)}) AS "oldestDate",
        MAX(${quoteIdent(dateColumn)}) AS "newestDate"
      FROM ${tableIdentifier(table)}
    `
  );

  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  return {
    ok: true,
    dateColumn,
    row: result.rows[0] || {},
  };
}

function analyzeIndexNotes(indexRows) {
  const groupedByTable = new Map();
  for (const row of indexRows) {
    const key = `${row.schemaName}.${row.tableName}`;
    if (!groupedByTable.has(key)) {
      groupedByTable.set(key, []);
    }
    groupedByTable.get(key).push({
      ...row,
      normalizedColumns: normalizeIndexColumns(row.indexedColumns),
      normalizedPredicate: normalizeForComparison(row.predicate),
    });
  }

  const duplicateIndexNames = new Map();
  const prefixIndexNames = new Map();

  for (const rows of groupedByTable.values()) {
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const left = rows[i];
        const right = rows[j];
        if (!left.normalizedColumns.length || !right.normalizedColumns.length) {
          continue;
        }
        if (left.normalizedPredicate !== right.normalizedPredicate) {
          continue;
        }
        if (Boolean(left.isUnique) !== Boolean(right.isUnique)) {
          continue;
        }

        const sameColumns =
          left.normalizedColumns.length === right.normalizedColumns.length &&
          left.normalizedColumns.every((value, index) => value === right.normalizedColumns[index]);
        const leftPrefix =
          left.normalizedColumns.length < right.normalizedColumns.length &&
          left.normalizedColumns.every((value, index) => value === right.normalizedColumns[index]);
        const rightPrefix =
          right.normalizedColumns.length < left.normalizedColumns.length &&
          right.normalizedColumns.every((value, index) => value === left.normalizedColumns[index]);

        if (sameColumns) {
          duplicateIndexNames.set(left.indexName, `possibly duplicated by ${right.indexName}`);
          duplicateIndexNames.set(right.indexName, `possibly duplicated by ${left.indexName}`);
        } else if (leftPrefix) {
          prefixIndexNames.set(left.indexName, `prefix of ${right.indexName}`);
        } else if (rightPrefix) {
          prefixIndexNames.set(right.indexName, `prefix of ${left.indexName}`);
        }
      }
    }
  }

  return indexRows.map((row) => {
    const notes = [];
    if (duplicateIndexNames.has(row.indexName)) {
      notes.push(duplicateIndexNames.get(row.indexName));
    }
    if (prefixIndexNames.has(row.indexName)) {
      notes.push(prefixIndexNames.get(row.indexName));
    }
    if (!row.isPrimary && toNumber(row.idxScan) === 0) {
      notes.push("potentially unused since stats reset; review query plans before action");
    }
    if (!notes.length) {
      notes.push("no obvious duplication/unused signal");
    }
    return {
      ...row,
      reviewSignal: notes.join("; "),
    };
  });
}

function appendSection(lines, title, bodyLines = []) {
  lines.push("");
  lines.push(title);
  lines.push("=".repeat(title.length));
  lines.push(...bodyLines);
}

async function main() {
  const lines = [];
  let shouldRollback = false;

  try {
    const schemaText = await fs.readFile(prismaSchemaPath, "utf8");
    const prismaModels = parsePrismaModels(schemaText);
    const prismaModelNames = prismaModels.map((model) => model.modelName).join(", ") || "(none found)";

    await client.connect();
    await client.query("BEGIN READ ONLY");
    shouldRollback = true;

    const { tables: appTables, error: tableDiscoveryError } = await findActualTables(prismaModels);

    const databaseSummary = await safeQuery(
      "database summary",
      `
        SELECT
          current_database() AS "databaseName",
          pg_database_size(current_database()) AS "databaseSizeBytes",
          version() AS "postgresVersion"
      `
    );

    appendSection(lines, "DATABASE SUMMARY", [
      databaseSummary.ok
        ? `Database: ${databaseSummary.rows[0]?.databaseName || "(unknown)"}`
        : databaseSummary.error,
      databaseSummary.ok
        ? `Total database size: ${formatBytes(databaseSummary.rows[0]?.databaseSizeBytes)} (${databaseSummary.rows[0]?.databaseSizeBytes || 0} bytes)`
        : "",
      databaseSummary.ok ? `PostgreSQL version: ${databaseSummary.rows[0]?.postgresVersion || "(unavailable)"}` : "",
      `Prisma schema inspected: ${path.relative(process.cwd(), prismaSchemaPath)}`,
      `Prisma models found: ${prismaModelNames}`,
      "Safety: read-only PostgreSQL transaction; no DELETE, DROP, TRUNCATE, VACUUM FULL, REINDEX, schema changes, or production-data writes.",
    ].filter(Boolean));

    if (tableDiscoveryError) {
      appendSection(lines, "TABLE DISCOVERY", [tableDiscoveryError]);
    }

    const tableSizesResult = await safeQuery(
      "table sizes",
      `
        SELECT
          n.nspname AS "schemaName",
          c.relname AS "tableName",
          COALESCE(s.n_live_tup, c.reltuples)::bigint AS "estimatedRowCount",
          pg_relation_size(c.oid) AS "tableSizeBytes",
          pg_indexes_size(c.oid) AS "indexSizeBytes",
          pg_total_relation_size(c.oid) AS "totalSizeBytes",
          COALESCE(s.n_live_tup, 0)::bigint AS "liveTuples",
          COALESCE(s.n_dead_tup, 0)::bigint AS "deadTuples",
          s.last_vacuum AS "lastVacuum",
          s.last_autovacuum AS "lastAutovacuum",
          s.last_analyze AS "lastAnalyze",
          s.last_autoanalyze AS "lastAutoanalyze"
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE c.relkind IN ('r', 'p')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
          AND c.relname <> '_prisma_migrations'
        ORDER BY pg_total_relation_size(c.oid) DESC, c.relname ASC
      `
    );

    const appTableKeySet = new Set(appTables.map((table) => `${table.schemaName}.${table.tableName}`));
    const modelByTable = new Map(prismaModels.map((model) => [model.tableName, model.modelName]));
    const tableRows = tableSizesResult.ok
      ? tableSizesResult.rows.filter((row) => appTableKeySet.has(`${row.schemaName}.${row.tableName}`))
      : [];
    const totalAppStorage = tableRows.reduce((sum, row) => sum + toBigInt(row.totalSizeBytes), 0n);

    appendSection(
      lines,
      "TABLE SIZES",
      tableSizesResult.ok
        ? [
            renderRows(
              tableRows.map((row) => ({
                schema: row.schemaName,
                table: row.tableName,
                model: modelByTable.get(row.tableName) || "",
                estimatedRows: row.estimatedRowCount,
                tableSize: formatBytes(row.tableSizeBytes),
                indexSize: formatBytes(row.indexSizeBytes),
                totalSize: formatBytes(row.totalSizeBytes),
                percent: formatPercent(row.totalSizeBytes, totalAppStorage),
              })),
              [
                { key: "schema", label: "Schema", maxWidth: 12 },
                { key: "table", label: "Table", maxWidth: 24 },
                { key: "model", label: "Prisma Model", maxWidth: 18 },
                { key: "estimatedRows", label: "Est. Rows", maxWidth: 14 },
                { key: "tableSize", label: "Data Size", maxWidth: 14 },
                { key: "indexSize", label: "Index Size", maxWidth: 14 },
                { key: "totalSize", label: "Total Size", maxWidth: 14 },
                { key: "percent", label: "% App Storage", maxWidth: 14 },
              ]
            ),
            `Total application-table storage: ${formatBytes(totalAppStorage)} (${totalAppStorage.toString()} bytes)`,
          ]
        : [tableSizesResult.error]
    );

    const indexResult = await safeQuery(
      "index sizes",
      `
        SELECT
          ns.nspname AS "schemaName",
          tbl.relname AS "tableName",
          idx.relname AS "indexName",
          ind.indisunique AS "isUnique",
          ind.indisprimary AS "isPrimary",
          pg_get_indexdef(ind.indexrelid) AS "indexDefinition",
          ARRAY_TO_STRING(
            ARRAY(
              SELECT pg_get_indexdef(ind.indexrelid, k + 1, TRUE)
              FROM generate_subscripts(ind.indkey, 1) AS k
              ORDER BY k
            ),
            ', '
          ) AS "indexedColumns",
          pg_get_expr(ind.indpred, ind.indrelid) AS "predicate",
          pg_relation_size(ind.indexrelid) AS "indexSizeBytes",
          COALESCE(stat.idx_scan, 0) AS "idxScan",
          COALESCE(stat.idx_tup_read, 0) AS "idxTupRead",
          COALESCE(stat.idx_tup_fetch, 0) AS "idxTupFetch"
        FROM pg_index ind
        JOIN pg_class idx ON idx.oid = ind.indexrelid
        JOIN pg_class tbl ON tbl.oid = ind.indrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        LEFT JOIN pg_stat_user_indexes stat ON stat.indexrelid = ind.indexrelid
        WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
          AND ns.nspname NOT LIKE 'pg_toast%'
          AND tbl.relname <> '_prisma_migrations'
        ORDER BY pg_relation_size(ind.indexrelid) DESC, idx.relname ASC
        LIMIT 30
      `
    );

    const analyzedIndexes = indexResult.ok
      ? analyzeIndexNotes(indexResult.rows.filter((row) => appTableKeySet.has(`${row.schemaName}.${row.tableName}`)))
      : [];

    appendSection(
      lines,
      "INDEX SIZES",
      indexResult.ok
        ? [
            "Review signals are informational only. Do not drop indexes solely from pg_stat usage counts.",
            renderRows(
              analyzedIndexes.map((row) => ({
                table: row.tableName,
                index: row.indexName,
                size: formatBytes(row.indexSizeBytes),
                idxScan: row.idxScan,
                unique: row.isUnique ? "yes" : "no",
                primary: row.isPrimary ? "yes" : "no",
                reviewSignal: row.reviewSignal,
              })),
              [
                { key: "table", label: "Table", maxWidth: 24 },
                { key: "index", label: "Index", maxWidth: 38 },
                { key: "size", label: "Size", maxWidth: 12 },
                { key: "idxScan", label: "idx_scan", maxWidth: 12 },
                { key: "unique", label: "Unique", maxWidth: 8 },
                { key: "primary", label: "Primary", maxWidth: 8 },
                { key: "reviewSignal", label: "Duplicate / Potentially Unused Signal", maxWidth: 72 },
              ]
            ),
          ]
        : [indexResult.error]
    );

    const exactCounts = [];
    for (const table of appTables) {
      const exactRowCount = await getExactRowCount(table);
      const sizeRow = tableRows.find(
        (row) => row.schemaName === table.schemaName && row.tableName === table.tableName
      );
      exactCounts.push({
        model: table.modelName || "(unmapped)",
        schema: table.schemaName,
        table: table.tableName,
        rowCount: exactRowCount ?? "(unavailable)",
        totalSize: sizeRow ? formatBytes(sizeRow.totalSizeBytes) : "(unavailable)",
      });
    }

    const missingImportantModels = IMPORTANT_MODEL_NAMES.filter(
      (modelName) => !prismaModels.some((model) => model.modelName === modelName)
    );

    appendSection(lines, "RSS SCRAPER COUNTS", [
      renderRows(exactCounts, [
        { key: "model", label: "Prisma Model", maxWidth: 18 },
        { key: "schema", label: "Schema", maxWidth: 12 },
        { key: "table", label: "Table", maxWidth: 24 },
        { key: "rowCount", label: "Exact Rows", maxWidth: 14 },
        { key: "totalSize", label: "Total Size", maxWidth: 14 },
      ]),
      missingImportantModels.length
        ? `Not present in current Prisma schema: ${missingImportantModels.join(", ")}`
        : "All highlighted RSS scraper models are present in the Prisma schema.",
    ]);

    const articleTable = appTables.find((table) => table.modelName === "Article");
    if (articleTable) {
      const articleAnalysis = await buildAgeAnalysis(articleTable, ARTICLE_DATE_PRIORITY, [30, 90, 180, 365]);
      appendSection(
        lines,
        "ARTICLE ANALYSIS",
        articleAnalysis.ok
          ? [
              `Date column used: ${articleAnalysis.dateColumn}`,
              `Total articles: ${articleAnalysis.row.totalRows || 0}`,
              `Articles older than 30 days: ${articleAnalysis.row.olderThan30Days || 0}`,
              `Articles older than 90 days: ${articleAnalysis.row.olderThan90Days || 0}`,
              `Articles older than 180 days: ${articleAnalysis.row.olderThan180Days || 0}`,
              `Articles older than 365 days: ${articleAnalysis.row.olderThan365Days || 0}`,
              `Oldest article date: ${formatDate(articleAnalysis.row.oldestDate) || "(none)"}`,
              `Newest article date: ${formatDate(articleAnalysis.row.newestDate) || "(none)"}`,
            ]
          : [articleAnalysis.message]
      );
    } else {
      appendSection(lines, "ARTICLE ANALYSIS", ["Article model/table not present in the current Prisma schema/database."]);
    }

    const pollLogTable = appTables.find((table) => table.modelName === "PollLog");
    if (pollLogTable) {
      const pollLogAnalysis = await buildAgeAnalysis(pollLogTable, POLL_LOG_DATE_PRIORITY, [7, 30, 90]);
      appendSection(
        lines,
        "POLL LOG ANALYSIS",
        pollLogAnalysis.ok
          ? [
              `Date column used: ${pollLogAnalysis.dateColumn}`,
              `Total rows: ${pollLogAnalysis.row.totalRows || 0}`,
              `Rows older than 7 days: ${pollLogAnalysis.row.olderThan7Days || 0}`,
              `Rows older than 30 days: ${pollLogAnalysis.row.olderThan30Days || 0}`,
              `Rows older than 90 days: ${pollLogAnalysis.row.olderThan90Days || 0}`,
              `Oldest log date: ${formatDate(pollLogAnalysis.row.oldestDate) || "(none)"}`,
              `Newest log date: ${formatDate(pollLogAnalysis.row.newestDate) || "(none)"}`,
            ]
          : [pollLogAnalysis.message]
      );
    } else {
      appendSection(lines, "POLL LOG ANALYSIS", ["PollLog model/table not present in the current Prisma schema/database."]);
    }

    appendSection(
      lines,
      "DEAD SPACE / MAINTENANCE SIGNALS",
      tableSizesResult.ok
        ? [
            renderRows(
              tableRows.map((row) => ({
                table: row.tableName,
                liveTuples: row.liveTuples,
                deadTuples: row.deadTuples,
                lastVacuum: formatDate(row.lastVacuum) || "",
                lastAutovacuum: formatDate(row.lastAutovacuum) || "",
                lastAnalyze: formatDate(row.lastAnalyze) || "",
                lastAutoanalyze: formatDate(row.lastAutoanalyze) || "",
              })),
              [
                { key: "table", label: "Table", maxWidth: 24 },
                { key: "liveTuples", label: "Live Tuples", maxWidth: 14 },
                { key: "deadTuples", label: "Dead Tuples", maxWidth: 14 },
                { key: "lastVacuum", label: "Last Vacuum", maxWidth: 26 },
                { key: "lastAutovacuum", label: "Last Autovacuum", maxWidth: 26 },
                { key: "lastAnalyze", label: "Last Analyze", maxWidth: 26 },
                { key: "lastAutoanalyze", label: "Last Autoanalyze", maxWidth: 26 },
              ]
            ),
          ]
        : [tableSizesResult.error]
    );

    appendSection(lines, "REPORT OUTPUT", [
      `Terminal: full report printed below.`,
      `File: ${path.relative(process.cwd(), reportPath)}`,
    ]);

    await client.query("COMMIT");
    shouldRollback = false;

    const report = `${lines.join("\n").trim()}\n`;
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report, "utf8");

    console.log(report);
    console.log(`Report written to ${reportPath}`);
  } catch (error) {
    if (shouldRollback) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback failures after connection issues.
      }
    }
    console.error("Failed to generate PostgreSQL storage diagnostics.");
    console.error(redactSecrets(error instanceof Error ? error.message : error));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
