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
  },
  customFields: {
    item: [
      ["media:content", "media:content", { keepArray: true }],
      ["media:thumbnail", "media:thumbnail", { keepArray: true }],
      ["content:encoded", "content:encoded"],
      ["dc:subject", "dc:subject", { keepArray: true }],
      ["wp:term", "wp:term", { keepArray: true }],
      ["itunes:image", "itunes:image"],
      ["image", "image"],
      ["image:url", "image:url"],
      ["thumbnail", "thumbnail"]
    ]
  }
});

function isNotafiliaUrl(value) {
  try {
    return new URL(String(value || "")).hostname === "news.notafilia.pl";
  } catch {
    return false;
  }
}

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

function isMeaningfulImageCandidate(candidate) {
  const normalized = String(candidate || "").trim().toLowerCase();
  if (!normalized || normalized.startsWith("data:")) {
    return false;
  }

  return !["logo", "icon", "avatar", "pixel", "tracking"].some((token) => normalized.includes(token));
}

function resolveFeedImageCandidate(link, candidate) {
  if (!isMeaningfulImageCandidate(candidate)) {
    return "";
  }

  try {
    return new URL(candidate, link).toString();
  } catch {
    return candidate;
  }
}

function pickImageFromSrcset(value) {
  return String(value || "")
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .find((candidate) => isMeaningfulImageCandidate(candidate)) || "";
}

function extractImageFromHtml(html) {
  const markup = String(html || "");
  const match = markup.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || "";
}

function extractFirstMeaningfulHtmlImage(html, link) {
  const markup = normalizeText(html, "");
  if (!markup) {
    return "";
  }

  const $ = cheerio.load(markup);
  const selectors = [
    "article img",
    "figure img",
    ".entry-content img",
    ".post-content img",
    ".content img",
    "img"
  ];

  for (const selector of selectors) {
    const found = $(selector)
      .map((_, element) => {
        const node = $(element);
        return (
          node.attr("src") ||
          node.attr("data-src") ||
          node.attr("data-lazy-src") ||
          node.attr("data-original") ||
          pickImageFromSrcset(node.attr("srcset") || node.attr("data-srcset")) ||
          ""
        );
      })
      .get()
      .find((candidate) => isMeaningfulImageCandidate(candidate));

    if (found) {
      return resolveFeedImageCandidate(link, found);
    }
  }

  return resolveFeedImageCandidate(link, extractImageFromHtml(markup));
}

function isImageEnclosure(enclosure) {
  if (!enclosure || typeof enclosure !== "object") {
    return false;
  }

  const type = String(enclosure.type || "").toLowerCase();
  const url = String(enclosure.url || "");
  return type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].some((ext) => url.toLowerCase().includes(ext));
}

function collectImageCandidates(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectImageCandidates(entry));
  }

  if (typeof value !== "object") {
    return [];
  }

  const directCandidates = [
    value.url,
    value.href,
    value.src,
    typeof value.image === "string" ? value.image : "",
    typeof value.imageUrl === "string" ? value.imageUrl : "",
    typeof value.thumbnail === "string" ? value.thumbnail : "",
    value.$?.url,
    value.$?.href,
    value.$?.src,
    value["@_url"],
    value["@_href"],
    value["@_src"],
    value._,
    pickImageFromSrcset(value.srcset || value.$?.srcset || value["@_srcset"])
  ].filter(Boolean);

  return [
    ...directCandidates,
    ...Object.entries(value)
      .filter(([key]) => !["$", "_"].includes(key))
      .flatMap(([, entry]) => collectImageCandidates(entry))
  ];
}

function findFirstImageCandidate(link, values) {
  const candidate = values
    .flatMap((value) => collectImageCandidates(value))
    .find((entry) => isMeaningfulImageCandidate(entry));

  return candidate ? resolveFeedImageCandidate(link, candidate) : "";
}

function extractFeedThumbnail(link, item) {
  const mediaContentCandidate = findFirstImageCandidate(link, [item["media:content"], item.mediaContent]);
  if (mediaContentCandidate) {
    return { url: mediaContentCandidate, source: "rss-media-content" };
  }

  const mediaThumbnailCandidate = findFirstImageCandidate(link, [item["media:thumbnail"], item.mediaThumbnail]);
  if (mediaThumbnailCandidate) {
    return { url: mediaThumbnailCandidate, source: "rss-media-thumbnail" };
  }

  if (isImageEnclosure(item.enclosure)) {
    return { url: resolveFeedImageCandidate(link, item.enclosure.url), source: "rss-enclosure" };
  }

  const imageEnclosure = (Array.isArray(item.enclosures) ? item.enclosures : []).find(isImageEnclosure);
  if (imageEnclosure) {
    return { url: resolveFeedImageCandidate(link, imageEnclosure.url), source: "rss-enclosure" };
  }

  const directImageCandidate = findFirstImageCandidate(link, [
    item.image,
    item.imageUrl,
    item["image:url"],
    item.thumbnail,
    item["itunes:image"],
    item["og:image"],
    item.ogImage
  ]);
  if (directImageCandidate) {
    return { url: directImageCandidate, source: "rss-image-field" };
  }

  const contentEncodedImage = extractFirstMeaningfulHtmlImage(item["content:encoded"] || item.content, link);
  if (contentEncodedImage) {
    return { url: contentEncodedImage, source: "rss-content-encoded" };
  }

  const descriptionImage = extractFirstMeaningfulHtmlImage(item.description || item.summary, link);
  if (descriptionImage) {
    return { url: descriptionImage, source: "rss-description-image" };
  }

  return { url: "", source: "placeholder" };
}

