import axios from "axios";
import { findFeedByRssUrl } from "../database/feedRepository.js";
import { createFeed as createFeedRecord } from "../database/feedRepository.js";
import { broadcast } from "../services/realtimeService.js";
import { toFeedDto } from "../services/presenterService.js";

function extractFeedUrl(item) {
  return item.rss_url || item.rssUrl || item.url || null;
}

function extractName(item) {
  return item.name || item.state || "DMV Feed";
}

export async function importDmvFeeds(_req, res) {
  try {
    const manifestUrl = "https://rssdmv-production.up.railway.app/feeds.json";

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
