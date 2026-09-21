import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const apply = process.argv.slice(2).includes("--apply");
const client = new Client({
  connectionString: process.env.DATABASE_URL || "",
  application_name: "cleanup-dmv-source-noise",
});

const HAWAII_RSS_URL = "https://hidot.hawaii.gov/feed/";
const NEBRASKA_RSS_URL = "https://dmv.nebraska.gov/rss/news";
const HAWAII_GENERIC_THUMBNAIL =
  "https://hidot.hawaii.gov/wp-content/themes/hic_state_template_parent/images/design/footer/footer-seal.png";
const NEBRASKA_GENERIC_THUMBNAIL =
  "https://dmv.nebraska.gov/sites/all/themes/DMV/img/search.png";

const NEBRASKA_RELEVANCE_PATTERN = [
  "driver license and id card",
  "driver license and state id",
  "driver license services",
  "driver['’]s license and id",
  "issuance of credentials",
  "real id",
  "temporary driver license",
  "tracks driver['’]s license and id",
].join("|");

function cleanupCandidatesCte() {
  return `
    WITH source_articles AS (
      SELECT
        a.id,
        a.title,
        a.link,
        a.thumbnail,
        a."pubDate",
        f.id AS feed_id,
        f.name AS feed_name,
        f."rssUrl" AS feed_url,
        LOWER(CONCAT_WS(' ', a.title, a.summary, a."contentSnippet")) AS article_text
      FROM articles a
      INNER JOIN feeds f ON f.id = a."feedId"
      WHERE f."rssUrl" IN ($1, $2)
    ), cleanup_candidates AS (
      SELECT *,
        CASE
          WHEN feed_url = $1 THEN 'hawaii-non-dmv-feed'
          WHEN feed_url = $2 AND article_text !~ $3 THEN 'nebraska-non-identity-item'
          ELSE 'keep'
        END AS cleanup_reason
      FROM source_articles
    )
  `;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

  await client.connect();
  const values = [HAWAII_RSS_URL, NEBRASKA_RSS_URL, NEBRASKA_RELEVANCE_PATTERN];
  const overview = await client.query(
    `${cleanupCandidatesCte()}
     SELECT cleanup_reason, COUNT(*)::int AS article_count
     FROM cleanup_candidates
     GROUP BY cleanup_reason
     ORDER BY cleanup_reason`,
    values
  );
  console.table(overview.rows);

  const samples = await client.query(
    `${cleanupCandidatesCte()}
     SELECT feed_name, cleanup_reason, title, "pubDate"
     FROM cleanup_candidates
     WHERE cleanup_reason <> 'keep'
     ORDER BY "pubDate" DESC
     LIMIT 30`,
    values
  );
  console.table(samples.rows);

  const retainedNebraska = await client.query(
    `${cleanupCandidatesCte()}
     SELECT title, "pubDate"
     FROM cleanup_candidates
     WHERE cleanup_reason = 'keep' AND feed_url = $2
     ORDER BY "pubDate" DESC`,
    values
  );
  console.log("Retained Nebraska identity-document items:");
  console.table(retainedNebraska.rows);

  const genericThumbnailCount = await client.query(
    `SELECT COUNT(*)::int AS article_count
     FROM articles a
     INNER JOIN feeds f ON f.id = a."feedId"
     WHERE (f."rssUrl" = $1 AND a.thumbnail = $2)
        OR (f."rssUrl" = $3 AND a.thumbnail = $4)`,
    [HAWAII_RSS_URL, HAWAII_GENERIC_THUMBNAIL, NEBRASKA_RSS_URL, NEBRASKA_GENERIC_THUMBNAIL]
  );
  console.log("Generic thumbnails to clear:", genericThumbnailCount.rows[0]?.article_count || 0);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to deactivate Hawaii, delete noise, and clear generic thumbnails.");
    return;
  }

  await client.query("BEGIN");
  try {
    const deactivated = await client.query(
      `UPDATE feeds SET "isActive" = false, "updatedAt" = NOW() WHERE "rssUrl" = $1`,
      [HAWAII_RSS_URL]
    );
    const deleted = await client.query(
      `${cleanupCandidatesCte()}
       DELETE FROM articles
       WHERE id IN (SELECT id FROM cleanup_candidates WHERE cleanup_reason <> 'keep')`,
      values
    );
    const cleared = await client.query(
      `UPDATE articles a
       SET thumbnail = NULL, "fetchStatus" = 'pending', "updatedAt" = NOW()
       FROM feeds f
       WHERE f.id = a."feedId"
         AND ((f."rssUrl" = $1 AND a.thumbnail = $2)
           OR (f."rssUrl" = $3 AND a.thumbnail = $4))`,
      [HAWAII_RSS_URL, HAWAII_GENERIC_THUMBNAIL, NEBRASKA_RSS_URL, NEBRASKA_GENERIC_THUMBNAIL]
    );
    await client.query("COMMIT");
    console.log({
      deactivatedFeeds: deactivated.rowCount,
      deletedNoiseArticles: deleted.rowCount,
      clearedGenericThumbnails: cleared.rowCount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
