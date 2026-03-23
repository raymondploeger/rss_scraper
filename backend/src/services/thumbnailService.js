import axios from "axios";
import * as cheerio from "cheerio";
import { env } from "../config/env.js";
import { findArticleById, updateArticle } from "../database/articleRepository.js";
import { broadcast } from "./realtimeService.js";
import { canonicalizeUrl, normalizeText, resolveUrl, sanitizeFeedText } from "../utils/text.js";

const scrapeCache = new Map();

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
      const ogSecureImage = $('meta[property="og:image:secure_url"]').attr("content");
      const twitterImage = $('meta[name="twitter:image"]').attr("content");
      const canonicalUrl = $('link[rel="canonical"]').attr("href");
      const articleImage =
        $("article img").first().attr("src") ||
        $("figure img").first().attr("src") ||
        $(".wp-post-image").first().attr("src") ||
        $('img[src*="/wp-content/uploads/"]').first().attr("src") ||
        "";
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

      return {
        thumbnail: normalizeText(
          resolveUrl(link, ogImage || ogSecureImage || twitterImage || articleImage || ""),
          env.placeholderImage
        ),
        canonicalLink: canonicalizeUrl(normalizeText(canonicalUrl, link)),
        metaDescription: sanitizeFeedText(metaDescription, ""),
        contentSnippet: sanitizeFeedText(articleText || existingSnippet, existingSnippet),
        language: normalizeText(htmlLang, "unknown"),
        fetchStatus:
          ogImage || ogSecureImage || twitterImage || articleImage || canonicalUrl || metaDescription || articleText
            ? "enriched"
            : "partial"
      };
    } catch {
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