function summaryShortFromArticle(article) {
  const base = sanitizeFeedText(article.contentSnippet || article.summary || article.title, article.title);
  if (!base) {
    return sanitizeFeedText(article.title, "Untitled Article");
  }

  const sentence = base.split(/(?<=[.!?])\s+/)[0] || base;
  return sentence.trim().slice(0, 220);
}

function collectTagCandidates(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectTagCandidates);
  }

  if (typeof value === "string") {
    return [value];
  }

  if (typeof value === "object") {
    return [
      value._,
      value.name,
      value.term,
      value.label,
      value.$?.term,
      value.$?.label,
      value.$?.nicename,
      value["@_term"],
      value["@_label"],
      value["@_nicename"]
    ].flatMap(collectTagCandidates);
  }

  return [];
}

function normalizeArticleTags(item) {
  const candidates = [
    item.category,
    item.categories,
    item["dc:subject"],
    item.dcSubject,
    item.subject,
    item["wp:term"],
    item.wpTerm
  ].flatMap(collectTagCandidates);

  return Array.from(
    new Set(
      candidates
        .map((tag) => sanitizeFeedText(tag, ""))
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter((tag) => tag.length >= 2 && tag.length <= 80)
    )
  );
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

function extractAtomLinkHref(linkValue) {
  if (!linkValue) {
    return "";
  }

  if (typeof linkValue === "string") {
    return linkValue;
  }

  if (Array.isArray(linkValue)) {
    for (const entry of linkValue) {
      const href = extractAtomLinkHref(entry);
      if (href) {
        return href;
      }
    }

    return "";
  }

  if (typeof linkValue === "object") {
    if (typeof linkValue.href === "string" && linkValue.href.trim()) {
      return linkValue.href;
    }

    if (typeof linkValue.url === "string" && linkValue.url.trim()) {
      return linkValue.url;
    }

    if (linkValue.$ && typeof linkValue.$.href === "string" && linkValue.$.href.trim()) {
      return linkValue.$.href;
    }
  }

  return "";
}

function resolveItemLink(item) {
  const candidates = [
    item?.link,
    item?.guid,
    item?.id,
    item?.url,
    extractAtomLinkHref(item?.link),
    extractAtomLinkHref(item?.links),
    extractAtomLinkHref(item?.atomLink),
  ];

  for (const candidate of candidates) {
    const resolved = resolveArticleLink(normalizeText(candidate));
    if (resolved) {
      return resolved;
    }
  }

  return "";
}

function normalizeItem(feed, item) {
  const link = resolveItemLink(item);
  if (!link) {
    return null;
  }

  const pubDate = new Date(String(item.isoDate || item.pubDate || new Date().toISOString()));
  const contentSnippet = sanitizeFeedText(item.contentSnippet || item.content || item.summary || item.description, "");
  const title = sanitizeFeedText(item.title, "Untitled Article");
  const extractedThumbnail = extractFeedThumbnail(link, item);
  const thumbnail = normalizeText(extractedThumbnail.url, env.placeholderImage);
  const canonicalLink = canonicalizeUrl(link);
  const source = sanitizeFeedText(item.creator || item.author || getSourceName(link), "Unknown");
  const tags = normalizeArticleTags(item);
  const keywords = Array.from(new Set([...tags, ...inferKeywords([title, contentSnippet, feed.topic], 6)]));
  const isNotafiliaArticle = isNotafiliaUrl(link) || isNotafiliaUrl(canonicalLink);

  if (isNotafiliaArticle) {
    console.log(
      `[notafilia][rss] articleUrl=${canonicalLink || link} rssImageFound=${Boolean(extractedThumbnail.url)} rssImageValue=${extractedThumbnail.url || ""} finalThumbnail=${thumbnail || ""}`
    );
  }

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
    keywords,
    tags,
    contentSnippet,
    author: sanitizeFeedText(item.creator || item.author, ""),
    clusterId: null,
    duplicateGroupId: null,
    isDuplicate: false,
    duplicateOf: null,
    language: "unknown",
    fetchStatus: thumbnail && thumbnail !== env.placeholderImage ? "partial" : "pending",
    articleHash: createDeterministicId(canonicalLink || link),
    thumbnailSource: extractedThumbnail.source
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
    if (isNotafiliaUrl(article.link) || isNotafiliaUrl(article.canonicalLink) || isNotafiliaUrl(article.thumbnail)) {
      console.log(
        `[notafilia][enrich] articleUrl=${article.canonicalLink || article.link} skipped=true reason=existing-thumbnail finalThumbnail=${article.thumbnail || ""}`
      );
    }
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

    for (const item of resolvedItems) {
      try {
        const normalized = normalizeItem(feed, item);
        if (!normalized) {
          continue;
        }

        console.log(
          `Thumbnail source for article ${normalized.id}: ${normalized.thumbnailSource || "placeholder"}`
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
      const enriched = await scrapeArticleMetadata(article.link, article.contentSnippet || article.summary, article.title || "");
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
