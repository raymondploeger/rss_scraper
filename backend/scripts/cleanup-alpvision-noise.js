import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { getSourceRelevanceAssessment } from "../src/services/sourceRelevanceService.js";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const databaseUrl = process.env.DATABASE_URL || "";
const apply = process.argv.slice(2).includes("--apply");
const source = {
  name: "AlpVision News",
  rssUrl: "https://alpvision.com/news/",
};

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-alpvision-noise",
});

async function listArticles() {
  const result = await client.query(
    `
      SELECT
        a.id,
        a.title,
        a.link,
        a."canonicalLink",
        a."contentSnippet",
        a.summary,
        a."pubDate",
        a."createdAt",
        f.name AS feed_name,
        f."rssUrl" AS feed_url
      FROM articles a
      INNER JOIN feeds f ON f.id = a."feedId"
      WHERE f.name = $1 OR f."rssUrl" = $2
      ORDER BY a."createdAt" DESC, a."pubDate" DESC
    `,
    [source.name, source.rssUrl]
  );

  return result.rows;
}

function getRejectedArticles(rows) {
  return rows
    .map((row) => {
      const assessment = getSourceRelevanceAssessment(
        { name: row.feed_name, rssUrl: row.feed_url },
        {
          title: row.title,
          link: row.link,
          contentSnippet: row.contentSnippet || row.summary || "",
        }
      );

      return {
        id: row.id,
        title: row.title || "",
        url: row.canonicalLink || row.link || "",
        reason: assessment.excludedTerms.length
          ? `excluded: ${assessment.excludedTerms.join(", ")}`
          : assessment.reason,
        accepted: assessment.accepted,
      };
    })
    .filter((article) => !article.accepted);
}

function printArticles(articles) {
  console.log(`AlpVision articles failing the current relevance rule: ${articles.length}`);
  console.table(articles.map(({ title, url, reason }) => ({ title, url, reason })));
}

async function deleteArticles(articles) {
  if (!articles.length) {
    return;
  }

  await client.query("BEGIN");
  try {
    const result = await client.query("DELETE FROM articles WHERE id = ANY($1::text[])", [
      articles.map((article) => article.id),
    ]);
    await client.query("COMMIT");
    console.log(`Deleted ${result.rowCount || 0} AlpVision articles.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  await client.connect();
  try {
    const rejectedArticles = getRejectedArticles(await listArticles());
    printArticles(rejectedArticles);

    if (!apply) {
      console.log("Dry run only. Re-run with --apply to delete these rejected articles.");
      return;
    }

    await deleteArticles(rejectedArticles);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("AlpVision cleanup failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
