import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { env } from "../config/env.js";
import {
  createArticle,
  findArticleById,
  listPendingArticles,
  updateArticle
} from "../database/articleRepository.js";
import { createPollLog } from "../database/pollLogRepository.js";
import { listFeeds as listFeedRecords, updateFeed as updateFeedRecord } from "../database/feedRepository.js";
import { broadcast } from "./realtimeService.js";
import { enrichArticle, scrapeArticleMetadata } from "./thumbnailService.js";
import {
  canonicalizeUrl,
  createDeterministicId,
  inferKeywords,
  normalizeText,
  normalizeTitle,
  resolveArticleLink,
  sanitizeFeedText
} from "../utils/text.js";

const parser = new Parser({
  timeout: env.requestTimeoutMs,
  headers: {
    "User-Agent": "RSS Monitor Dashboard/2.0"
  }
});

function getHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getSourceName(link) {
  try {
    const url = new URL(link);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function extractFeedThumbnail(link, item) {
  const mediaContent = Array.isArray(item["media:content"])
    ? item["media:content"]
    : item["media:content"]
      ? [item["media:content"]]
      : [];
  const mediaThumbnail =
    item["media:thumbnail"] && typeof item["media:thumbnail"] === "object" ? item["media:thumbnail"] : null;
  const candidates = [
    ...mediaContent.map((entry) => (typeof entry === "object" ? entry.url || entry?.$?.url || "" : "")),
    mediaThumbnail?.$?.url || mediaThumbnail?.url || "",
    item.enclosure && typeof item.enclosure === "object" ? item.enclosure.url : "",
    item.thumbnail && typeof item.thumbnail === "object" ? item.thumbnail.url : "",
  ];

  const htmlContent = normalizeText(item["content:encoded"] || item.content || item.summary || item.description, "");
  if (htmlContent) {
    const $ = cheerio.load(htmlContent);
    candidates.push($("img").first().attr("src") || $("img").first().attr("data-src") || "");
  }

  const firstCandidate = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (!firstCandidate) {
    return "";
  }

  try {
    return new URL(firstCandidate, link).toString();
  } catch {
    return firstCandidate;
  }
}

function summaryShortFromArticle(article) {
  const base = sanitizeFeedText(article.contentSnippet || article.summary || article.title, article.title);
  if (!base) {
    return sanitizeFeedText(article.title, "Untitled Article");
  }

  const sentence = base.split(/(?<=[.!?])\s+/)[0] || base;
  return sentence.trim().slice(0, 220);
}

function parseWebsiteDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferWebsiteItemDate($, anchor) {
  const containers = [$(anchor), $(anchor).closest("article"), $(anchor).parent(), $(anchor).closest("li")];

  for (const container of containers) {
    const datetime =
      container.find("time").first().attr("datetime") ||
      container.find("[datetime]").first().attr("datetime") ||
      container.find("time").first().text();
    const parsed = parseWebsiteDate(datetime);
    if (parsed) {
      return parsed;
    }
  }

  return new Date();
}

function scoreWebsiteAnchor($, anchor, pageUrl) {
  const href = $(anchor).attr("href") || "";
  const text = sanitizeFeedText($(anchor).text(), "");
  const lower = `${href} ${text}`.toLowerCase();
  if (!href || !text) {
    return -1;
  }

  if (
    href.startsWith("#") ||
    href.startsWith("javascript:") ||
    ["login", "privacy", "cookie", "kontakt", "contact", "about", "regulamin", "terms"].some((token) => lower.includes(token))
  ) {
    return -1;
  }

  let resolvedHref = "";
  try {
    resolvedHref = new URL(href, pageUrl).toString();
  } catch {
    return -1;
  }

  if (!["http:", "https:"].includes(new URL(resolvedHref).protocol)) {
    return -1;
  }

  let score = 0;
  if (text.length >= 24) score += 4;
  if (text.length >= 48) score += 2;
  if (resolvedHref !== pageUrl) score += 3;
  if (getHostname(resolvedHref) === getHostname(pageUrl)) score += 2;
  if ($(anchor).closest("article").length) score += 6;
  if ($(anchor).closest("main").length || $(anchor).closest("[role='main']").length) score += 3;
  if ($(anchor).closest("li").length) score += 1;
  if (["news", "article", "post", "update", "press", "announcement", "aktual", "komunikat"].some((token) => lower.includes(token))) {
    score += 2;
  }

  return score;
}

async function extractWebsiteItems(feed) {
  console.log(`Parsing website source ${feed.id} (${feed.rssUrl})`);
  const response = await fetchWebsiteHtml(feed.rssUrl);
  const html = String(response.data || "");
  const $ = cheerio.load(html);
  const anchors = $("main a, article a, [role='main'] a, .content a, .entry-content a, .post a, a").toArray();
  const items = [];
  const seenLinks = new Set();

  for (const anchor of anchors) {
    const score = scoreWebsiteAnchor($, anchor, feed.rssUrl);
    if (score < 4) {
      continue;
    }

    const text = sanitizeFeedText($(anchor).text(), "");
    let link = "";
    try {
      link = new URL($(anchor).attr("href") || "", feed.rssUrl).toString();
    } catch {
      continue;
    }

    const canonicalLink = canonicalizeUrl(link);
    if (!canonicalLink || seenLinks.has(canonicalLink)) {
      continue;
    }

    seenLinks.add(canonicalLink);
    items.push({
      title: text,
      link,
      isoDate: inferWebsiteItemDate($, anchor).toISOString(),
      contentSnippet: sanitizeFeedText($(anchor).closest("article, li, div").text(), ""),
      author: "",
      source: getSourceName(link)
    });

    if (items.length >= 20) {
      break;
    }
  }

  console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
  return items;
}

async function fetchWebsiteHtml(url, attempt = 0) {
  try {
    return await axios.get(url, {
      timeout: env.requestTimeoutMs,
      responseType: "text",
      maxRedirects: 5,
      headers: {
        "User-Agent": "RSS Monitor Dashboard/2.0",
        Accept: "text/html,application/xhtml+xml"
      },
      validateStatus: (status) => status >= 200 && status < 400
    });
  } catch (error) {
    if (attempt < env.scrapeRetryAttempts) {
      return fetchWebsiteHtml(url, attempt + 1);
    }

    throw error;
  }
}

function normalizeItem(feed, item) {
  const link = resolveArticleLink(normalizeText(item.link));
  if (!link) {
    return null;
  }

  const pubDate = new Date(String(item.isoDate || item.pubDate || new Date().toISOString()));
  const contentSnippet = sanitizeFeedText(item.contentSnippet || item.content || item.summary || item.description, "");
  const title = sanitizeFeedText(item.title, "Untitled Article");
  const thumbnail = normalizeText(extractFeedThumbnail(link, item), env.placeholderImage);
  const canonicalLink = canonicalizeUrl(link);
  const source = sanitizeFeedText(item.creator || item.author || getSourceName(link), "Unknown");

  return {
    id: createDeterministicId(canonicalLink || link),
    feedId: feed.id,
    feedName: feed.name,
    topic: feed.topic,
    title,
    normalizedTitle: normalizeTitle(title),
    canonicalLink,
    link,
    source,
    pubDate,
    thumbnail,
    summary: contentSnippet,
    summaryShort: summaryShortFromArticle({ title, contentSnippet }),
    keywords: inferKeywords([title, contentSnippet, feed.topic], 6),
    contentSnippet,
    author: sanitizeFeedText(item.creator || item.author, ""),
    clusterId: null,
    duplicateGroupId: null,
    isDuplicate: false,
    duplicateOf: null,
    language: "unknown",
    fetchStatus: thumbnail && thumbnail !== env.placeholderImage ? "partial" : "pending",
    articleHash: createDeterministicId(canonicalLink || link)
  };
}

async function upsertArticle(article) {
  const existing = await findArticleById(article.id);
  if (!existing) {
    const created = await createArticle(article);
    broadcast("article:new", { type: "article:new", article: created });
    return { created: true, article: created };
  }

  const shouldBackfillThumbnail = existing.thumbnail === env.placeholderImage && article.thumbnail !== env.placeholderImage;
  const shouldBackfillSnippet = (!existing.contentSnippet || existing.contentSnippet.length < 40) && article.contentSnippet;

  if (shouldBackfillThumbnail || shouldBackfillSnippet) {
    const updated = await updateArticle(existing.id, {
      thumbnail: shouldBackfillThumbnail ? article.thumbnail : existing.thumbnail,
      contentSnippet: shouldBackfillSnippet ? article.contentSnippet : existing.contentSnippet,
      summary: shouldBackfillSnippet ? article.summary : existing.summary,
      summaryShort: shouldBackfillSnippet ? article.summaryShort : existing.summaryShort,
      keywords: existing.keywords?.length ? existing.keywords : article.keywords,
      fetchStatus: article.fetchStatus
    });
    broadcast("article:update", { type: "article:update", article: updated });
    return { created: false, article: updated };
  }

  return { created: false, article: existing };
}

function queueThumbnailEnrichment(article) {
  if (!article?.id) {
    return;
  }

  if (article.thumbnail && article.thumbnail !== env.placeholderImage) {
    return;
  }

  void enrichArticle(article.id).catch((enrichmentError) => {
    console.error(`Async thumbnail enrichment failed for article ${article.id}:`, enrichmentError?.stack || enrichmentError);
  });
}

export async function syncFeed(feed) {
  const startedAt = new Date();
  let newArticles = 0;

  try {
    console.log(`Starting feed sync for ${feed.id} (${feed.name || feed.rssUrl})`);
    await updateFeedRecord(feed.id, {
      lastStatus: "refreshing",
      lastError: null
    });

    let resolvedItems = [];
    if (feed.sourceType === "website") {
      resolvedItems = await extractWebsiteItems(feed);
    } else {
      console.log(`Fetching RSS source ${feed.id} (${feed.rssUrl})`);
      const parsedFeed = await parser.parseURL(feed.rssUrl);
      resolvedItems = Array.isArray(parsedFeed.items) ? parsedFeed.items : [];
    }
    console.log(`Fetched ${resolvedItems.length} items for feed ${feed.id}`);

    for (const item of resolvedItems) {
      try {
        const normalized = normalizeItem(feed, item);
        if (!normalized) {
          continue;
        }

        console.log(
          `Thumbnail source for article ${normalized.id}: ${
            normalized.thumbnail && normalized.thumbnail !== env.placeholderImage ? "rss" : "placeholder"
          }`
        );

        const result = await upsertArticle(normalized);
        if (!result.created) {
          queueThumbnailEnrichment(result.article);
          continue;
        }

        newArticles += 1;
        console.log(`Stored new article ${result.article.id} for feed ${feed.id}`);

        queueThumbnailEnrichment(result.article);
      } catch (itemError) {
        console.error(`Article ingestion error for feed ${feed.id}:`, itemError?.stack || itemError);
      }
    }

    const updatedFeed = await updateFeedRecord(feed.id, {
      lastFetchedAt: new Date(),
      lastStatus: "success",
      lastError: null,
      lastInsertedCount: newArticles
    });
    broadcast("feed:update", { type: "feed:update", feed: updatedFeed });

    await createPollLog({
      feedId: feed.id,
      startedAt,
      finishedAt: new Date(),
      status: "success",
      newArticles
    });

    console.log(`Feed sync complete for ${feed.id}; inserted ${newArticles} new articles`);
    return { feedId: String(feed.id), newArticles };
  } catch (error) {
    console.error(`Feed sync error for ${feed.id}:`, error?.stack || error);
    const updatedFeed = await updateFeedRecord(feed.id, {
      lastFetchedAt: new Date(),
      lastStatus: "error",
      lastError: error.message,
      lastInsertedCount: newArticles
    });
    broadcast("feed:update", { type: "feed:update", feed: updatedFeed });

    await createPollLog({
      feedId: feed.id,
      startedAt,
      finishedAt: new Date(),
      status: "error",
      newArticles: 0,
      errorMessage: error.message
    });

    return { feedId: String(feed.id), newArticles: 0, error: error.message };
  }
}

export async function syncAllFeeds() {
  console.log("Starting refresh for all active feeds");
  const feeds = await listFeedRecords({ activeOnly: true, order: "ASC" });
  const batchSize = env.pollConcurrency;
  const results = [];

  for (let index = 0; index < feeds.length; index += batchSize) {
    const batch = feeds.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map((feed) => syncFeed(feed)));
    results.push(...batchResults);
  }

  broadcast("refresh:complete", {
    type: "refresh:complete",
    feedsProcessed: feeds.length,
    results
  });

  return {
    feedsProcessed: feeds.length,
    results
  };
}

export async function processArticleBacklog(limit = 20) {
  console.log(`Processing article backlog with limit ${limit}`);
  const pendingArticles = await listPendingArticles(limit);

  for (const article of pendingArticles) {
    try {
      const enriched = await scrapeArticleMetadata(article.link, article.contentSnippet || article.summary);
      const updatedArticle = await updateArticle(article.id, {
        thumbnail: article.thumbnail !== env.placeholderImage ? article.thumbnail : enriched.thumbnail,
        canonicalLink: enriched.canonicalLink || article.canonicalLink,
        contentSnippet: enriched.contentSnippet || article.contentSnippet,
        summary: article.summary || enriched.metaDescription || article.contentSnippet,
        summaryShort: article.summaryShort || summaryShortFromArticle(article),
        keywords: article.keywords?.length ? article.keywords : inferKeywords([article.title, article.contentSnippet, article.topic], 6),
        language: enriched.language || article.language,
        fetchStatus: enriched.fetchStatus
      });
      broadcast("article:update", { type: "article:update", article: updatedArticle });
    } catch (error) {
      console.error(`Backlog enrichment error for article ${article.id}:`, error?.stack || error);
    }
  }

  return pendingArticles.length;
}
