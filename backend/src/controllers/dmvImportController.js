import axios from "axios";

export async function importDmvFeeds(req, res) {
  try {
    const url = "https://rssdmv-production.up.railway.app/feeds.json";

    const response = await axios.get(url, { timeout: 10000 });
    const feeds = response.data || [];

    let imported = 0;
    let skipped = 0;

    // Dit moet aangepast worden aan jouw DB/service
    // hieronder ga ik ervan uit dat je een feedService hebt
    const { getFeeds, createFeed } = await import("../services/feedService.js");

    const existingFeeds = await getFeeds();
    const existingUrls = new Set(existingFeeds.map(f => f.url));

    for (const feed of feeds) {
      const feedUrl = feed.rss_url || feed.url;

      if (!feedUrl) continue;

      if (existingUrls.has(feedUrl)) {
        skipped++;
        continue;
      }

      await createFeed({
        name: feed.name || "DMV Feed",
        url: feedUrl,
        topic: "Identity Documents",
        active: true
      });

      imported++;
    }

    res.json({
      success: true,
      imported,
      skipped,
      total: feeds.length
    });

  } catch (error) {
    console.error("DMV import error:", error);
    res.status(500).json({
      error: "Failed to import DMV feeds"
    });
  }
}