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
  application_name: "cleanup-missouri-dmv-noise",
});

const RSS_URL = "https://dor.mo.gov/news/rss";
const RELEVANCE_PATTERN = [
  "commercial driver license",
  "driver license(s)?",
  "driver['’]s license",
  "nondriver id card",
  "real id",
  "temporary driver license",
].join("|");

function buildTitleCard(title) {
  const cleanTitle = String(title || "Missouri DMV update")
    .replace(/[^\p{L}\p{N}\s.,:;!?&+-]/gu, "")
    .slice(0, 88)
    .trim() || "Missouri DMV update";
  return `https://placehold.co/800x450/17365d/ffffff.png?text=${encodeURIComponent(`Missouri DMV\n${cleanTitle}`)}`;
}

function candidatesCte() {
  return `
    WITH missouri_articles AS (
      SELECT
        a.id,
        a.title,
        a.thumbnail,
        a."pubDate",
        LOWER(CONCAT_WS(' ', a.title, a.summary, a."contentSnippet")) AS article_text
      FROM articles a
      INNER JOIN feeds f ON f.id = a."feedId"
      WHERE f."rssUrl" = $1
    )
  `;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
  await client.connect();

  const result = await client.query(
    `${candidatesCte()}
     SELECT id, title, thumbnail, "pubDate", article_text ~ $2 AS keep
     FROM missouri_articles
     ORDER BY "pubDate" DESC`,
    [RSS_URL, RELEVANCE_PATTERN]
  );
  const kept = result.rows.filter((row) => row.keep);
  const rejected = result.rows.filter((row) => !row.keep);

  console.log({
    totalArticles: result.rows.length,
    retainedIdentityArticles: kept.length,
    rejectedNoiseArticles: rejected.length,
  });
  console.log("Retained Missouri identity-document items:");
  console.table(kept.map(({ title, pubDate }) => ({ title, pubDate })));

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete Missouri noise and create unique title cards.");
    return;
  }

  await client.query("BEGIN");
  try {
    const deleted = await client.query(
      `${candidatesCte()}
       DELETE FROM articles
       WHERE id IN (SELECT id FROM missouri_articles WHERE article_text !~ $2)`,
      [RSS_URL, RELEVANCE_PATTERN]
    );

    let updatedThumbnails = 0;
    for (const article of kept) {
      const update = await client.query(
        `UPDATE articles
         SET thumbnail = $1, "fetchStatus" = 'enriched', "updatedAt" = NOW()
         WHERE id = $2 AND thumbnail IS DISTINCT FROM $1`,
        [buildTitleCard(article.title), article.id]
      );
      updatedThumbnails += update.rowCount;
    }

    await client.query("COMMIT");
    console.log({ deletedNoiseArticles: deleted.rowCount, updatedThumbnails });
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
