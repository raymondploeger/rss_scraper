import axios from "axios";
import * as cheerio from "cheerio";
import { env } from "../config/env.js";
import { findArticleById, updateArticle } from "../database/articleRepository.js";
import { broadcast } from "./realtimeService.js";
import { canonicalizeUrl, normalizeText, resolveUrl, sanitizeFeedText } from "../utils/text.js";

const scrapeCache = new Map();

function isNotafiliaUrl(value) {
  try {
    return new URL(String(value || "")).hostname === "news.notafilia.pl";
  } catch {
    return false;
  }
}

function resolveImageCandidate(pageUrl, candidate) {
  const value = normalizeText(candidate, "");
  if (!value || value.startsWith("data:")) {
    return "";
  }

  return resolveUrl(pageUrl, value);
}

function tokenizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function isLikelyGenericMetadataImage(imageUrl) {
  const value = String(imageUrl || "").toLowerCase();
  return [
    "logo",
    "icon",
    "avatar",
    "banner",
    "default",
    "placeholder",
    "siteimage",
    "social-share",
    "share-image",
    "og-image",
    "media-image"
  ].some((token) => value.includes(token));
}

function isClearlyArticleSpecificImage(imageUrl, pageUrl, title) {
  const normalizedImageUrl = String(imageUrl || "").toLowerCase();
  if (!normalizedImageUrl) {
    return false;
  }

  if (isLikelyGenericMetadataImage(normalizedImageUrl)) {
    return false;
  }

  if (/\/20\d{2}\/\d{2}\//.test(normalizedImageUrl) || normalizedImageUrl.includes("/uploads/")) {
    return true;
  }

  const articleTokens = new Set([
    ...tokenizeForMatch(pageUrl),
    ...tokenizeForMatch(title)
  ]);

  return Array.from(articleTokens).some((token) => normalizedImageUrl.includes(token));
}

function findMeaningfulImage($) {
  const selectors = [
    "article img",
    "figure img",
    ".wp-post-image",
    'img[src*="/wp-content/uploads/"]',
    "main img",
    "[role='main'] img",
    ".article-content img",
    ".entry-content img",
    ".post-content img",
    ".content img",
    "img"
  ];

  for (const selector of selectors) {
    const candidates = $(selector)
      .map((_, element) => {
        const node = $(element);
        return (
          node.attr("src") ||
          node.attr("data-src") ||
          node.attr("data-lazy-src") ||
          node.attr("data-original") ||
          ""
        );
      })
      .get()
      .filter(Boolean);

    const meaningful = candidates.find((candidate) => {
      const normalized = String(candidate).trim().toLowerCase();
      if (!normalized || normalized.startsWith("data:")) {
        return false;
      }

      return !["logo", "icon", "avatar", "pixel", "tracking"].some((token) => normalized.includes(token));
    });

    if (meaningful) {
      return meaningful;
    }
  }

  return "";
}

async function requestHtml(url, attempt = 0) {
  try {
    const response = await axios.get(url, {
      timeout: env.requestTimeoutMs,
      headers: {
        "User-Agent": "RSS Monitor Dashboard/2.0",
        Accept: "text/html,application/xhtml+xml"
      },
      responseType: "text",
      maxRedirects: 5,
      maxContentLength: 1024 * 1024 * 2,
      validateStatus: (status) => status >= 200 && status < 400
    });

    const contentType = String(response.headers["content-type"] || "");
    if (!contentType.includes("text/html")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }

    return String(response.data || "");
  } catch (error) {
    if (attempt < env.scrapeRetryAttempts) {
      return requestHtml(url, attempt + 1);
    }

    throw error;
  }
}

