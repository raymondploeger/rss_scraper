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

const TARGET_FEED = {
  name: "SICPA Newsroom",
  rssUrl: "https://www.sicpa.com/all-press-releases",
};

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-sicpa-quality",
});

function formatDate(value) {
  return value instanceof Date ? value.toISOString() : value || "";
}

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

async function fetchTargetArticles() {
  const result = await client.query(
    `
      SELECT
        a.id,
        a.title,
        a.link,
        a."canonicalLink",
        a."contentSnippet",
        a.summary,
        a."feedName",
        a."pubDate",
        a."createdAt",
        f.name AS feed_name,
        f."rssUrl" AS feed_url
      FROM articles a
      INNER JOIN feeds f
        ON f.id = a."feedId"
      WHERE
        f.name = $1
        OR f."rssUrl" = $2
      ORDER BY
        a."createdAt" DESC,
        a."pubDate" DESC
    `,
    [TARGET_FEED.name, TARGET_FEED.rssUrl]
  );

  return result.rows;
}

function getCleanupCandidates(rows = []) {
  return rows
    .map((row) => {
      const feed = {
        name: row.feed_name || row.feedName,
        rssUrl: row.feed_url,
      };
      const assessment = getSourceRelevanceAssessment(feed, {
        title: row.title,
        link: row.link,
        contentSnippet: row.contentSnippet || row.summary || "",
      });

      return {
        id: row.id,
        feedName: row.feed_name || row.feedName || TARGET_FEED.name,
        title: row.title || "",
        url: row.canonicalLink || row.link || "",
        publishedAt: row.pubDate,
        importedAt: row.createdAt,
        reason: assessment.reason,
        rejectedPageMatches: assessment.rejectedPageMatches || [],
        matchedExclusions: assessment.excludedTerms || [],
        matchedIncludes: assessment.includedTerms || [],
        accepted: assessment.accepted,
      };
    })
    .filter((row) => !row.accepted);
}

function getRejectionReason(candidate) {
  if (candidate.rejectedPageMatches.length) {
    return candidate.rejectedPageMatches.join(", ");
  }
  if (candidate.matchedExclusions.length) {
    return candidate.matchedExclusions.join(", ");
  }
  return candidate.reason;
}

function printSummary(candidates = []) {
  console.log("\n=== SICPA Quality Cleanup Summary ===");
  console.table(
    formatRows([
      {
        feed_name: TARGET_FEED.name,
        matching_articles: candidates.length,
      },
    ])
  );
  console.log(`Total matching articles: ${candidates.length}`);
}

function printCandidates(candidates = []) {
  console.log("\n=== Matching Articles ===");
  if (!candidates.length) {
    console.log("(no matching articles)");
    return;
  }

  console.table(
    formatRows(
      candidates.map((candidate) => ({
        title: candidate.title,
        url: candidate.url,
        rejection_reason: getRejectionReason(candidate),
        imported_at: formatDate(candidate.importedAt),
        published_at: formatDate(candidate.publishedAt),
      }))
    )
  );
}

async function deleteCandidates(candidates = []) {
  if (!candidates.length) {
    console.log("\nNo matching rows to delete.");
    return;
  }

  console.warn("\nWARNING: --apply mode is enabled.");
  console.warn("This will permanently delete persisted SICPA Newsroom articles that fail current source relevance filters.");
  console.warn("No soft-delete/archive field exists in the current Article schema.");
  console.warn(`Rows selected for deletion: ${candidates.length}`);

  await client.query("BEGIN");
  try {
    const result = await client.query(
      "DELETE FROM articles WHERE id = ANY($1::text[])",
      [candidates.map((candidate) => candidate.id)]
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

  if (!apply) {
    console.log("Dry-run mode. No rows will be deleted. Re-run with --apply to delete matching rows.");
  }

  try {
    await client.connect();
    if (!apply) {
      await client.query("BEGIN READ ONLY");
    }

    const rows = await fetchTargetArticles();
    const candidates = getCleanupCandidates(rows);

    printSummary(candidates);
    printCandidates(candidates);

    if (apply) {
      await deleteCandidates(candidates);
    } else {
      await client.query("ROLLBACK");
      console.log("\nDry-run complete. No rows were deleted.");
    }
  } catch (error) {
    if (!apply) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback errors when the connection failed before the transaction started.
      }
    }
    console.error("Failed to run SICPA quality cleanup.");
    console.error(error?.stack || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
