import axios from "axios";
import { getFeeds, createFeed } from "../services/feedService.js";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extractFeedUrl(item) {
  return item.rss_url || item.rssUrl || item.feed_url || item.feedUrl || item.url || null;
}

function extractName(item) {
  return item.name || item.state || item.title || "DMV Feed";
}

export async function importDmvFeeds(_req, res) {
  try {
    const manifestUrl = "https://rssdmv-production.up.railway.app/feeds.json";

    const response = await axios.get(manifestUrl, {
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "User-Agent": "RSS Scraper Dashboard/1.0"
      }
    });

    const manifest = Array.isArray(response.data) ? response.data : [];
    const existingFeeds = await getFeeds();

    const existingByUrl = new Map();
    const existingByName = new Map();

    for (const feed of existingFeeds) {
      if (feed?.url) existingByUrl.set(feed.url, feed);
      if (feed?.name) existingByName.set(normalizeName(feed.name), feed);
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const item of manifest) {
      try {
        const rssUrl = extractFeedUrl(item);
        const name = extractName(item);

        if (!rssUrl) {
          failed += 1;
          errors.push({ name, reason: "Missing rss URL" });
          continue;
        }

        if (existingByUrl.has(rssUrl) || existingByName.has(normalizeName(name))) {
          skipped += 1;
          continue;
        }

        await createFeed({
          name,
          url: rssUrl,
          topic: "Identity Documents",
          active: true
        });

        imported += 1;
      } catch (error) {
        failed += 1;
        errors.push({
          name: extractName(item),
          reason: error?.message || "Unknown import error"
        });
      }
    }

    console.log("DMV import completed", {
      imported,
      skipped,
      failed,
      total: manifest.length
    });

    res.json({
      success: true,
      imported,
      skipped,
      failed,
      total: manifest.length,
      errors
    });
  } catch (error) {
    console.error("DMV import failed", error);
    res.status(500).json({
      success: false,
      error: "Failed to import DMV feeds",
      message: error?.message || "Unknown error"
    });
  }
}
