import axios from "axios";
import * as cheerio from "cheerio";
import { env } from "../config/env.js";
import { findArticleById, updateArticle } from "../database/articleRepository.js";
import { broadcast } from "./realtimeService.js";
import { canonicalizeUrl, normalizeText, resolveUrl, sanitizeFeedText } from "../utils/text.js";

const scrapeCache = new Map();
const MEANINGFUL_IMAGE_MIN_SIZE = 120;
const NOISY_IMAGE_PATTERNS = [
  "logo",
  "icon",
  "avatar",
  "gravatar",
  "emoji",
  "sprite",
  "tracking",
  "pixel",
  "badge",
  "banner-ad",
  "ads",
  "doubleclick",
  "feedburner"
];

function resolveImageCandidate(pageUrl, candidate) {
  const value = normalizeText(candidate, "");
  if (!value || value.startsWith("data:")) {
    return "";
  }

  return resolveUrl(pageUrl, value);
}

function parseDimension(value) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNoisyImage(candidate) {
  const lower = String(candidate || "").toLowerCase();
  return NOISY_IMAGE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function collectImageCandidates($, selector) {
  return $(selector)
    .map((_, element) => {
      const node = $(element);
      const src =
        node.attr("src") ||
        node.attr("data-src") ||
        node.attr("data-lazy-src") ||
        node.attr("data-original") ||
        node.attr("srcset")?.split(",")[0]?.trim().split(" ")[0] ||
        "";
      const alt = node.attr("alt") || "";
      const width = parseDimension(node.attr("width"));
      const height = parseDimension(node.attr("height"));
      const classes = node.attr("class") || "";
      const id = node.attr("id") || "";

      return {
        src,
        alt,
        width,
        height,
        score: Math.max(width, height),
        descriptor: `${src} ${alt} ${classes} ${id}`
      };
    })
    .get()
    .filter((candidate) => {
      if (!candidate.src || candidate.src.startsWith("data:")) {
        return false;
      }

      if (isNoisyImage(candidate.descriptor)) {
        return false;
      }

      const detectedMin = Math.min(candidate.width || 9999, candidate.height || 9999);
      if (detectedMin > 0 && detectedMin < MEANINGFUL_IMAGE_MIN_SIZE) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.score - left.score);
}

function findMeaningfulImage($, selectors) {
  for (const selector of selectors) {
    const [best] = collectImageCandidates($, selector);
    if (best?.src) {
      return best.src;
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

export async function scrapeArticleMetadata(link, existingSnippet = "") {
  const cacheKey = canonicalizeUrl(link);
  if (scrapeCache.has(cacheKey)) {
    return scrapeCache.get(cacheKey);
  }

  const pending = (async () => {
    try {
      const html = await requestHtml(link);
      const $ = cheerio.load(html);
      const ogImage = $('meta[property="og:image"]').attr("content");
      const twitterImage = $('meta[name="twitter:image"]').attr("content");
      const canonicalUrl = $('link[rel="canonical"]').attr("href");
      const articleImage = findMeaningfulImage($, [
        "article img",
        "main article img",
        ".article-content img",
        ".entry-content img",
        ".post-content img",
        ".content img",
        "[itemprop='articleBody'] img",
        "main img",
        "[role='main'] img"
      ]);
      const pageImage = findMeaningfulImage($, [
        "figure img",
        "main img",
        "[role='main'] img",
        "img"
      ]);
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
      const thumbnailSource = ogImage
        ? "og:image"
        : twitterImage
          ? "twitter:image"
          : articleImage
            ? "article-image"
            : pageImage
              ? "page-image"
              : "placeholder";
      const resolvedThumbnail = normalizeText(
        resolveImageCandidate(link, ogImage || twitterImage || articleImage || pageImage),
        env.placeholderImage
      );

      console.log(`Thumbnail source for ${link}: ${thumbnailSource}`);

      return {
        thumbnail: resolvedThumbnail,
        canonicalLink: canonicalizeUrl(normalizeText(canonicalUrl, link)),
        metaDescription: sanitizeFeedText(metaDescription, ""),
        contentSnippet: sanitizeFeedText(articleText || existingSnippet, existingSnippet),
        language: normalizeText(htmlLang, "unknown"),
        fetchStatus:
          ogImage || twitterImage || articleImage || pageImage || canonicalUrl || metaDescription || articleText
            ? "enriched"
            : "partial"
      };
    } catch (error) {
      console.error(`Thumbnail scrape failed for ${link}:`, error?.stack || error);
      console.log(`Thumbnail source for ${link}: placeholder`);
      return {
        thumbnail: env.placeholderImage,
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

  const enriched = await scrapeArticleMetadata(article.link, article.contentSnippet || article.summary || "");
  const nextThumbnail =
    article.thumbnail && article.thumbnail !== env.placeholderImage ? article.thumbnail : enriched.thumbnail;

  const updatedArticle = await updateArticle(articleId, {
    thumbnail: nextThumbnail,
    canonicalLink: enriched.canonicalLink || article.canonicalLink,
    contentSnippet: enriched.contentSnippet || article.contentSnippet,
    language: enriched.language || article.language,
    fetchStatus: enriched.fetchStatus
  });

  broadcast("article:update", {
    type: "article:update",
    article: updatedArticle
  });
}
