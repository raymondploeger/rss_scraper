import axios from "axios";
import * as cheerio from "cheerio";
import { env } from "../config/env.js";
import { findArticleById, updateArticle } from "../database/articleRepository.js";
import { broadcast } from "./realtimeService.js";
import { canonicalizeUrl, normalizeText, resolveUrl, sanitizeFeedText } from "../utils/text.js";

const scrapeCache = new Map();
const DEBUG_IMAGE_EXTRACTION =
  process.env.NODE_ENV !== "production" &&
  String(process.env.DEBUG_IMAGE_EXTRACTION || "").trim().toLowerCase() === "true";

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

function getDomainForDiagnostics(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
    "favicon",
    "avatar",
    "banner",
    "default",
    "placeholder",
    "siteimage",
    "social-share",
    "share-image",
    "og-image",
    "media-image",
    "sprite",
    "tracking",
    "pixel",
  ].some((token) => value.includes(token));
}

function parseNumericDimension(value) {
  const match = String(value || "").match(/(\d{2,5})/);
  return match ? Number(match[1]) : 0;
}

function isAcceptableImageSize(width, height) {
  if (width && width < 300) {
    return false;
  }
  if (!width && height && height < 180) {
    return false;
  }
  return true;
}

function pickImageFromSrcset(value) {
  return String(value || "")
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .find(Boolean) || "";
}

function resolveNodeImageCandidate(pageUrl, node) {
  return (
    node.attr("src") ||
    node.attr("data-src") ||
    node.attr("data-lazy-src") ||
    node.attr("data-original") ||
    pickImageFromSrcset(node.attr("srcset") || node.attr("data-srcset")) ||
    ""
  )
    ? resolveImageCandidate(
      pageUrl,
      node.attr("src") ||
        node.attr("data-src") ||
        node.attr("data-lazy-src") ||
        node.attr("data-original") ||
        pickImageFromSrcset(node.attr("srcset") || node.attr("data-srcset")) ||
        ""
    )
    : "";
}

function collectSchemaImagesFromValue(value, results) {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    results.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectSchemaImagesFromValue(entry, results));
    return;
  }

  if (typeof value === "object") {
    if (typeof value.url === "string") {
      results.push(value.url);
    }
    if (typeof value.contentUrl === "string") {
      results.push(value.contentUrl);
    }
    if (value.image) {
      collectSchemaImagesFromValue(value.image, results);
    }
  }
}

function extractSchemaImage($, pageUrl) {
  const candidates = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      entries.forEach((entry) => {
        collectSchemaImagesFromValue(entry?.image, candidates);
        if (entry?.["@graph"]) {
          collectSchemaImagesFromValue(entry["@graph"], candidates);
        }
      });
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });

  const resolvedCandidates = candidates
    .map((candidate) => resolveImageCandidate(pageUrl, candidate))
    .filter(Boolean);
  const acceptedCandidate = resolvedCandidates.find((candidate) => !isLikelyGenericMetadataImage(candidate)) || "";

  return {
    url: acceptedCandidate,
    found: resolvedCandidates.length > 0,
    rejectedReasons: acceptedCandidate ? [] : resolvedCandidates.length ? ["schema_image_generic"] : [],
  };
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

