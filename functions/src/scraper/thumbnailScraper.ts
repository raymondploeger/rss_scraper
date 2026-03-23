import axios from "axios";
import * as cheerio from "cheerio";
import { EnrichmentResult } from "../types";
import {
  PLACEHOLDER_THUMBNAIL,
  SCRAPE_MAX_CONTENT_LENGTH,
  SCRAPE_RETRY_ATTEMPTS,
  SCRAPE_TIMEOUT_MS,
  USER_AGENT,
} from "../config/constants";
import { canonicalizeUrl, normalizeText, resolveUrl, sanitizeFeedText } from "../utils/text";

const scrapeCache = new Map<string, Promise<EnrichmentResult>>();

async function requestHtml(url: string, attempt = 0): Promise<string> {
  try {
    const response = await axios.get(url, {
      timeout: SCRAPE_TIMEOUT_MS,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      responseType: "text",
      maxRedirects: 5,
      maxContentLength: SCRAPE_MAX_CONTENT_LENGTH,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = String(response.headers["content-type"] || "");
    if (!contentType.includes("text/html")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }

    return String(response.data || "");
  } catch (error) {
    if (attempt < SCRAPE_RETRY_ATTEMPTS) {
      return requestHtml(url, attempt + 1);
    }

    throw error;
  }
}

export async function enrichArticleMetadata(link: string, existingSnippet = ""): Promise<EnrichmentResult> {
  const cacheKey = canonicalizeUrl(link);
  if (scrapeCache.has(cacheKey)) {
    return scrapeCache.get(cacheKey) as Promise<EnrichmentResult>;
  }

  const scrapePromise: Promise<EnrichmentResult> = (async () => {
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
    const metaTitle = $('meta[property="og:title"]').attr("content") || $("title").first().text();
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
        PLACEHOLDER_THUMBNAIL,
      ),
      canonicalLink: canonicalizeUrl(normalizeText(canonicalUrl, link)),
      metaTitle: sanitizeFeedText(metaTitle, ""),
      metaDescription: sanitizeFeedText(metaDescription, ""),
      contentSnippet: sanitizeFeedText(articleText || existingSnippet, existingSnippet),
      language: normalizeText(htmlLang, "unknown"),
      fetchStatus:
        ogImage || ogSecureImage || twitterImage || articleImage || canonicalUrl || metaDescription || articleText
          ? "enriched"
          : "partial",
    };
  } catch {
    return {
      thumbnail: PLACEHOLDER_THUMBNAIL,
      canonicalLink: canonicalizeUrl(link),
      metaTitle: "",
      metaDescription: "",
      contentSnippet: existingSnippet,
      language: "unknown",
      fetchStatus: "failed",
    };
  }
  })();

  scrapeCache.set(cacheKey, scrapePromise);
  return scrapePromise;
}
