import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { getSourceRelevanceAssessment } from "../src/services/sourceRelevanceService.js";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, "../.env");

dotenv.config({ path: envFilePath });

const databaseUrl = process.env.DATABASE_URL || "";
const apply = process.argv.slice(2).includes("--apply");

const TARGET = {
  feedName: "Bundesdruckerei Press Releases",
  title: 'Die Bundesdruckerei-Gruppe | Sicherheitslösungen "Made in Germany"',
  url: "https://www.bundesdruckerei.de/",
  sourceUrl: "https://www.bundesdruckerei.de/en/newsroom/press-releases",
};

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-bundesdruckerei-homepage",
});

function formatValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value == null ? "" : value;
}

function formatRows(rows = []) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, formatValue(value)])
    )
  );
}

async function fetchTargetRows() {
  const result = await client.query(
    `
      SELECT
        a.id,
        a.title,
        a.link,
        a."canonicalLink",
        a."feedName",
        a."feedId",
        a."createdAt",
        a."pubDate",
        a."contentSnippet",
        a.summary,
        f."rssUrl" AS feed_url,
        pl.id AS poll_log_id
      FROM articles a
      LEFT JOIN feeds f
        ON f.id = a."feedId"
      LEFT JOIN poll_logs pl
        ON pl."feedId" = a."feedId"
        AND pl."startedAt" <= a."createdAt"
        AND pl."finishedAt" >= a."createdAt"
      WHERE
        a.title = $1
        AND a.link = $2
        AND a."feedName" = $3
      ORDER BY
        a."createdAt" ASC,
        pl."startedAt" DESC
    `,
    [TARGET.title, TARGET.url, TARGET.feedName]
  );

  return result.rows;
}

function assessRow(row) {
  const assessment = getSourceRelevanceAssessment(
    {
      name: row.feedName || TARGET.feedName,
      rssUrl: row.feed_url || TARGET.sourceUrl,
    },
    {
      title: row.title,
      link: row.link,
      contentSnippet: row.contentSnippet || row.summary || "",
    }
  );

  return {
    id: row.id,
    title: row.title,
    url: row.link,
    canonical_url: row.canonicalLink,
    feed_name: row.feedName,
    inserted_at: row.createdAt,
    published_at: row.pubDate,
    poll_log_id: row.poll_log_id,
    source_relevance_accepted: assessment.accepted,
    source_relevance_reason: assessment.reason,
    included_terms: (assessment.includedTerms || []).join(", "),
    excluded_terms: (assessment.excludedTerms || []).join(", "),
  };
}

function printDryRun(rows = []) {
  console.log("=== Bundesdruckerei Homepage Cleanup Dry Run ===");
  console.log(`Apply mode: ${apply ? "YES" : "NO"}`);
  console.log(`Target feed: ${TARGET.feedName}`);
  console.log(`Target title: ${TARGET.title}`);
  console.log(`Target URL: ${TARGET.url}`);
  console.log(`Matched rows: ${rows.length}`);
  console.log(`Rows that would be deleted: ${rows.length}`);

  if (!rows.length) {
    console.log("\nNo rows matched the exact homepage target.");
    return;
  }

  console.log("\n=== Matched Rows ===");
  console.table(formatRows(rows.map(assessRow)));
}

async function deleteRows(rows = []) {
  if (!rows.length) {
    console.log("\nNo matching rows to delete.");
    return;
  }

  console.warn("\nWARNING: --apply mode is enabled.");
  console.warn("This will permanently delete only the exact Bundesdruckerei homepage article.");
  console.warn("Match constraints: exact title, exact URL, exact feed name.");
  console.warn(`Rows selected for deletion: ${rows.length}`);

  await client.query("BEGIN");
  try {
    const result = await client.query(
      `
        DELETE FROM articles
        WHERE
          title = $1
          AND link = $2
          AND "feedName" = $3
      `,
      [TARGET.title, TARGET.url, TARGET.feedName]
    );
    await client.query("COMMIT");
    console.log("\n=== Cleanup Result ===");
    console.table(formatRows([{ deleted_rows: Number(result.rowCount || 0) }]));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL.");
    console.error("Set DATABASE_URL in the environment or add it to backend/.env before running this script.");
    process.exit(1);
  }

  await client.connect();
  try {
    const rows = await fetchTargetRows();
    printDryRun(rows);

    if (apply) {
      await deleteRows(rows);
    } else {
      console.log("\nDry-run only. Re-run with --apply to delete the matched row.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to clean up Bundesdruckerei homepage article.");
  console.error(error);
  process.exit(1);
});