function findMeaningfulImage($, pageUrl) {
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
  const candidates = [];
  const rejectedReasons = [];
  let foundAny = false;

  for (const selector of selectors) {
    $(selector).each((index, element) => {
      const node = $(element);
      const candidate = resolveNodeImageCandidate(pageUrl, node);
      if (!candidate) {
        return;
      }
      foundAny = true;
      if (isLikelyGenericMetadataImage(candidate)) {
        rejectedReasons.push("article_image_generic");
        return;
      }

      const width = parseNumericDimension(node.attr("width") || node.attr("data-width"));
      const height = parseNumericDimension(node.attr("height") || node.attr("data-height"));
      if (!isAcceptableImageSize(width, height)) {
        rejectedReasons.push(width && width < 300 ? "width_too_small" : "height_too_small");
        return;
      }

      candidates.push({
        url: candidate,
        width,
        height,
        selectorIndex: selectors.indexOf(selector),
        position: index,
      });
    });
  }

  const bestCandidate = candidates.sort((left, right) => {
    const leftArea = (left.width || 0) * (left.height || 0);
    const rightArea = (right.width || 0) * (right.height || 0);
    if (rightArea !== leftArea) {
      return rightArea - leftArea;
    }
    if ((right.width || 0) !== (left.width || 0)) {
      return (right.width || 0) - (left.width || 0);
    }
    if (left.selectorIndex !== right.selectorIndex) {
      return left.selectorIndex - right.selectorIndex;
    }
    return left.position - right.position;
  })[0];

  return {
    url: bestCandidate?.url || "",
    found: foundAny,
    rejectedReasons,
  };
}

