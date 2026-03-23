import axios from "axios";
import * as cheerio from "cheerio";
import { placeholderThumbnail } from "../database/firestoreService.js";

const thumbnailCache = new Map();
const scrapeTimeoutMs = Number(process.env.SCRAPE_TIMEOUT_MS || 12000);

function normalizeImageUrl(url) {
  if (typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();
  return trimmed || null;
}

function extractThumbnailFromHtml(html) {
  const $ = cheerio.load(html);
  return (
    normalizeImageUrl($('meta[property="og:image"]').attr("content")) ||
    normalizeImageUrl($('meta[name="twitter:image"]').attr("content")) ||
    normalizeImageUrl($("article img").first().attr("src")) ||
    normalizeImageUrl($("img").first().attr("src")) ||
    null
  );
}

export async function scrapeThumbnail(articleLink, existingThumbnail = "") {
  if (!articleLink) {
    return placeholderThumbnail;
  }

  if (thumbnailCache.has(articleLink)) {
    return thumbnailCache.get(articleLink);
  }

  if (existingThumbnail && existingThumbnail !== placeholderThumbnail) {
    thumbnailCache.set(articleLink, existingThumbnail);
    return existingThumbnail;
  }

  try {
    const response = await axios.get(articleLink, {
      timeout: scrapeTimeoutMs,
      headers: {
        "User-Agent": "RSS Monitoring Dashboard/1.0"
      }
    });

    const thumbnail = extractThumbnailFromHtml(response.data) || placeholderThumbnail;
    thumbnailCache.set(articleLink, thumbnail);
    return thumbnail;
  } catch (error) {
    thumbnailCache.set(articleLink, placeholderThumbnail);
    return placeholderThumbnail;
  }
}
