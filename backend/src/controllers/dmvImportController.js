import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { findFeedByRssUrl, createFeed as createFeedRecord } from "../database/feedRepository.js";
import { broadcast } from "../services/realtimeService.js";
import { toFeedDto } from "../services/presenterService.js";

const DMV_BASE_URL = "https://rssdmv-production.up.railway.app";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DMV_CATALOG_PATH = path.resolve(__dirname, "../../data/dmvFeeds.json");

function extractFeedUrl(item) {
  if (item.feed_path) {
    return `${DMV_BASE_URL}${item.feed_path}`;
  }

  return item.rss_url || item.rssUrl || item.url || null;
}

function extractName(item) {
  if (item.name) return item.name;
  if (item.state) return `${item.state} DMV`;
  return "DMV Feed";
}

async function loadDmvCatalog() {
  const raw = await readFile(DMV_CATALOG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export async function importDmvFeeds(_req, res) {
  try {
    const manifest = await loadDmvCatalog();

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of manifest) {
      try {
        if (item.region === "canada" && item.mode === "link-only") {
          skipped++;
          continue;
        }

        const rssUrl = extractFeedUrl(item);
        const name = extractName(item);

        if (!rssUrl) {
          failed++;
          continue;
        }

        const existing = await findFeedByRssUrl(rssUrl);
        if (existing) {
          skipped++;
          continue;
        }

        const feed = await createFeedRecord({
          name,
          topic: "Identity Documents",
          rssUrl,
          sourceType: "rss",
          isActive: true
        });

        broadcast("feed:update", {
          type: "feed:update",
          action: "created",
          feed: toFeedDto(feed)
        });

        imported++;
      } catch (err) {
        console.error("DMV import item error:", err);
        failed++;
      }
    }

    res.json({
      success: true,
      imported,
      skipped,
      failed,
      total: manifest.length
    });
  } catch (error) {
    console.error("DMV import failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to import DMV feeds"
    });
  }
}