function findFirstValidArticleImage($, pageUrl) {
  const selectors = [
    "article img",
    "main img",
    "[role='main'] img",
    ".article-content img",
    ".entry-content img",
    ".post-content img",
    ".content img",
    "img",
  ];

  for (const selector of selectors) {
    const candidate = $(selector)
      .map((_, element) => resolveNodeImageCandidate(pageUrl, $(element)))
      .get()
      .find((value) => value && !isLikelyGenericMetadataImage(value));
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function logImageExtraction(link, source, details = {}) {
  if (!DEBUG_IMAGE_EXTRACTION) {
    return;
  }

  console.log("[image-extract]", {
    link,
    source,
    ...details,
  });
}

function logImageDebug(diagnostic) {
  if (!DEBUG_IMAGE_EXTRACTION || !diagnostic || diagnostic.finalThumbnail) {
    return;
  }

  console.log("[image-debug]", {
    domain: diagnostic.domain,
    url: diagnostic.link,
    ogImage: diagnostic.ogImageFound,
    twitterImage: diagnostic.twitterImageFound,
    schemaImage: diagnostic.schemaImageFound,
    articleImage: diagnostic.articleImageFound,
    rejectedReason: diagnostic.rejectedReasons.join(", ") || "no_valid_image_found",
  });
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
      const schemaImageResult = extractSchemaImage($, link);
      const canonicalUrl = $('link[rel="canonical"]').attr("href");
      const articleImageResult = findMeaningfulImage($, link);
      const fallbackArticleImage = findFirstValidArticleImage($, link);
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
      const rejectedReasons = [];
      const metadataCandidates = [
        { url: resolveImageCandidate(link, ogImage || ""), source: "og:image" },
        { url: resolveImageCandidate(link, ogSecureImage || ""), source: "og:image:secure_url" },
        { url: resolveImageCandidate(link, twitterImage || ""), source: "twitter:image" },
        { url: resolveImageCandidate(link, schemaImageResult.url || ""), source: "schema-image" },
      ].filter((candidate) => candidate.url && !isLikelyGenericMetadataImage(candidate.url));
      if ((ogImage || ogSecureImage) && !metadataCandidates.some((candidate) => candidate.source.startsWith("og:image"))) {
        rejectedReasons.push("og_image_generic");
      }
      if (twitterImage && !metadataCandidates.some((candidate) => candidate.source === "twitter:image")) {
        rejectedReasons.push("twitter_image_generic");
      }
      rejectedReasons.push(...schemaImageResult.rejectedReasons);
      const articleSpecificMetadata = metadataCandidates.find((candidate) =>
        isClearlyArticleSpecificImage(candidate.url, link, articleTitle)
      );
      if (metadataCandidates.length && !articleSpecificMetadata) {
        rejectedReasons.push("metadata_not_article_specific");
      }
      const articleImageCandidate = normalizeText(articleImageResult.url || fallbackArticleImage, "");
      rejectedReasons.push(...articleImageResult.rejectedReasons);
      if (articleImageResult.found && !articleImageResult.url && fallbackArticleImage) {
        rejectedReasons.push("article_image_fallback_used");
      }
      const selectedCandidate = articleSpecificMetadata
        || (articleImageCandidate ? { url: resolveImageCandidate(link, articleImageCandidate), source: articleImageResult.url ? "article-image-largest" : "article-image" } : null);
      const resolvedThumbnail = normalizeText(selectedCandidate?.url, "");
      const thumbnailSource = selectedCandidate?.source || "fallback";
      const diagnostic = {
        domain: getDomainForDiagnostics(link),
        link,
        ogImageFound: Boolean(ogImage || ogSecureImage),
        twitterImageFound: Boolean(twitterImage),
        schemaImageFound: Boolean(schemaImageResult.found),
        articleImageFound: Boolean(articleImageResult.found || fallbackArticleImage),
        rejectedReasons: Array.from(new Set(rejectedReasons)).filter(Boolean),
        finalThumbnail: resolvedThumbnail,
        thumbnailSource,
      };

      logImageExtraction(link, thumbnailSource, {
        usedThumbnail: resolvedThumbnail,
      });
      logImageDebug(diagnostic);
      if (isNotafiliaUrl(link)) {
        console.log(
          `[notafilia][enrich] articleUrl=${link} ogImageFound=${Boolean(articleSpecificMetadata?.url)} ogImageValue=${articleSpecificMetadata?.url || ""} articleImageFound=${Boolean(articleImageCandidate)} articleImageValue=${articleImageCandidate || ""} finalThumbnail=${resolvedThumbnail || ""}`
        );
      }

      return {
        thumbnail: resolvedThumbnail,
        canonicalLink: canonicalizeUrl(normalizeText(canonicalUrl, link)),
        metaDescription: sanitizeFeedText(metaDescription, ""),
        contentSnippet: sanitizeFeedText(articleText || existingSnippet, existingSnippet),
        language: normalizeText(htmlLang, "unknown"),
        imageDiagnostic: diagnostic,
        fetchStatus:
          resolvedThumbnail || canonicalUrl || metaDescription || articleText
            ? "enriched"
            : "partial"
      };
    } catch (error) {
      console.error(`Thumbnail scrape failed for ${link}:`, error?.stack || error);
      logImageExtraction(link, "fallback");
      const diagnostic = {
        domain: getDomainForDiagnostics(link),
        link,
        ogImageFound: false,
        twitterImageFound: false,
        schemaImageFound: false,
        articleImageFound: false,
        rejectedReasons: [
          error instanceof Error && /Unsupported content type/i.test(error.message)
            ? "unsupported_content_type"
            : "request_failed",
        ],
        finalThumbnail: "",
        thumbnailSource: "fallback",
      };
      logImageDebug(diagnostic);
      if (isNotafiliaUrl(link)) {
        console.log(`[notafilia][enrich] articleUrl=${link} ogImageFound=false articleImageFound=false finalThumbnail=`);
      }
      return {
        thumbnail: "",
        canonicalLink: canonicalizeUrl(link),
        metaDescription: "",
        contentSnippet: existingSnippet,
        language: "unknown",
        imageDiagnostic: diagnostic,
        fetchStatus: "failed"
      };
    }
  })();

  scrapeCache.set(cacheKey, pending);
  return pending;
}

export async function diagnoseArticleImage(link, existingSnippet = "", articleTitle = "") {
  const result = await scrapeArticleMetadata(link, existingSnippet, articleTitle);
  return result?.imageDiagnostic || {
    domain: getDomainForDiagnostics(link),
    link,
    ogImageFound: false,
    twitterImageFound: false,
    schemaImageFound: false,
    articleImageFound: false,
    rejectedReasons: ["unknown"],
    finalThumbnail: normalizeText(result?.thumbnail, ""),
    thumbnailSource: result?.thumbnailSource || "",
  };
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