export async function scrapeArticleMetadata(link, existingSnippet = "", articleTitle = "") {
  const cacheKey = canonicalizeUrl(link);
  if (scrapeCache.has(cacheKey)) {
    return scrapeCache.get(cacheKey);
  }

  const pending = (async () => {
    try {
      const html = await requestHtml(link);
      const $ = cheerio.load(html);
      const ogImage = $('meta[property="og:image"]').attr("content");
      const ogSecureImage = $('meta[property="og:image:secure_url"]').attr("content");
      const twitterImage = $('meta[name="twitter:image"]').attr("content");
      const canonicalUrl = $('link[rel="canonical"]').attr("href");
      const articleImage = findMeaningfulImage($);
      const metaDescription =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        "";
      const articleText = $("article p")
        .slice(0, 4)
        .map((_, element) => $(element).text())
        .get()
        .join(" ");
      const htmlLang = $("html").attr("lang") || "";
      const metadataImage = resolveImageCandidate(link, ogImage || ogSecureImage || twitterImage || "");
      const articleSpecificMetadataImage = isClearlyArticleSpecificImage(metadataImage, link, articleTitle) ? metadataImage : "";
      const articleImageCandidate = resolveImageCandidate(link, articleImage || "");
      const resolvedThumbnail = normalizeText(articleSpecificMetadataImage || articleImageCandidate, "");
      const thumbnailSource = articleSpecificMetadataImage
        ? ogImage
          ? "og:image"
          : ogSecureImage
            ? "og:image:secure_url"
            : "twitter:image"
        : articleImage
          ? "article-image"
          : "placeholder";

      console.log(`Thumbnail source for ${link}: ${thumbnailSource}`);
      if (isNotafiliaUrl(link)) {
        console.log(
          `[notafilia][enrich] articleUrl=${link} ogImageFound=${Boolean(articleSpecificMetadataImage)} ogImageValue=${articleSpecificMetadataImage || ""} articleImageFound=${Boolean(articleImageCandidate)} articleImageValue=${articleImageCandidate || ""} finalThumbnail=${resolvedThumbnail || ""}`
        );
      }

      return {
        thumbnail: resolvedThumbnail,
        canonicalLink: canonicalizeUrl(normalizeText(canonicalUrl, link)),
        metaDescription: sanitizeFeedText(metaDescription, ""),
        contentSnippet: sanitizeFeedText(articleText || existingSnippet, existingSnippet),
        language: normalizeText(htmlLang, "unknown"),
        fetchStatus:
          articleSpecificMetadataImage || articleImage || canonicalUrl || metaDescription || articleText
            ? "enriched"
            : "partial"
      };
    } catch (error) {
      console.error(`Thumbnail scrape failed for ${link}:`, error?.stack || error);
      console.log(`Thumbnail source for ${link}: placeholder`);
      if (isNotafiliaUrl(link)) {
        console.log(`[notafilia][enrich] articleUrl=${link} ogImageFound=false articleImageFound=false finalThumbnail=`);
      }
      return {
        thumbnail: "",
        canonicalLink: canonicalizeUrl(link),
        metaDescription: "",
        contentSnippet: existingSnippet,
        language: "unknown",
        fetchStatus: "failed"
      };
    }
  })();

  scrapeCache.set(cacheKey, pending);
  return pending;
}

export async function enrichArticle(articleId) {
  const article = await findArticleById(articleId);
  if (!article) {
    return;
  }

  if (article.thumbnail && article.thumbnail !== env.placeholderImage) {
    return article;
  }

  const enriched = await scrapeArticleMetadata(article.link, article.contentSnippet || article.summary || "", article.title || "");
  const nextThumbnail =
    article.thumbnail && article.thumbnail !== env.placeholderImage ? article.thumbnail : enriched.thumbnail || article.thumbnail;

  const updatedArticle = await updateArticle(articleId, {
    thumbnail: nextThumbnail,
    canonicalLink: enriched.canonicalLink || article.canonicalLink,
    contentSnippet: enriched.contentSnippet || article.contentSnippet,
    language: enriched.language || article.language,
    fetchStatus: enriched.fetchStatus
  });

  if (isNotafiliaUrl(article.link) || isNotafiliaUrl(article.canonicalLink) || isNotafiliaUrl(nextThumbnail)) {
    console.log(
      `[notafilia][db] articleUrl=${article.canonicalLink || article.link} dbUpdateSucceeded=${Boolean(updatedArticle)} finalThumbnail=${updatedArticle?.thumbnail || nextThumbnail || ""}`
    );
  }

  broadcast("article:update", {
    type: "article:update",
    article: updatedArticle
  });
}
