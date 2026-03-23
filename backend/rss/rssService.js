import Parser from "rss-parser";
import { URL } from "url";
import {
  listActiveFeeds,
  saveArticleIfNew,
  updateArticleThumbnail,
  updateFeedSyncState,
  placeholderThumbnail
} from "../database/firestoreService.js";
import { scrapeThumbnail } from "../scraper/thumbnailScraper.js";

const parser = new Parser({
  timeout: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
  headers: {
    "User-Agent": "RSS Monitoring Dashboard/1.0"
  }
});

const maxFeeds = Number(process.env.MAX_FEEDS || 50);
const concurrency = 5;

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const result = value.trim();
  return result || fallback;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function sanitizeFeedText(value, fallback = "") {
  const normalized = normalizeText(value, fallback);
  if (!normalized) {
    return fallback;
  }

  const withoutTags = normalized.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed || fallback;
}

function resolveArticleLink(link) {
  try {
    const parsed = new URL(link);
    const isGoogleRedirect =
      parsed.hostname.includes("google.") && parsed.pathname === "/url" && parsed.searchParams.has("url");

    if (isGoogleRedirect) {
      return parsed.searchParams.get("url") || link;
    }

    return link;
  } catch {
    return link;
  }
}

function getSourceName(feed, item, link) {
  if (typeof item.source === "string" && item.source.trim()) {
    return item.source.trim();
  }

  if (item.source && typeof item.source === "object" && typeof item.source.title === "string") {
    return normalizeText(item.source.title, "Unknown");
  }

  if (typeof item.creator === "string" && item.creator.trim()) {
    return item.creator.trim();
  }

  if (typeof item.author === "string" && item.author.trim()) {
    return item.author.trim();
  }

  if (typeof feed.title === "string" && feed.title.trim()) {
    return feed.title.trim();
  }

  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function normalizeArticle(feedRecord, parsedFeed, item) {
  const rawLink = normalizeText(item.link);
  if (!rawLink) {
    return null;
  }

  const link = resolveArticleLink(rawLink);

  const pubDate = item.isoDate || item.pubDate || new Date().toISOString();

  return {
    title: sanitizeFeedText(item.title, "Untitled Article"),
    link,
    pubDate: new Date(pubDate).toISOString(),
    source: getSourceName(parsedFeed, item, link),
    topic: normalizeText(feedRecord.topic, "General"),
    thumbnail: placeholderThumbnail,
    feedId: feedRecord.id
  };
}

async function processArticle(article) {
  const result = await saveArticleIfNew(article);

  if (!result.isNew) {
    return { inserted: false };
  }

  const thumbnail = await scrapeThumbnail(article.link, article.thumbnail);
  await updateArticleThumbnail(result.article.id, thumbnail);

  return { inserted: true };
}

export async function ingestFeed(feedRecord) {
  let insertedCount = 0;

  try {
    const parsedFeed = await parser.parseURL(feedRecord.rssUrl);
    const items = Array.isArray(parsedFeed.items) ? parsedFeed.items : [];

    for (const item of items) {
      const article = normalizeArticle(feedRecord, parsedFeed, item);
      if (!article) {
        continue;
      }

      const result = await processArticle(article);
      if (result.inserted) {
        insertedCount += 1;
      }
    }

    await updateFeedSyncState(feedRecord.id, {
      lastStatus: "success",
      lastFetchedAt: new Date().toISOString(),
      lastInsertedCount: insertedCount,
      lastError: null
    });

    return { feedId: feedRecord.id, insertedCount };
  } catch (error) {
    await updateFeedSyncState(feedRecord.id, {
      lastStatus: "error",
      lastFetchedAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : "Unknown ingestion error"
    });

    return {
      feedId: feedRecord.id,
      insertedCount,
      error: error instanceof Error ? error.message : "Unknown ingestion error"
    };
  }
}

async function processInBatches(items, worker, batchSize) {
  const results = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map((item) => worker(item)));
    results.push(...batchResults);
  }

  return results;
}

export async function refreshAllFeeds() {
  const feeds = await listActiveFeeds(maxFeeds);
  const results = await processInBatches(feeds, ingestFeed, concurrency);

  return {
    feedsProcessed: feeds.length,
    results
  };
}
