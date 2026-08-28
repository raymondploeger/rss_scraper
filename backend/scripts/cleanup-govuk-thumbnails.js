import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { env } from "../src/config/env.js";
import { isGoogleNewsPlaceholderImage, scrapeArticleMetadata } from "../src/services/thumbnailService.js";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, "../.env");

dotenv.config({ path: envFilePath });

const databaseUrl = process.env.DATABASE_URL || "";
const apply = process.argv.slice(2).includes("--apply");
const TARGET_FEED_NAME = "GOV.UK News and Communications";
const GOV_UK_GENERIC_THUMBNAIL =
  "https://www.gov.uk/assets/frontend/govuk-opengraph-image-4196a4d6333cf92aaf720047f56cfd91b3532d7635fc21ebcf0d5897df6b5f77.png";

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-govuk-thumbnails",
});

function isValidPublisherThumbnail(value) {
  const thumbnail = String(value || "").trim();
  return Boolean(thumbnail) && thumbnail !== env.placeholderImage && !isGoogleNewsPlaceholderImage(thumbnail);
}

async function fetchCandidates() {
  const result = await client.query(
    `
      SELECT
        a.id,
        a.title,
        a.link,
        a."canonicalLink",
        a.thumbnail,
        a.summary,
        a."contentSnippet",
        a."pubDate",
        a."updatedAt",
        f.name AS feed_name
      FROM articles a
      INNER JOIN feeds f
        ON f.id = a."feedId"
      WHERE
        f.name = $1
        AND (
          a.thumbnail IS NULL
          OR a.thumbnail = ''
          OR a.thumbnail = $2
          OR a.thumbnail = $3
        )
      ORDER BY a."pubDate" DESC
    `,
    [TARGET_FEED_NAME, GOV_UK_GENERIC_THUMBNAIL, env.placeholderImage]
  );

  return result.rows;
}

async function diagnoseCandidate(article) {
  const url = article.canonicalLink || article.link;
  const detected = await scrapeArticleMetadata(
    url,
    article.contentSnippet || article.summary || "",
    article.title || "",
    { existingThumbnail: "" }
  );

  const detectedThumbnail = String(detected?.thumbnail || "").trim();
  const nextThumbnail = isValidPublisherThumbnail(detectedThumbnail)
    ? detectedThumbnail
    : String(article.thumbnail || "").trim();

  return {
    id: article.id,
    title: article.title || "",
    url,
    currentThumbnail: String(article.thumbnail || "").trim(),
    detectedThumbnail,
    thumbnailSource: detected?.thumbnailSource || detected?.imageDiagnostic?.thumbnailSource || "",
    wouldUpdate: Boolean(nextThumbnail) && nextThumbnail !== String(article.thumbnail || "").trim(),
    nextThumbnail,
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function applyUpdates(updates) {
  let applied = 0;
  for (const update of updates) {
    const result = await client.query(
      `
        UPDATE articles
        SET
          thumbnail = $1,
          "updatedAt" = NOW()
        WHERE id = $2
      `,
      [update.nextThumbnail, update.id]
    );
    applied += Number(result.rowCount || 0);
  }
  return applied;
}

async function main() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await client.connect();
  try {
    const candidates = await fetchCandidates();
    console.log(`Matched GOV.UK thumbnail candidates: ${candidates.length}`);

    const diagnostics = await mapWithConcurrency(candidates, 3, diagnoseCandidate);
    const updates = diagnostics.filter((entry) => entry.wouldUpdate);

    console.log(JSON.stringify({
      matched: candidates.length,
      recoverable: updates.length,
      sample: diagnostics.slice(0, 8),
    }, null, 2));

    if (!apply) {
      console.log("Dry-run mode. Re-run with --apply to update GOV.UK thumbnails.");
      return;
    }

    if (!updates.length) {
      console.log("No GOV.UK thumbnail updates to apply.");
      return;
    }

    const applied = await applyUpdates(updates);
    console.log(`Applied GOV.UK thumbnail updates: ${applied}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to run GOV.UK thumbnail cleanup.");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
