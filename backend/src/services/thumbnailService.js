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
const IMAGE_SCRAPE_FAIL_FAST_STATUSES = new Set([401, 403, 406, 429, 503]);

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

function isGoogleNewsHost(hostname) {
  const normalized = String(hostname || "").replace(/^www\./, "").toLowerCase();
  return normalized === "news.google.com" || normalized.endsWith(".news.google.com");
}

function isGoogleNewsArticleUrl(value) {
  return isGoogleNewsHost(getDomainForDiagnostics(value));
}

export function isGoogleNewsPlaceholderImage(value) {
  const hostname = getDomainForDiagnostics(value);
  if (!hostname) {
    return false;
  }

  return (
    isGoogleNewsHost(hostname) ||
    hostname.includes("googleusercontent.com") ||
    hostname.includes("gstatic.com")
  );
}

export function isMalformedSicpaThumbnailUrl(value) {
  return /^https:\/\/(?:www\.)?sicpa\.com[^/?#]/i.test(String(value || "").trim());
}

function isSicpaDrupalArticleImage(value) {
  try {
    const parsed = new URL(String(value || ""));
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return hostname === "sicpa.com" && parsed.pathname.includes("/sites/default/files/");
  } catch {
    return false;
  }
}

function isGovUkPublishingAssetImage(value) {
  try {
    const parsed = new URL(String(value || ""));
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return hostname === "assets.publishing.service.gov.uk" && parsed.pathname.includes("/media/");
  } catch {
    return false;
  }
}

function decodeBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractNonGoogleUrl(value) {
  const matches = String(value || "").match(/https?:\/\/[^\s"'<>\\\u0000]+/gi) || [];
  for (const candidate of matches) {
    const hostname = getDomainForDiagnostics(candidate);
    if (
      hostname &&
      !isGoogleNewsHost(hostname) &&
      !hostname.includes("google.com") &&
      !hostname.includes("googleusercontent.com") &&
      !hostname.includes("gstatic.com")
    ) {
      return canonicalizeUrl(candidate);
    }
  }
  return "";
}

function decodeOriginalPublisherUrlFromGoogleNewsRss(link) {
  try {
    const parsed = new URL(String(link || ""));
    const match = parsed.pathname.match(/\/rss\/articles\/([^/?#]+)/i);
    if (!match?.[1]) {
      return "";
    }

    const decoded = decodeBase64Url(match[1]);
    return extractNonGoogleUrl(decoded);
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

export function isLikelyGenericMetadataImage(imageUrl) {
  const value = String(imageUrl || "").toLowerCase();

  if (isSicpaDrupalArticleImage(imageUrl)) {
    return false;
  }

  if (isGovUkPublishingAssetImage(imageUrl)) {
    return false;
  }

  let filename = value;
  try {
    const parsed = new URL(imageUrl);
    filename = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    filename = value.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || value;
  }

  const normalizedFilename = filename.toLowerCase();
  const hasGenericFilename = [
    /^default(?:[-_.]|$)/,
    /(?:^|[-_.])default(?:[-_.]|$)/,
    /^no[-_.]?image(?:[-_.]|$)/,
  ].some((pattern) => pattern.test(normalizedFilename));

  return hasGenericFilename || [
    "logo",
    "icon",
    "favicon",
    "avatar",
    "banner",
    "opengraph-image",
    "govuk-opengraph-image",
    "govuk-schema-placeholder",
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

function collectMetaImageCandidates($, selector, pageUrl, source) {
  return $(selector)
    .map((_, element) => {
      const content = $(element).attr("content") || "";
      const url = resolveImageCandidate(pageUrl, content);
      return url ? { url, source } : null;
    })
    .get()
    .filter(Boolean);
}

function isRejectedGoogleNewsImage(imageUrl, pageUrl) {
  return isGoogleNewsArticleUrl(pageUrl) && isGoogleNewsPlaceholderImage(imageUrl);
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
      .find(
        (value) =>
          value &&
          !isLikelyGenericMetadataImage(value) &&
          !isRejectedGoogleNewsImage(value, pageUrl)
      );
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
    googleNewsPlaceholderDetected: diagnostic.googleNewsPlaceholderDetected,
    originalPublisherResolved: diagnostic.originalPublisherResolved,
    thumbnailSource: diagnostic.thumbnailSource,
    rssThumbnailUsed: diagnostic.rssThumbnailUsed,
    rejectedReason: diagnostic.rejectedReasons.join(", ") || "no_valid_image_found",
  });
}

function buildHtmlRequestHeaders() {
  return {
    "User-Agent": "RSS Monitor Dashboard/2.0",
    Accept: "text/html,application/xhtml+xml"
  };
}

async function requestHtml(url, attempt = 0) {
  try {
    const response = await axios.get(url, {
      timeout: env.requestTimeoutMs,
      headers: buildHtmlRequestHeaders(),
      responseType: "text",
      maxRedirects: 5,
      maxContentLength: 1024 * 1024 * 2,
      validateStatus: (status) => status >= 200 && status < 400
    });

    const contentType = String(response.headers["content-type"] || "");
    if (!contentType.includes("text/html")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }

    return {
      html: String(response.data || ""),
      statusCode: Number(response.status || 0),
      finalUrl:
        normalizeText(response?.request?.res?.responseUrl, "") ||
        normalizeText(response?.config?.url, "") ||
        url,
    };
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    if (IMAGE_SCRAPE_FAIL_FAST_STATUSES.has(status)) {
      throw new Error(`Blocked content fetch (${status})`);
    }
    if (attempt < env.scrapeRetryAttempts) {
      return requestHtml(url, attempt + 1);
    }

    throw error;
  }
}

async function requestHtmlWithRedirectChain(url, attempt = 0) {
  const redirectChain = [];
  let currentUrl = url;

  try {
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      const response = await axios.get(currentUrl, {
        timeout: env.requestTimeoutMs,
        headers: buildHtmlRequestHeaders(),
        responseType: "text",
        maxRedirects: 0,
        maxContentLength: 1024 * 1024 * 2,
        validateStatus: (status) => status >= 200 && status < 400
      });

      const location = normalizeText(response.headers?.location, "");
      redirectChain.push({
        url: currentUrl,
        status: Number(response.status || 0),
        location
      });

      if ([301, 302, 303, 307, 308].includes(Number(response.status || 0)) && location) {
        currentUrl = resolveUrl(currentUrl, location);
        continue;
      }

      const contentType = String(response.headers["content-type"] || "");
      if (!contentType.includes("text/html")) {
        throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
      }

      return {
        html: String(response.data || ""),
        statusCode: Number(response.status || 0),
        finalUrl: currentUrl,
        headers: response.headers || {},
        redirectChain,
      };
    }

    throw new Error("Too many redirects");
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    if (IMAGE_SCRAPE_FAIL_FAST_STATUSES.has(status)) {
      throw new Error(`Blocked content fetch (${status})`);
    }
    if (attempt < env.scrapeRetryAttempts) {
      return requestHtmlWithRedirectChain(url, attempt + 1);
    }
    throw error;
  }
}

function hasNewsLikePublisherUrl(value) {
  const normalized = String(value || "").toLowerCase();
  return [
    "/news/",
    "/press/",
    "/media/",
    "/blog/",
    "/article/",
    "/announcement/",
    "/case-study/",
    "/case-studies/",
  ].some((segment) => normalized.includes(segment));
}

function resolveGoogleNewsPublisherCandidate(baseUrl, candidate) {
  const resolved = resolveImageCandidate(baseUrl, candidate);
  if (!resolved) {
    return "";
  }

  const hostname = getDomainForDiagnostics(resolved);
  if (
    !hostname ||
    isGoogleNewsHost(hostname) ||
    hostname.includes("google.com") ||
    hostname.includes("googleusercontent.com") ||
    hostname.includes("gstatic.com")
  ) {
    return "";
  }

  return canonicalizeUrl(resolved);
}

function extractOriginalPublisherUrlFromGoogleNews($, pageUrl) {
  const prioritizedCandidates = [];
  const fallbackCandidates = [];

  const pushCandidate = (candidate, priority = "fallback") => {
    const resolved = resolveGoogleNewsPublisherCandidate(pageUrl, candidate);
    if (!resolved) {
      return;
    }

    if (priority === "priority") {
      prioritizedCandidates.push(resolved);
      return;
    }

    fallbackCandidates.push(resolved);
  };

  pushCandidate($('link[rel="canonical"]').attr("href"), "priority");
  pushCandidate($('meta[property="og:url"]').attr("content"), "priority");
  pushCandidate($('meta[name="twitter:url"]').attr("content"), "priority");

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const text = normalizeText($(element).text(), "").toLowerCase();
    const priority =
      text.includes("read full article") ||
      text.includes("full coverage") ||
      text.includes("original") ||
      text.includes("publisher") ||
      hasNewsLikePublisherUrl(String(href || ""))
        ? "priority"
        : "fallback";
    pushCandidate(href, priority);
  });

  const dedupedPriority = Array.from(new Set(prioritizedCandidates));
  if (dedupedPriority.length) {
    return dedupedPriority[0];
  }

  const dedupedFallback = Array.from(new Set(fallbackCandidates));
  return dedupedFallback[0] || "";
}

function collectPublisherUrlCandidatesFromGoogleNewsDocument($, pageUrl, rawHtml = "") {
  const candidates = [];

  const pushCandidate = (candidate, method) => {
    const resolved = resolveGoogleNewsPublisherCandidate(pageUrl, candidate);
    if (!resolved) {
      return;
    }
    candidates.push({
      url: resolved,
      method,
      domain: getDomainForDiagnostics(resolved),
    });
  };

  pushCandidate($('link[rel="canonical"]').attr("href"), "canonical-link");
  pushCandidate($('meta[property="og:url"]').attr("content"), "og-url");
  pushCandidate($('meta[name="twitter:url"]').attr("content"), "twitter-url");

  $("a[href]").each((_, element) => {
    pushCandidate($(element).attr("href"), "anchor-href");
  });

  const htmlUrlMatches = String(rawHtml || "").match(/https?:\/\/[^\s"'<>\\]+/gi) || [];
  htmlUrlMatches.forEach((match) => pushCandidate(match, "html-regex"));

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate.url)) {
      continue;
    }
    seen.add(candidate.url);
    deduped.push(candidate);
  }

  return deduped;
}

export async function analyzeGoogleNewsPublisherUrl(link) {
  const originalRssUrl = String(link || "").trim();
  const decodedPublisherUrl = decodeOriginalPublisherUrlFromGoogleNewsRss(originalRssUrl);

  const result = {
    originalRssUrl,
    attemptedUrl: originalRssUrl,
    httpStatus: 0,
    redirectChain: [],
    finalUrl: "",
    canonicalUrl: "",
    publisherUrlCandidates: [],
    extractionMethodUsed: "",
    resolvedPublisherUrl: "",
    failureReason: "",
  };

  if (!originalRssUrl) {
    result.failureReason = "missing_url";
    return result;
  }

  if (decodedPublisherUrl) {
    result.publisherUrlCandidates.push({
      url: decodedPublisherUrl,
      method: "rss-path-decode",
      domain: getDomainForDiagnostics(decodedPublisherUrl),
    });
    result.extractionMethodUsed = "rss-path-decode";
    result.resolvedPublisherUrl = decodedPublisherUrl;
  }

  try {
    const response = await requestHtmlWithRedirectChain(originalRssUrl);
    result.httpStatus = Number(response.statusCode || 0);
    result.redirectChain = response.redirectChain || [];
    result.finalUrl = normalizeText(response.finalUrl, originalRssUrl);

    if (!result.resolvedPublisherUrl && result.finalUrl && !isGoogleNewsArticleUrl(result.finalUrl)) {
      result.publisherUrlCandidates.push({
        url: canonicalizeUrl(result.finalUrl),
        method: "http-redirect",
        domain: getDomainForDiagnostics(result.finalUrl),
      });
      result.extractionMethodUsed = "http-redirect";
      result.resolvedPublisherUrl = canonicalizeUrl(result.finalUrl);
    }

    const $ = cheerio.load(response.html);
    const canonicalUrl = normalizeText($('link[rel="canonical"]').attr("href"), "");
    result.canonicalUrl = canonicalUrl ? canonicalizeUrl(resolveUrl(result.finalUrl || originalRssUrl, canonicalUrl)) : "";

    const htmlCandidates = collectPublisherUrlCandidatesFromGoogleNewsDocument(
      $,
      result.finalUrl || originalRssUrl,
      response.html
    );

    for (const candidate of htmlCandidates) {
      if (!result.publisherUrlCandidates.some((existing) => existing.url === candidate.url)) {
        result.publisherUrlCandidates.push(candidate);
      }
    }

    if (!result.resolvedPublisherUrl && htmlCandidates.length) {
      result.extractionMethodUsed = htmlCandidates[0].method;
      result.resolvedPublisherUrl = htmlCandidates[0].url;
    }
  } catch (error) {
    result.failureReason =
      error instanceof Error && /Unsupported content type/i.test(error.message)
        ? "unsupported_content_type"
        : error instanceof Error && /Blocked content fetch \((\d+)\)/i.test(error.message)
          ? `blocked_status_${error.message.match(/(\d+)/)?.[1] || "unknown"}`
          : "request_failed";
    return result;
  }

  if (!result.resolvedPublisherUrl) {
    result.failureReason = "no_publisher_url_found";
  }

  return result;
}

export async function scrapeArticleMetadata(link, existingSnippet = "", articleTitle = "", options = {}) {
  const existingThumbnail = normalizeText(options.existingThumbnail, "");
  const rssThumbnailSource = normalizeText(options.rssThumbnailSource, "");
  const cacheKey = `${canonicalizeUrl(link)}|${existingThumbnail}|${rssThumbnailSource}`;
  if (scrapeCache.has(cacheKey)) {
    return scrapeCache.get(cacheKey);
  }

  const pending = (async () => {
    try {
      const googleNewsPlaceholderDetected = isGoogleNewsPlaceholderImage(existingThumbnail);
      const fallbackGoogleNewsThumbnail =
        googleNewsPlaceholderDetected && existingThumbnail !== env.placeholderImage ? existingThumbnail : "";
      if (existingThumbnail && existingThumbnail !== env.placeholderImage && !googleNewsPlaceholderDetected) {
        const diagnostic = {
          domain: getDomainForDiagnostics(link),
          link,
          ogImageFound: false,
          twitterImageFound: false,
          schemaImageFound: false,
          articleImageFound: false,
          googleNewsPlaceholderDetected: false,
          originalPublisherResolved: false,
          rejectedReasons: [],
          finalThumbnail: existingThumbnail,
          thumbnailSource: rssThumbnailSource || "rss-existing",
          rssThumbnailUsed: true,
        };

        logImageExtraction(link, diagnostic.thumbnailSource, {
          usedThumbnail: existingThumbnail,
          googleNewsPlaceholderDetected: false,
          originalPublisherResolved: false,
          rssThumbnailUsed: true,
        });

        return {
          thumbnail: existingThumbnail,
          canonicalLink: canonicalizeUrl(link),
          metaDescription: "",
          contentSnippet: existingSnippet,
          language: "unknown",
          imageDiagnostic: diagnostic,
          thumbnailSource: diagnostic.thumbnailSource,
          fetchStatus: "partial"
        };
      }

      let scrapeTargetUrl = link;
      let originalPublisherResolved = false;
      let resolutionMethod = "";
      let resolutionFailureReason = "";
      let initialResponse = await requestHtml(link);
      let activeHtml = initialResponse.html;
      let activeUrl = normalizeText(initialResponse.finalUrl, link);
      const initialStatusCode = Number(initialResponse.statusCode || 0);
      const initialAttemptedUrl = link;
      const initialFinalUrl = activeUrl;

      if (isGoogleNewsArticleUrl(link)) {
        const googleNewsDocument = cheerio.load(activeHtml);
        const decodedPublisherUrl = decodeOriginalPublisherUrlFromGoogleNewsRss(link);
        const redirectedPublisherUrl = resolveGoogleNewsPublisherCandidate(activeUrl, activeUrl);
        const extractedPublisherUrl = extractOriginalPublisherUrlFromGoogleNews(googleNewsDocument, activeUrl);
        const resolvedPublisherUrl =
          decodedPublisherUrl || redirectedPublisherUrl || extractedPublisherUrl;

        if (decodedPublisherUrl) {
          resolutionMethod = "rss-path-decode";
        } else if (redirectedPublisherUrl) {
          resolutionMethod = "http-redirect";
        } else if (extractedPublisherUrl) {
          resolutionMethod = "html-link-extract";
        } else {
          resolutionFailureReason = "no_publisher_url_found";
        }

        if (resolvedPublisherUrl && !isGoogleNewsArticleUrl(resolvedPublisherUrl)) {
          originalPublisherResolved = true;
          scrapeTargetUrl = resolvedPublisherUrl;
          if (canonicalizeUrl(resolvedPublisherUrl) !== canonicalizeUrl(activeUrl)) {
            const resolvedResponse = await requestHtml(resolvedPublisherUrl);
            activeHtml = resolvedResponse.html;
            activeUrl = normalizeText(resolvedResponse.finalUrl, resolvedPublisherUrl);
          } else {
            activeUrl = resolvedPublisherUrl;
          }
        }
      }

      const $ = cheerio.load(activeHtml);
      const ogImages = collectMetaImageCandidates($, 'meta[property="og:image"]', activeUrl, "og-image");
      const ogSecureImages = collectMetaImageCandidates($, 'meta[property="og:image:secure_url"]', activeUrl, "og-image");
      const twitterImages = collectMetaImageCandidates($, 'meta[name="twitter:image"]', activeUrl, "twitter-image");
      const schemaImageResult = extractSchemaImage($, activeUrl);
      const canonicalUrl = $('link[rel="canonical"]').attr("href");
      const articleImageResult = findMeaningfulImage($, activeUrl);
      const fallbackArticleImage = findFirstValidArticleImage($, activeUrl);
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
        ...ogImages,
        ...ogSecureImages,
        ...twitterImages,
        { url: resolveImageCandidate(activeUrl, schemaImageResult.url || ""), source: "schema-image" },
      ].filter(
        (candidate) =>
          candidate.url &&
          !isMalformedSicpaThumbnailUrl(candidate.url) &&
          !isLikelyGenericMetadataImage(candidate.url) &&
          !isRejectedGoogleNewsImage(candidate.url, link)
      );
      if ((ogImages.length || ogSecureImages.length) && !metadataCandidates.some((candidate) => candidate.source === "og-image")) {
        rejectedReasons.push("og_image_generic");
      }
      if (twitterImages.length && !metadataCandidates.some((candidate) => candidate.source === "twitter-image")) {
        rejectedReasons.push("twitter_image_generic");
      }
      rejectedReasons.push(...schemaImageResult.rejectedReasons);
      const articleSpecificMetadata = metadataCandidates.find((candidate) =>
        isClearlyArticleSpecificImage(candidate.url, activeUrl, articleTitle)
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
        || (articleImageCandidate ? { url: resolveImageCandidate(activeUrl, articleImageCandidate), source: "article-image" } : null);
      const resolvedThumbnail = normalizeText(selectedCandidate?.url, fallbackGoogleNewsThumbnail);
      const thumbnailSource = selectedCandidate?.source || (fallbackGoogleNewsThumbnail ? "google-news" : "fallback");
      const diagnostic = {
        domain: getDomainForDiagnostics(activeUrl || link),
        link: scrapeTargetUrl,
        attemptedUrl: initialAttemptedUrl,
        httpStatus: initialStatusCode,
        finalUrl: initialFinalUrl,
        resolvedPublisherUrl: originalPublisherResolved ? scrapeTargetUrl : "",
        resolutionMethod,
        failureReason: resolutionFailureReason,
        ogImageFound: Boolean(ogImages.length || ogSecureImages.length),
        twitterImageFound: Boolean(twitterImages.length),
        schemaImageFound: Boolean(schemaImageResult.found),
        articleImageFound: Boolean(articleImageResult.found || fallbackArticleImage),
        googleNewsPlaceholderDetected,
        originalPublisherResolved,
        rejectedReasons: Array.from(new Set(rejectedReasons)).filter(Boolean),
        finalThumbnail: resolvedThumbnail,
        thumbnailSource,
        rssThumbnailUsed: false,
      };

      logImageExtraction(link, thumbnailSource, {
        usedThumbnail: resolvedThumbnail,
        googleNewsPlaceholderDetected,
        originalPublisherResolved,
        rssThumbnailUsed: false,
      });
      logImageDebug(diagnostic);
      if (isNotafiliaUrl(link)) {
        console.log(
          `[notafilia][enrich] articleUrl=${link} ogImageFound=${Boolean(articleSpecificMetadata?.url)} ogImageValue=${articleSpecificMetadata?.url || ""} articleImageFound=${Boolean(articleImageCandidate)} articleImageValue=${articleImageCandidate || ""} finalThumbnail=${resolvedThumbnail || ""}`
        );
      }

      return {
        thumbnail: resolvedThumbnail,
        canonicalLink: canonicalizeUrl(normalizeText(canonicalUrl, activeUrl || scrapeTargetUrl || link)),
        metaDescription: sanitizeFeedText(metaDescription, ""),
        contentSnippet: sanitizeFeedText(articleText || existingSnippet, existingSnippet),
        language: normalizeText(htmlLang, "unknown"),
        imageDiagnostic: diagnostic,
        thumbnailSource,
        fetchStatus:
          resolvedThumbnail || canonicalUrl || metaDescription || articleText
            ? "enriched"
            : "partial"
      };
    } catch (error) {
      console.error(`Thumbnail scrape failed for ${link}:`, error?.stack || error);
      logImageExtraction(link, "fallback", {
        googleNewsPlaceholderDetected: isGoogleNewsPlaceholderImage(existingThumbnail),
        originalPublisherResolved: false,
        rssThumbnailUsed: false,
      });
      const diagnostic = {
        domain: getDomainForDiagnostics(link),
        link,
        attemptedUrl: link,
        httpStatus: Number(error?.response?.status || 0),
        finalUrl: "",
        resolvedPublisherUrl: "",
        resolutionMethod: "",
        failureReason:
          error instanceof Error && /Unsupported content type/i.test(error.message)
            ? "unsupported_content_type"
            : error instanceof Error && /Blocked content fetch \((\d+)\)/i.test(error.message)
              ? `blocked_status_${error.message.match(/(\d+)/)?.[1] || "unknown"}`
              : "request_failed",
        ogImageFound: false,
        twitterImageFound: false,
        schemaImageFound: false,
        articleImageFound: false,
        googleNewsPlaceholderDetected: isGoogleNewsPlaceholderImage(existingThumbnail),
        originalPublisherResolved: false,
        rejectedReasons: [
          error instanceof Error && /Unsupported content type/i.test(error.message)
            ? "unsupported_content_type"
            : error instanceof Error && /Blocked content fetch \((\d+)\)/i.test(error.message)
              ? `blocked_status_${error.message.match(/(\d+)/)?.[1] || "unknown"}`
              : "request_failed",
        ],
        finalThumbnail:
          isGoogleNewsPlaceholderImage(existingThumbnail) && existingThumbnail !== env.placeholderImage
            ? existingThumbnail
            : "",
        thumbnailSource:
          isGoogleNewsPlaceholderImage(existingThumbnail) && existingThumbnail !== env.placeholderImage
            ? "google-news"
            : "fallback",
        rssThumbnailUsed: Boolean(
          isGoogleNewsPlaceholderImage(existingThumbnail) && existingThumbnail !== env.placeholderImage
        ),
      };
      logImageDebug(diagnostic);
      if (isNotafiliaUrl(link)) {
        console.log(`[notafilia][enrich] articleUrl=${link} ogImageFound=false articleImageFound=false finalThumbnail=`);
      }
      return {
        thumbnail: diagnostic.finalThumbnail,
        canonicalLink: canonicalizeUrl(link),
        metaDescription: "",
        contentSnippet: existingSnippet,
        language: "unknown",
        imageDiagnostic: diagnostic,
        thumbnailSource: diagnostic.thumbnailSource,
        fetchStatus: "failed"
      };
    }
  })();

  scrapeCache.set(cacheKey, pending);
  return pending;
}

export async function diagnoseArticleImage(link, existingSnippet = "", articleTitle = "", options = {}) {
  const result = await scrapeArticleMetadata(link, existingSnippet, articleTitle, options);
  return result?.imageDiagnostic || {
    domain: getDomainForDiagnostics(link),
    link,
    attemptedUrl: link,
    httpStatus: 0,
    finalUrl: "",
    resolvedPublisherUrl: "",
    resolutionMethod: "",
    failureReason: "unknown",
    ogImageFound: false,
    twitterImageFound: false,
    schemaImageFound: false,
    articleImageFound: false,
    googleNewsPlaceholderDetected: false,
    originalPublisherResolved: false,
    rejectedReasons: ["unknown"],
    finalThumbnail: normalizeText(result?.thumbnail, ""),
    thumbnailSource: result?.thumbnailSource || result?.imageDiagnostic?.thumbnailSource || "",
    rssThumbnailUsed: Boolean(result?.imageDiagnostic?.rssThumbnailUsed),
  };
}

export async function enrichArticle(articleId) {
  const article = await findArticleById(articleId);
  if (!article) {
    return;
  }

  if (
    article.thumbnail &&
    article.thumbnail !== env.placeholderImage &&
    !isGoogleNewsPlaceholderImage(article.thumbnail) &&
    !isLikelyGenericMetadataImage(article.thumbnail)
  ) {
    return article;
  }

  const enriched = await scrapeArticleMetadata(
    article.link,
    article.contentSnippet || article.summary || "",
    article.title || "",
    {
      existingThumbnail: article.thumbnail,
      rssThumbnailSource: article.thumbnail && article.thumbnail !== env.placeholderImage ? "article-existing" : "",
    }
  );
  const nextThumbnail =
    article.thumbnail &&
    article.thumbnail !== env.placeholderImage &&
    !isGoogleNewsPlaceholderImage(article.thumbnail) &&
    !isLikelyGenericMetadataImage(article.thumbnail)
      ? article.thumbnail
      : enriched.thumbnail || article.thumbnail;

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
