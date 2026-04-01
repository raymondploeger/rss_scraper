import axios from "axios";
import { findFeedByRssUrl, createFeed as createFeedRecord } from "../database/feedRepository.js";
import { broadcast } from "../services/realtimeService.js";
import { toFeedDto } from "../services/presenterService.js";

const DMV_BASE_URL = "https://rssdmv-production.up.railway.app";

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

export async function importDmvFeeds(_req, res) {
  try {
    const manifestUrl = `${DMV_BASE_URL}/feeds.json`;

    const response = await axios.get(manifestUrl, {
      timeout: 15000,
      headers: { Accept: "application/json" }
    });

    const manifest = Array.isArray(response.data) ? response.data : [];

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of manifest) {
      try {
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
