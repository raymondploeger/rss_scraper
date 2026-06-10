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

const TARGET_FEEDS = [
  {
    name: "Bundesdruckerei Press Releases",
    rssUrl: "https://www.bundesdruckerei.de/en/newsroom/press-releases",
  },
  {
    name: "G+D Press Releases",
    rssUrl: "https://www.gi-de.com/en/about-us/press/press-releases",
  },
  {
    name: "KURZ Press Releases",
    rssUrl: "https://www.kurz-world.com/en/newsroom/press/",
  },
];

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-vendor-noise",
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

function buildFeedQueryValues() {
  return [
    TARGET_FEEDS.map((feed) => feed.name),
    TARGET_FEEDS.map((feed) => feed.rssUrl),
  ];
}

function getTargetFeedName(feedName, feedUrl) {
  const normalizedName = String(feedName || "").trim().toLowerCase();
  const normalizedUrl = String(feedUrl || "").trim().toLowerCase();
  const target = TARGET_FEEDS.find((feed) =>
    feed.name.toLowerCase() === normalizedName ||
    feed.rssUrl.toLowerCase() === normalizedUrl
  );

  return target?.name || feedName || "";
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
        f."rssUrl" AS feed_url,
        f."sourceType" AS feed_source_type
      FROM articles a
      INNER JOIN feeds f
        ON f.id = a."feedId"
      WHERE
        f.name = ANY($1::text[])
        OR f."rssUrl" = ANY($2::text[])
      ORDER BY
        f.name ASC,
        a."createdAt" DESC,
        a."pubDate" DESC
    `,
    buildFeedQueryValues()
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
        feedName: getTargetFeedName(row.feed_name || row.feedName, row.feed_url),
        title: row.title || "",
        url: row.canonicalLink || row.link || "",
        publishedAt: row.pubDate,
        importedAt: row.createdAt,
        matchedExclusions: assessment.excludedTerms,
        matchedIncludes: assessment.includedTerms,
        reason: assessment.reason,
        accepted: assessment.accepted,
      };
    })
    .filter((row) => !row.accepted);
}

function printSummary(candidates = []) {
  const countsByFeed = candidates.reduce((counts, candidate) => {
    counts.set(candidate.feedName, (counts.get(candidate.feedName) || 0) + 1);
    return counts;
  }, new Map());

  console.log("\n=== Vendor Noise Cleanup Summary ===");
  console.table(
    formatRows(
      TARGET_FEEDS.map((feed) => ({
        feed_name: feed.name,
        matching_articles: countsByFeed.get(feed.name) || 0,
      }))
    )
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
        feed_name: candidate.feedName,
        title: candidate.title,
        url: candidate.url,
        matched_exclusion_reason: candidate.matchedExclusions.length
          ? candidate.matchedExclusions.join(", ")
          : candidate.reason,
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
  console.warn("This will permanently delete persisted articles that fail the current vendor source relevance filters.");
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

  try {
    await client.connect();

    const rows = await fetchTargetArticles();
    const candidates = getCleanupCandidates(rows);

    printSummary(candidates);
    printCandidates(candidates);

    console.log("\n=== Execution Mode ===");
    if (!apply) {
      console.log("Dry run only. No rows were deleted.");
      console.log("Run with --apply to delete matching persisted vendor-noise articles.");
      return;
    }

    await deleteCandidates(candidates);
  } catch (error) {
    console.error("Failed to run vendor noise cleanup.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
