import axios from "axios";
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

const TARGET_FEED_NAME = "banknotes";
const BAD_FALLBACK_THUMBNAIL =
  "https://prismreports.org/wp-content/uploads/2026/03/GettyImages-2260885470-scaled.jpg";

const client = new Client({
  connectionString: databaseUrl,
  application_name: "cleanup-banknotes-thumbnails",
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

function isValidPublisherThumbnail(value) {
  const thumbnail = String(value || "").trim();
  return Boolean(thumbnail) && thumbnail !== env.placeholderImage && !isGoogleNewsPlaceholderImage(thumbnail);
}

async function fetchBanknotesThumbnailCandidates() {
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
        a."feedName",
        a."pubDate",
        a."createdAt"
      FROM articles a
      INNER JOIN feeds f
        ON f.id = a."feedId"
      WHERE
        f.name = $1
        AND a."feedName" = $1
        AND a.thumbnail = $2
      ORDER BY
        a."pubDate" DESC,
        a."createdAt" DESC
    `,
    [TARGET_FEED_NAME, BAD_FALLBACK_THUMBNAIL]
  );

  return result.rows;
}

async function getImageHttpStatus(imageUrl, referer) {
  const url = String(imageUrl || "").trim();
  if (!url) {
    return "";
  }

  const headers = {
    "User-Agent": "RSS Monitor Dashboard/2.0",
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    Referer: referer || "",
  };

  for (const method of ["head", "get"]) {
    try {
      const response = await axios.request({
        method,
        url,
        headers,
        timeout: env.requestTimeoutMs,
        maxRedirects: 5,
        responseType: method === "get" ? "stream" : "text",
        validateStatus: () => true,
      });

      if (response.data && typeof response.data.destroy === "function") {
        response.data.destroy();
      }

      if (method === "head" && [403, 405, 501].includes(Number(response.status || 0))) {
        continue;
      }

      const contentType = response.headers?.["content-type"] || "";
      return `${response.status}${contentType ? ` ${contentType}` : ""}`;
    } catch (error) {
      if (method === "get") {
        return error?.code || error?.message || "request_failed";
      }
    }
  }

  return "";
}

async function diagnoseCandidate(article) {
  const url = article.canonicalLink || article.link;
  const detected = await scrapeArticleMetadata(
    url,
    article.contentSnippet || article.summary || "",
    article.title || "",
    {
      existingThumbnail: "",
    }
  );

  const detectedThumbnail = String(detected?.thumbnail || "").trim();
  const validPublisherThumbnail = isValidPublisherThumbnail(detectedThumbnail);
  const nextThumbnail = validPublisherThumbnail ? detectedThumbnail : env.placeholderImage;

  return {
    id: article.id,
    title: article.title || "",
    url,
    currentThumbnail: article.thumbnail || "",
    detectedThumbnail,
    thumbnailSource: detected?.thumbnailSource || detected?.imageDiagnostic?.thumbnailSource || "",
    imageHttpStatus: await getImageHttpStatus(detectedThumbnail, url),
    validPublisherThumbnail,
    wouldUpdate: nextThumbnail !== String(article.thumbnail || "").trim(),
    nextThumbnail,
    importedAt: article.createdAt,
    publishedAt: article.pubDate,
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

function printSummary(candidates = [], diagnostics = []) {
  const recoverable = diagnostics.filter((row) => row.validPublisherThumbnail).length;
  const wouldSetPlaceholder = diagnostics.filter((row) => !row.validPublisherThumbnail && row.wouldUpdate).length;
  const wouldUpdate = diagnostics.filter((row) => row.wouldUpdate).length;

  console.log("\n=== Banknotes Thumbnail Backfill Summary ===");
  console.table(
    formatRows([
      {
        feed_name: TARGET_FEED_NAME,
        matching_bad_thumbnails: candidates.length,
        recoverable_thumbnails: recoverable,
        would_set_placeholder: wouldSetPlaceholder,
        rows_would_update: wouldUpdate,
        mode: apply ? "apply" : "dry-run",
      },
    ])
  );
}

function printDiagnostics(diagnostics = []) {
  console.log("\n=== Banknotes Thumbnail Candidates ===");
  if (!diagnostics.length) {
    console.log("(no matching banknotes fallback thumbnails)");
    return;
  }

  console.table(
    formatRows(
      diagnostics.map((row) => ({
        title: row.title,
        url: row.url,
        current_thumbnail: row.currentThumbnail,
        detected_thumbnail: row.detectedThumbnail,
        thumbnail_source: row.thumbnailSource,
        image_http_status: row.imageHttpStatus,
        would_update: row.wouldUpdate ? "yes" : "no",
      }))
    )
  );
}

async function applyUpdates(diagnostics = []) {
  const updates = diagnostics.filter((row) => row.wouldUpdate);

  if (!updates.length) {
    console.log("\nNo thumbnail updates to apply.");
    return;
  }

  console.warn("\nWARNING: --apply mode is enabled.");
  console.warn("This will update only the thumbnail field for selected banknotes feed articles.");
  console.warn(`Rows selected for thumbnail update: ${updates.length}`);

  await client.query("BEGIN");
  try {
    let updatedRows = 0;
    for (const row of updates) {
      const result = await client.query(
        `
          SELECT thumbnail
          FROM articles
          WHERE id = $1
            AND "feedName" = $2
            AND thumbnail = $3
        `,
        [row.id, TARGET_FEED_NAME, BAD_FALLBACK_THUMBNAIL]
      );
      if (!result.rows[0]) {
        continue;
      }

      const updateResult = await client.query(
        `
          UPDATE articles
          SET thumbnail = $1
          WHERE id = $2
            AND "feedName" = $3
            AND thumbnail = $4
        `,
        [row.nextThumbnail, row.id, TARGET_FEED_NAME, BAD_FALLBACK_THUMBNAIL]
      );
      updatedRows += Number(updateResult.rowCount || 0);
    }

    await client.query("COMMIT");
    console.log("\n=== Backfill Result ===");
    console.table(formatRows([{ updated_rows: updatedRows }]));
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
    console.log("Dry-run mode. No database rows will be updated. Re-run with --apply to update thumbnails.");
  }

  try {
    await client.connect();
    if (!apply) {
      await client.query("BEGIN READ ONLY");
    }

    const candidates = await fetchBanknotesThumbnailCandidates();
    const diagnostics = await mapWithConcurrency(candidates, 4, diagnoseCandidate);

    printSummary(candidates, diagnostics);
    printDiagnostics(diagnostics);

    if (apply) {
      await applyUpdates(diagnostics);
    } else {
      await client.query("ROLLBACK");
      console.log("\nDry-run complete. No rows were updated.");
    }
  } catch (error) {
    if (!apply) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback errors when the connection failed before the transaction started.
      }
    }
    console.error("Failed to run banknotes thumbnail backfill.");
    console.error(error?.stack || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
