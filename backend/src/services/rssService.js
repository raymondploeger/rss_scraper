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
import { articleMatchesSourceRelevanceRule, getSourceRelevanceAssessment } from "./sourceRelevanceService.js";
import { enrichArticle, isGoogleNewsPlaceholderImage, scrapeArticleMetadata } from "./thumbnailService.js";
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
      ["source", "source", { keepArray: true }],
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

const SICPA_NEWSROOM_URL = "https://www.sicpa.com/all-press-releases";
const SURYS_NEWSROOM_URL = "https://surys.com/surys-blog/";
const IQ_STRUCTURES_NEWSROOM_URL = "https://www.iqstructures.com/en/blog";
const CRANE_CURRENCY_NEWSROOM_URL = "https://www.cranecurrency.com/news-insights/";
const CRANE_CURRENCY_SITEMAP_URL = "https://www.cranecurrency.com/sitemap/";
const CRANE_CURRENCY_MAX_ARCHIVE_PAGES = 8;
const CRANE_CURRENCY_MAX_CANDIDATES = 80;

const VENDOR_FEED_LOG_CONFIG = [
  {
    label: "SICPA_NEWSROOM",
    rssUrl: SICPA_NEWSROOM_URL,
    name: "sicpa newsroom",
  },
  {
    label: "SURYS_NEWSROOM",
    rssUrl: SURYS_NEWSROOM_URL,
    name: "surys newsroom",
  },
  {
    label: "IQ_STRUCTURES_NEWSROOM",
    rssUrl: IQ_STRUCTURES_NEWSROOM_URL,
    name: "iq structures newsroom",
  },
  {
    label: "CRANE_CURRENCY_NEWSROOM",
    rssUrl: CRANE_CURRENCY_NEWSROOM_URL,
    name: "crane currency news & insights",
  },
];

function getVendorFeedLogLabel(feed) {
  if (!feed) {
    return "";
  }

  const normalizedUrl = String(feed.rssUrl || "").trim().toLowerCase();
  const normalizedName = String(feed.name || "").trim().toLowerCase();
  const matched = VENDOR_FEED_LOG_CONFIG.find(
    (entry) =>
      normalizedUrl === entry.rssUrl.toLowerCase() ||
      normalizedName === entry.name
  );

  return matched?.label || "";
}

function isSicpaNewsroomFeed(feed) {
  return (
    Boolean(feed) &&
    (String(feed.rssUrl || "").trim().toLowerCase() === SICPA_NEWSROOM_URL.toLowerCase() ||
      String(feed.name || "").trim().toLowerCase() === "sicpa newsroom")
  );
}

function isSurysNewsroomFeed(feed) {
  return (
    Boolean(feed) &&
    (String(feed.rssUrl || "").trim().toLowerCase() === SURYS_NEWSROOM_URL.toLowerCase() ||
      String(feed.name || "").trim().toLowerCase() === "surys newsroom")
  );
}

function isIqStructuresNewsroomFeed(feed) {
  return (
    Boolean(feed) &&
    (String(feed.rssUrl || "").trim().toLowerCase() === IQ_STRUCTURES_NEWSROOM_URL.toLowerCase() ||
      String(feed.name || "").trim().toLowerCase() === "iq structures newsroom")
  );
}

function isCraneCurrencyNewsroomFeed(feed) {
  return (
    Boolean(feed) &&
    (String(feed.rssUrl || "").trim().toLowerCase() === CRANE_CURRENCY_NEWSROOM_URL.toLowerCase() ||
      String(feed.name || "").trim().toLowerCase() === "crane currency news & insights")
  );
}

const WEBSITE_NAV_TITLE_PATTERNS = [
  "home",
  "projects",
  "downloads",
  "download",
  "support",
  "careers",
  "career",
  "jobs",
  "vacancies",
  "contact",
  "contact us",
  "about us",
  "imprint",
  "privacy",
  "privacy policy",
  "cookie policy",
  "terms",
  "legal",
  "sitemap",
  "search",
  "login",
  "register",
];

const WEBSITE_NAV_URL_SEGMENTS = [
  "/careers/",
  "/jobs/",
  "/support/",
  "/download/",
  "/downloads/",
  "/contact/",
  "/privacy/",
  "/imprint/",
  "/legal/",
  "/terms/",
  "/login/",
  "/sitemap/",
];

const WEBSITE_NEWS_CONTEXT_TERMS = ["newsroom", "news", "press", "media"];
const WEBSITE_NEWS_URL_SEGMENTS = [
  "/news/",
  "/press/",
  "/media/",
  "/blog/",
  "/article/",
  "/announcement/",
  "/case-study/",
  "/case-studies/",
];
const WEBSITE_MARKETING_TITLE_TERMS = [
  "solutions",
  "products",
  "portfolio",
  "capabilities",
  "services",
  "offerings",
  "identity management",
  "physical documents",
  "document readers",
];
const WEBSITE_MARKETING_URL_SEGMENTS = [
  "/solutions/",
  "/products/",
  "/portfolio/",
  "/capabilities/",
  "/services/",
  "/offerings/",
  "/identity-management/",
  "/physical-documents/",
  "/document-readers/",
];
const WEBSITE_PRODUCT_TITLE_TERMS = [
  "document readers",
  "document reader",
  "manual devices",
  "manual control devices",
  "verification devices",
  "identity verification devices",
  "biometric and document verification software",
  "biometric verification software",
  "border management egates",
  "border management solutions",
  "self kiosks",
  "self-kiosks",
  "seamless travel solutions",
  "identity management",
  "product overview",
  "solution overview",
  "our products",
  "our solutions",
];
const WEBSITE_PRODUCT_URL_SEGMENTS = [
  "/products/",
  "/product/",
  "/solutions/",
  "/solution/",
  "/services/",
  "/service/",
  "/platform/",
  "/portfolio/",
  "/capabilities/",
  "/offerings/",
  "/industries/",
  "/use-cases/",
  "/use-case/",
];
const WEBSITE_NEWS_INDICATOR_TERMS = [
  "published",
  "press release",
  "news release",
  "media release",
  "announcement",
  "announcements",
  "launch",
  "launched",
  "rollout",
  "deployment",
  "contract",
  "partnership",
  "award",
  "awarded",
  "implemented",
  "implementation",
  "expanded",
  "expansion",
  "case study",
  "case studies",
];
const VERIDOS_NEWS_CONTEXT_TERMS = ["press", "press release", "media", "news", "announcement", "announcements", "case study", "case studies"];
const DEBUG_ARTICLE_REJECTS =
  process.env.NODE_ENV !== "production" ||
  String(process.env.DEBUG_ARTICLE_REJECTS || "").trim().toLowerCase() === "true";
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

  if (["logo", "icon", "avatar", "pixel", "tracking"].some((token) => normalized.includes(token))) {
    return false;
  }

  const imageFilePattern = /\.(?:jpg|jpeg|png|gif|webp|avif|svg)(?:$|[?#])/i;
  if (imageFilePattern.test(normalized)) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname || pathname === "/") {
      return false;
    }
    if (/\.(?:html?|php|aspx?)(?:$|[?#])/i.test(pathname)) {
      return false;
    }
    return ["/image/", "/images/", "/media/", "/uploads/", "/files/", "/assets/"].some((segment) =>
      pathname.includes(segment)
    );
  } catch {
    return ["/image/", "/images/", "/media/", "/uploads/", "/files/", "/assets/"].some((segment) =>
      normalized.includes(segment)
    );
  }
}

function hasUsableStoredThumbnail(value) {
  return (
    Boolean(value) &&
    value !== env.placeholderImage &&
    !isGoogleNewsPlaceholderImage(value) &&
    isMeaningfulImageCandidate(value)
  );
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

function normalizeWebsiteValidationText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBlockedWebsiteNavTitle(title) {
  const normalizedTitle = normalizeWebsiteValidationText(title);
  if (!normalizedTitle) {
    return true;
  }

  return WEBSITE_NAV_TITLE_PATTERNS.some((pattern) => {
    if (normalizedTitle === pattern) {
      return true;
    }

    const suffix = normalizedTitle.slice(pattern.length).trim();
    return normalizedTitle.startsWith(`${pattern} `) && suffix.length > 0 && suffix.length <= 24;
  });
}

function urlHasBlockedWebsiteSegment(link) {
  const value = String(link || "").toLowerCase();
  return WEBSITE_NAV_URL_SEGMENTS.some((segment) => value.includes(segment));
}

function hasWebsiteMarketingTitle(title) {
  const normalizedTitle = normalizeWebsiteValidationText(title);
  return WEBSITE_MARKETING_TITLE_TERMS.some((pattern) => normalizedTitle.includes(pattern));
}

function hasWebsiteProductTitle(title) {
  const normalizedTitle = normalizeWebsiteValidationText(title);
  return WEBSITE_PRODUCT_TITLE_TERMS.some((pattern) => normalizedTitle.includes(pattern));
}

function urlHasMarketingWebsiteSegment(link) {
  const value = String(link || "").toLowerCase();
  return WEBSITE_MARKETING_URL_SEGMENTS.some((segment) => value.includes(segment));
}

function urlHasProductWebsiteSegment(link) {
  const value = String(link || "").toLowerCase();
  return WEBSITE_PRODUCT_URL_SEGMENTS.some((segment) => value.includes(segment));
}

function urlHasNewsWebsiteSegment(link) {
  const value = String(link || "").toLowerCase();
  return WEBSITE_NEWS_URL_SEGMENTS.some((segment) => value.includes(segment));
}

function logArticleReject(reason, { link = "", title = "" } = {}) {
  if (!DEBUG_ARTICLE_REJECTS) {
    return;
  }

  console.log(`[article-reject] ${reason}`, {
    title: sanitizeFeedText(title, ""),
    link,
  });
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

  if (isImageEnclosure(item.enclosure)) {
    return { url: resolveFeedImageCandidate(link, item.enclosure.url), source: "rss-enclosure" };
  }

  const imageEnclosure = (Array.isArray(item.enclosures) ? item.enclosures : []).find(isImageEnclosure);
  if (imageEnclosure) {
    return { url: resolveFeedImageCandidate(link, imageEnclosure.url), source: "rss-enclosure" };
  }

  const mediaThumbnailCandidate = findFirstImageCandidate(link, [item["media:thumbnail"], item.mediaThumbnail]);
  if (mediaThumbnailCandidate) {
    return { url: mediaThumbnailCandidate, source: "rss-media-thumbnail" };
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

  const normalizedValue = String(value)
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const parsed = new Date(normalizedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractWebsitePublishedDate($, pageUrl = "") {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[name="publish-date"]',
    'meta[name="pubdate"]',
    'meta[name="date"]',
    "time[datetime]",
    "time",
    "[datetime]",
  ];

  for (const selector of selectors) {
    const node = $(selector).first();
    const value = node.attr("content") || node.attr("datetime") || node.text();
    const parsed = parseWebsiteDate(value);
    if (parsed) {
      return parsed;
    }
  }

  const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
  for (const script of jsonLdScripts) {
    const raw = $(script).contents().text();
    if (!raw) {
      continue;
    }

    try {
      const payload = JSON.parse(raw);
      const entries = Array.isArray(payload) ? payload : [payload];
      for (const entry of entries) {
        const parsed = parseWebsiteDate(entry?.datePublished || entry?.dateCreated || entry?.dateModified);
        if (parsed) {
          return parsed;
        }
      }
    } catch {
      continue;
    }
  }

  if (pageUrl) {
    const fromUrl = pageUrl.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/);
    if (fromUrl) {
      const parsed = parseWebsiteDate(`${fromUrl[1]}-${fromUrl[2]}-${fromUrl[3]}`);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function extractWebsiteArticleBody($) {
  const selectors = [
    "article p",
    ".entry-content p",
    ".post-content p",
    ".article-content p",
    ".content p",
    "main p",
  ];

  for (const selector of selectors) {
    const text = $(selector)
      .slice(0, 12)
      .map((_, element) => $(element).text())
      .get()
      .join(" ");
    const sanitized = sanitizeFeedText(text, "");
    if (sanitized.length >= 140) {
      return sanitized;
    }
  }

  return "";
}

function hasWebsiteNewsroomContext($, pageUrl = "") {
  const bucket = [
    pageUrl,
    $("body").attr("class") || "",
    $("main").attr("class") || "",
    $("article").attr("class") || "",
    $("nav.breadcrumb, .breadcrumb, [aria-label='breadcrumb']").text() || "",
    $("meta[property='og:type']").attr("content") || "",
  ]
    .join(" ")
    .toLowerCase();

  return WEBSITE_NEWS_CONTEXT_TERMS.some((term) => bucket.includes(term));
}

function hasWebsiteNewsIndicators({ pageTitle = "", link = "", articleBody = "", hasNewsroomContext = false, hasPublicationDate = false }) {
  const indicatorText = [pageTitle, link, articleBody]
    .join(" ")
    .toLowerCase();

  return Boolean(
    hasPublicationDate ||
    hasNewsroomContext ||
    urlHasNewsWebsiteSegment(link) ||
    WEBSITE_NEWS_INDICATOR_TERMS.some((term) => indicatorText.includes(term))
  );
}

async function validateWebsiteArticleCandidate(link, title) {
  // Website sources are noisier than RSS feeds, so we require article-like signals
  // before allowing a page into storage.
  if (isBlockedWebsiteNavTitle(title)) {
    logArticleReject("blocked-title", { link, title });
    return {
      accepted: false,
      reason: "blocked-title",
      title,
      link,
    };
  }

  const html = String((await fetchWebsiteHtml(link)).data || "");
  const $ = cheerio.load(html);
  const pageTitle =
    sanitizeFeedText($('meta[property="og:title"]').attr("content"), "") ||
    sanitizeFeedText($("title").first().text(), "") ||
    title;

  if (isBlockedWebsiteNavTitle(pageTitle)) {
    logArticleReject("blocked-page-title", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "blocked-page-title",
      title: pageTitle,
      link,
    };
  }

  const publishedDate = extractWebsitePublishedDate($, link);
  const articleBody = extractWebsiteArticleBody($);
  const articleImage = extractFirstMeaningfulHtmlImage(html, link);
  const hasNewsroomContext = hasWebsiteNewsroomContext($, link);
  const hasArticleBody = articleBody.length >= 140;
  const hasRequiredSignal = Boolean(publishedDate || hasArticleBody || hasNewsroomContext);
  const strongArticleSignals = [Boolean(publishedDate), hasArticleBody, hasNewsroomContext].filter(Boolean).length;
  const marketingTitle = hasWebsiteMarketingTitle(pageTitle);
  const marketingUrl = urlHasMarketingWebsiteSegment(link);
  const productTitle = hasWebsiteProductTitle(pageTitle);
  const productUrl = urlHasProductWebsiteSegment(link);
  const newsUrl = urlHasNewsWebsiteSegment(link);
  const hostname = getHostname(link);
  const sourceText = `${hostname} ${link}`.toLowerCase();
  const regulaSource = hostname.includes("regula");
  const veridosSource = hostname.includes("veridos");
  const veridosNewsContext = VERIDOS_NEWS_CONTEXT_TERMS.some((term) =>
    [pageTitle, link, $("body").text().slice(0, 1500)]
      .join(" ")
      .toLowerCase()
      .includes(term)
  );
  const hasNewsIndicators = hasWebsiteNewsIndicators({
    pageTitle,
    link,
    articleBody,
    hasNewsroomContext,
    hasPublicationDate: Boolean(publishedDate),
  });

  if (urlHasBlockedWebsiteSegment(link) && !publishedDate) {
    logArticleReject("blocked-url", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "blocked-url-without-date",
      title: pageTitle,
      link,
    };
  }

  if (!hasRequiredSignal) {
    logArticleReject("missing-article-signals", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "missing-article-signals",
      title: pageTitle,
      link,
    };
  }

  if (productUrl && !newsUrl && !hasNewsIndicators) {
    logArticleReject("product-url", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "product-url",
      title: pageTitle,
      link,
    };
  }

  if (productTitle && !hasNewsIndicators) {
    logArticleReject("product-title", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "product-title",
      title: pageTitle,
      link,
    };
  }

  if ((marketingTitle || marketingUrl) && strongArticleSignals < 2) {
    logArticleReject("marketing-page-without-article-signals", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "marketing-page-without-article-signals",
      title: pageTitle,
      link,
    };
  }

  if (regulaSource && (productUrl || marketingUrl) && !newsUrl) {
    logArticleReject("regula-product-page", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "regula-product-page",
      title: pageTitle,
      link,
    };
  }

  if (veridosSource && (marketingTitle || marketingUrl) && !veridosNewsContext) {
    logArticleReject("veridos-marketing-page", { link, title: pageTitle });
    return {
      accepted: false,
      reason: "veridos-marketing-page",
      title: pageTitle,
      link,
    };
  }

  return {
    accepted: true,
    title: pageTitle,
    link,
    image: articleImage,
    isoDate: (publishedDate || new Date()).toISOString(),
    contentSnippet: sanitizeFeedText(articleBody, ""),
    hasNewsroomContext,
    hasArticleBody,
    hasPublicationDate: Boolean(publishedDate),
  };
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

function parseWebsiteDateFromText(value) {
  const text = sanitizeFeedText(value, "");
  if (!text) {
    return null;
  }

  const monthDateMatch = text.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s+\d{4}\b/i
  );
  if (monthDateMatch) {
    const parsed = parseWebsiteDate(monthDateMatch[0]);
    if (parsed) {
      return parsed;
    }
  }

  const dotDateMatch = text.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/);
  if (dotDateMatch) {
    const normalized = dotDateMatch[0].replace(/[./]/g, "-");
    const parts = normalized.split("-");
    const [left, middle, right] = parts;
    const year = right.length === 2 ? `20${right}` : right;
    return parseWebsiteDate(`${year}-${String(middle).padStart(2, "0")}-${String(left).padStart(2, "0")}`);
  }

  return null;
}

function buildSicpaNewsroomCandidate($, block, pageUrl) {
  const node = $(block);
  const href =
    node.find("a.full-link").first().attr("href") ||
    node.find("a[href]").first().attr("href") ||
    "";
  const link = href ? new URL(href, pageUrl).toString() : "";
  if (!link) {
    return null;
  }

  const title =
    sanitizeFeedText(node.find(".list-title").first().text(), "") ||
    sanitizeFeedText(node.find("h1, h2, h3, h4").first().text(), "") ||
    sanitizeFeedText(node.find("a[href]").first().text(), "");
  const excerpt =
    sanitizeFeedText(node.find(".list-description").first().text(), "") ||
    sanitizeFeedText(node.text(), "");
  const date =
    parseWebsiteDate(node.find("time").first().attr("datetime") || "") ||
    parseWebsiteDateFromText(node.find("time").first().text()) ||
    parseWebsiteDateFromText(node.text());

  return {
    title,
    link,
    excerpt,
    date,
  };
}

function buildSurysNewsroomCandidate($, block, pageUrl) {
  const node = $(block);
  const titleNode = node.find("h1, h2, h3, h4, .entry-title, .post-title").first();
  const titleLinks = titleNode.find("a[href]").toArray();
  const allLinks = node.find("a[href]").toArray();
  const isBlockedSurysArticleHref = (href) => {
    const normalized = String(href || "").trim().toLowerCase();
    if (
      !normalized ||
      normalized.startsWith("#") ||
      normalized.startsWith("mailto:") ||
      normalized.startsWith("tel:") ||
      normalized.startsWith("javascript:")
    ) {
      return true;
    }

    try {
      const parsed = new URL(href, pageUrl);
      const pathname = parsed.pathname.toLowerCase();
      return (
        pathname.includes("/category/") ||
        pathname.includes("/tag/") ||
        pathname.includes("/author/") ||
        pathname.includes("/page/") ||
        parsed.hash.length > 0
      );
    } catch {
      return true;
    }
  };
  const scoreSurysArticleLink = (element, index) => {
    const link = $(element);
    const text = sanitizeFeedText(link.text(), "").toLowerCase();
    const href = link.attr("href") || "";
    if (isBlockedSurysArticleHref(href)) {
      return -1;
    }

    if (titleLinks.includes(element)) {
      return 100 - index;
    }
    if (text === "read more" || text.includes("read more")) {
      return 80 - index;
    }
    if (String(link.attr("rel") || "").toLowerCase().includes("bookmark")) {
      return 70 - index;
    }

    return 10 - index;
  };
  const linkNode = allLinks
    .map((element, index) => ({ element, score: scoreSurysArticleLink(element, index) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.element;
  const href = linkNode ? $(linkNode).attr("href") || "" : "";
  const link = href ? new URL(href, pageUrl).toString() : "";
  if (!link) {
    return null;
  }

  const title =
    sanitizeFeedText(titleNode.text(), "") ||
    sanitizeFeedText(linkNode ? $(linkNode).text() : "", "") ||
    sanitizeFeedText(node.find("a[href]").first().text(), "");
  const excerpt =
    sanitizeFeedText(node.find(".entry-summary, .post-excerpt, .excerpt, .entry-content p, p").first().text(), "") ||
    sanitizeFeedText(node.text(), "");
  const date =
    parseWebsiteDate(node.find("time").first().attr("datetime") || "") ||
    parseWebsiteDate(node.find(".entry-date, .post-date, .published, .date").first().attr("datetime") || "") ||
    parseWebsiteDateFromText(node.find("time, .entry-date, .post-date, .published, .date").first().text()) ||
    parseWebsiteDateFromText(node.text());

  return {
    title,
    link,
    excerpt,
    date,
  };
}

function buildIqStructuresNewsroomCandidate($, block, pageUrl) {
  const node = $(block);
  const href =
    node.find("a.blog__item-link").first().attr("href") ||
    node.find("a.blog__item-box").first().attr("href") ||
    node.find("a[href*='/en/article/']").first().attr("href") ||
    node.find("a[href]").first().attr("href") ||
    "";
  const link = href ? new URL(href, pageUrl).toString() : "";
  if (!link) {
    return null;
  }

  const title =
    sanitizeFeedText(node.find(".title-5, h1, h2, h3, h4").first().text(), "") ||
    sanitizeFeedText(node.find("a.blog__item-link").first().text(), "") ||
    sanitizeFeedText(node.find("a[href]").first().text(), "");
  const excerpt =
    sanitizeFeedText(node.find(".blog__item-perex, .perex, .excerpt, p").first().text(), "") ||
    sanitizeFeedText(node.text(), "");
  const date =
    parseWebsiteDate(node.find("time").first().attr("datetime") || "") ||
    parseWebsiteDateFromText(node.find(".blog__info-text, .date, .published").first().text()) ||
    parseWebsiteDateFromText(node.text());

  return {
    title,
    link,
    excerpt,
    date,
  };
}

function isCraneCurrencyArticleUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    return (
      hostname === "cranecurrency.com" &&
      /^\/news-insights\/[^/?#]+\/?$/.test(pathname) &&
      pathname !== "/news-insights/"
    );
  } catch {
    return false;
  }
}

function buildCraneCurrencyNewsCandidate($, block, pageUrl) {
  const node = $(block);
  const href =
    node.find("a.stretched-link[href*='/news-insights/']").first().attr("href") ||
    node.find("a[href*='/news-insights/']").first().attr("href") ||
    "";
  const link = href ? new URL(href, pageUrl).toString() : "";
  if (!link || !isCraneCurrencyArticleUrl(link)) {
    return null;
  }

  const title =
    sanitizeFeedText(node.find("h1, h2, h3, h4").first().text(), "") ||
    sanitizeFeedText(node.find("a[href]").first().text(), "");
  const excerpt =
    sanitizeFeedText(node.find("p").first().text(), "") ||
    sanitizeFeedText(node.text(), "");
  const date =
    parseWebsiteDate(node.find("time").first().attr("datetime") || "") ||
    parseWebsiteDateFromText(node.find("time").first().text()) ||
    parseWebsiteDateFromText(node.text());
  const category = node
    .find("a.tag, .tag")
    .toArray()
    .map((element) => sanitizeFeedText($(element).text(), ""))
    .find((value) => value && value.toLowerCase() !== "show all") || "";
  const image =
    node.find("img").first().attr("src") ||
    node.find("img").first().attr("data-src") ||
    pickImageFromSrcset(node.find("img").first().attr("srcset") || node.find("img").first().attr("data-srcset")) ||
    "";

  return {
    title,
    link,
    excerpt,
    date,
    category,
    image: image ? new URL(image, pageUrl).toString() : "",
    discoverySource: pageUrl,
  };
}

async function collectCraneCurrencyArchiveCandidates(feed, options = {}) {
  const pageLimit = Number(options.pageLimit || CRANE_CURRENCY_MAX_ARCHIVE_PAGES);
  const candidates = [];
  const seenLinks = new Set();
  const archivePages = [];
  let consecutiveEmptyPages = 0;

  for (let page = 1; page <= pageLimit; page += 1) {
    const pageUrl = page === 1
      ? CRANE_CURRENCY_NEWSROOM_URL
      : `${CRANE_CURRENCY_NEWSROOM_URL}?q=&p=${page}&cat=`;
    const response = await fetchWebsiteHtml(pageUrl);
    const fetchedUrl = response.request?.res?.responseUrl || pageUrl;
    const $ = cheerio.load(String(response.data || ""));
    const pageCandidates = [];

    $("article, .card, .teaser, .news-card, main li, main div")
      .toArray()
      .forEach((block) => {
        const candidate = buildCraneCurrencyNewsCandidate($, block, fetchedUrl);
        if (!candidate?.link || !candidate.title) {
          return;
        }

        const canonicalLink = canonicalizeUrl(candidate.link);
        if (!canonicalLink || seenLinks.has(canonicalLink)) {
          return;
        }

        seenLinks.add(canonicalLink);
        pageCandidates.push(candidate);
      });

    archivePages.push({
      page,
      url: pageUrl,
      fetchedUrl,
      candidates: pageCandidates.length,
    });
    candidates.push(...pageCandidates);

    if (!pageCandidates.length) {
      consecutiveEmptyPages += 1;
      if (consecutiveEmptyPages >= 2) {
        break;
      }
    } else {
      consecutiveEmptyPages = 0;
    }

    if (candidates.length >= CRANE_CURRENCY_MAX_CANDIDATES) {
      break;
    }
  }

  return {
    candidates,
    archivePages,
  };
}

async function collectCraneCurrencySitemapCandidates() {
  const response = await fetchWebsiteHtml(CRANE_CURRENCY_SITEMAP_URL);
  const fetchedUrl = response.request?.res?.responseUrl || CRANE_CURRENCY_SITEMAP_URL;
  const xml = String(response.data || "");
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
    .map((match) => sanitizeFeedText(match[1], ""))
    .map((value) => value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))))
    .filter((value) => isCraneCurrencyArticleUrl(value));

  return {
    fetchedUrl,
    urls: Array.from(new Set(urls)),
  };
}

async function buildCraneCurrencyCandidateFromUrl(link) {
  if (!isCraneCurrencyArticleUrl(link)) {
    return null;
  }

  const response = await fetchWebsiteHtml(link);
  const fetchedUrl = response.request?.res?.responseUrl || link;
  const html = String(response.data || "");
  const $ = cheerio.load(html);
  const canonicalLink =
    $("link[rel='canonical']").first().attr("href") ||
    $('link[rel="canonical"]').first().attr("href") ||
    fetchedUrl;
  const resolvedLink = new URL(canonicalLink, fetchedUrl).toString();
  if (!isCraneCurrencyArticleUrl(resolvedLink)) {
    return null;
  }

  const title =
    sanitizeFeedText($("h1").first().text(), "") ||
    sanitizeFeedText($('meta[property="og:title"]').attr("content"), "") ||
    sanitizeFeedText($("title").first().text(), "");
  const body = extractWebsiteArticleBody($);
  const date =
    extractWebsitePublishedDate($, resolvedLink) ||
    parseWebsiteDateFromText($("time").first().text()) ||
    null;

  return {
    title,
    link: resolvedLink,
    excerpt: body,
    date,
    category: "",
    image: "",
    discoverySource: CRANE_CURRENCY_SITEMAP_URL,
  };
}

async function discoverCraneCurrencyCandidates(feed, options = {}) {
  const archive = await collectCraneCurrencyArchiveCandidates(feed, options);
  const candidateMap = new Map();

  archive.candidates.forEach((candidate) => {
    const canonicalLink = canonicalizeUrl(candidate.link);
    if (canonicalLink) {
      candidateMap.set(canonicalLink, candidate);
    }
  });

  const sitemap = await collectCraneCurrencySitemapCandidates().catch((error) => {
    console.warn("[CRANE_CURRENCY_NEWSROOM] sitemap discovery failed:", error?.message || error);
    return { fetchedUrl: CRANE_CURRENCY_SITEMAP_URL, urls: [] };
  });
  const sitemapLimit = Number(options.sitemapLimit || CRANE_CURRENCY_MAX_CANDIDATES);
  for (const url of sitemap.urls.slice(0, sitemapLimit)) {
    const canonicalLink = canonicalizeUrl(url);
    if (!canonicalLink || candidateMap.has(canonicalLink)) {
      continue;
    }

    const candidate = await buildCraneCurrencyCandidateFromUrl(url).catch((error) => {
      console.warn(`[CRANE_CURRENCY_NEWSROOM] failed to inspect sitemap URL ${url}:`, error?.message || error);
      return null;
    });
    if (candidate?.link && candidate.title) {
      candidateMap.set(canonicalLink, candidate);
    }

    if (candidateMap.size >= CRANE_CURRENCY_MAX_CANDIDATES) {
      break;
    }
  }

  return {
    archivePages: archive.archivePages,
    sitemapUrl: sitemap.fetchedUrl,
    sitemapUrlsScanned: sitemap.urls.length,
    candidates: Array.from(candidateMap.values()),
  };
}

async function assessCraneCurrencyCandidate(feed, candidate) {
  const lowerLink = String(candidate.link || "").toLowerCase();

  if (!isCraneCurrencyArticleUrl(candidate.link)) {
    return {
      accepted: false,
      reason: "non-article-url",
      candidate,
      validation: null,
      sourceRelevance: null,
    };
  }

  if (
    lowerLink.includes("/solutions/") ||
    lowerLink.includes("/media/") ||
    lowerLink.includes("?") ||
    lowerLink.includes("#")
  ) {
    return {
      accepted: false,
      reason: "blocked-crane-url",
      candidate,
      validation: null,
      sourceRelevance: null,
    };
  }

  const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => ({
    accepted: false,
    reason: `validation-error:${error?.message || error}`,
  }));

  if (!validated?.accepted) {
    return {
      accepted: false,
      reason: validated?.reason || "validation-rejected",
      candidate,
      validation: validated,
      sourceRelevance: null,
    };
  }

  const article = {
    title: validated.title || candidate.title,
    link: candidate.link,
    contentSnippet: validated.contentSnippet || candidate.excerpt || "",
  };
  const sourceRelevance = getSourceRelevanceAssessment(feed, article);

  if (!sourceRelevance.accepted) {
    return {
      accepted: false,
      reason: "source-relevance-filter",
      candidate,
      validation: validated,
      sourceRelevance,
    };
  }

  return {
    accepted: true,
    reason: "accepted",
    candidate,
    validation: validated,
    sourceRelevance,
    item: {
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      category: candidate.category || undefined,
      image: candidate.image || undefined,
      author: "",
      source: getSourceName(candidate.link),
    },
  };
}

async function extractCraneCurrencyNewsroomItems(feed, options = {}) {
  const discovery = await discoverCraneCurrencyCandidates(feed, options);
  const items = [];
  let skippedCount = 0;

  console.log(`[CRANE_CURRENCY_NEWSROOM] archive_pages_scanned count=${discovery.archivePages.length}`);
  console.log(`[CRANE_CURRENCY_NEWSROOM] sitemap_urls_scanned count=${discovery.sitemapUrlsScanned}`);
  console.log(`[CRANE_CURRENCY_NEWSROOM] candidates_discovered count=${discovery.candidates.length}`);

  for (const candidate of discovery.candidates) {
    const assessment = await assessCraneCurrencyCandidate(feed, candidate);
    if (!assessment.accepted) {
      skippedCount += 1;
      console.log(`[CRANE_CURRENCY_NEWSROOM] rejected link=${candidate.link} reason=${assessment.reason}`);
      continue;
    }

    items.push(assessment.item);
  }

  console.log(`[CRANE_CURRENCY_NEWSROOM] articles_validated count=${items.length}`);
  console.log(`[CRANE_CURRENCY_NEWSROOM] articles_skipped count=${skippedCount}`);

  return items;
}

export async function auditCraneCurrencyNewsroom(options = {}) {
  const feed = {
    id: "crane-currency-audit",
    name: "Crane Currency News & Insights",
    rssUrl: CRANE_CURRENCY_NEWSROOM_URL,
    topic: "Banknotes",
    sourceType: "website",
  };
  const discovery = await discoverCraneCurrencyCandidates(feed, options);
  const results = [];

  for (const candidate of discovery.candidates) {
    const assessment = await assessCraneCurrencyCandidate(feed, candidate);
    let thumbnail = "";
    let thumbnailSource = "";
    let thumbnailStatus = "";
    if (assessment.accepted) {
      const metadata = await scrapeArticleMetadata(
        assessment.item.link,
        assessment.item.contentSnippet || "",
        assessment.item.title || ""
      ).catch((error) => ({ error: error?.message || String(error) }));
      thumbnail = metadata.thumbnail || "";
      thumbnailSource = metadata.thumbnailSource || metadata.source || "";
      thumbnailStatus = metadata.error || (thumbnail ? "detected" : "missing");
    }

    results.push({
      title: assessment.item?.title || assessment.validation?.title || candidate.title,
      url: candidate.link,
      date: assessment.item?.isoDate || assessment.validation?.isoDate || (candidate.date ? candidate.date.toISOString() : ""),
      thumbnail,
      thumbnailSource,
      thumbnailStatus,
      category: assessment.item?.category || candidate.category || "",
      accepted: assessment.accepted,
      decision: assessment.accepted ? "would-import" : "reject",
      reason: assessment.reason,
      validationReason: assessment.validation?.reason || "",
      sourceRelevanceReason: assessment.sourceRelevance?.reason || "",
      sourceRelevanceIncludedTerms: assessment.sourceRelevance?.includedTerms || [],
      sourceRelevanceExcludedTerms: assessment.sourceRelevance?.excludedTerms || [],
      discoverySource: candidate.discoverySource || "",
    });
  }

  return {
    archivePagesScanned: discovery.archivePages.length,
    archivePages: discovery.archivePages,
    sitemapUrl: discovery.sitemapUrl,
    sitemapUrlsScanned: discovery.sitemapUrlsScanned,
    candidateUrlsFound: discovery.candidates.length,
    duplicatesRemoved: Math.max(
      0,
      discovery.archivePages.reduce((sum, page) => sum + Number(page.candidates || 0), 0) +
        Number(discovery.sitemapUrlsScanned || 0) -
        discovery.candidates.length
    ),
    validationAccepted: results.filter((entry) => entry.accepted).length,
    validationRejected: results.filter((entry) => !entry.accepted).length,
    results,
  };
}

async function extractSicpaNewsroomItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();
  const items = [];
  let validatedCount = 0;
  let skippedCount = 0;

  $(".views-row, .media--type-document.media--view-mode-document-card")
    .toArray()
    .forEach((block) => {
      const candidate = buildSicpaNewsroomCandidate($, block, pageUrl);
      if (!candidate?.link) {
        return;
      }

      const canonicalLink = canonicalizeUrl(candidate.link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push(candidate);
    });

  console.log(`[SICPA_NEWSROOM] articles_discovered count=${discoveredCandidates.length}`);

  for (const candidate of discoveredCandidates) {
    const lowerLink = String(candidate.link || "").toLowerCase();

    if (
      !lowerLink.includes("/news/") ||
      lowerLink.includes("/events/") ||
      lowerLink.endsWith(".pdf") ||
      lowerLink.includes("?page=") ||
      lowerLink.includes("#")
    ) {
      skippedCount += 1;
      continue;
    }

    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });

    if (!validated?.accepted) {
      skippedCount += 1;
      if (validated?.reason) {
        console.log(`Rejected website candidate ${candidate.link}: ${validated.reason}`);
      }
      continue;
    }

    validatedCount += 1;
    items.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  console.log(`[SICPA_NEWSROOM] articles_validated count=${validatedCount}`);
  console.log(`[SICPA_NEWSROOM] articles_skipped count=${skippedCount}`);

  return items;
}

async function extractSurysNewsroomItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();
  const items = [];
  let validatedCount = 0;
  let skippedCount = 0;

  $("article, .post, .blog-item, .post-item, .entry")
    .toArray()
    .forEach((block) => {
      const candidate = buildSurysNewsroomCandidate($, block, pageUrl);
      if (!candidate?.link || !candidate.title) {
        return;
      }

      const canonicalLink = canonicalizeUrl(candidate.link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push(candidate);
    });

  console.log(`[SURYS_NEWSROOM] articles_discovered count=${discoveredCandidates.length}`);

  for (const candidate of discoveredCandidates) {
    const lowerLink = String(candidate.link || "").toLowerCase();
    const hostname = getHostname(candidate.link);

    if (
      !hostname.includes("surys.com") ||
      lowerLink.endsWith(".pdf") ||
      lowerLink.includes("/category/") ||
      lowerLink.includes("/tag/") ||
      lowerLink.includes("/author/") ||
      lowerLink.includes("/page/") ||
      lowerLink.includes("#")
    ) {
      skippedCount += 1;
      continue;
    }

    const pathname = (() => {
      try {
        return new URL(candidate.link).pathname.toLowerCase();
      } catch {
        return "";
      }
    })();
    const pathSegments = pathname.split("/").filter(Boolean);
    const looksLikeArticlePath =
      pathSegments.length >= 1 &&
      !["surys-blog", "follow-surys"].includes(pathSegments[pathSegments.length - 1]);

    if (!looksLikeArticlePath) {
      skippedCount += 1;
      continue;
    }

    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });

    if (!validated?.accepted) {
      skippedCount += 1;
      if (validated?.reason) {
        console.log(`Rejected website candidate ${candidate.link}: ${validated.reason}`);
      }
      continue;
    }

    validatedCount += 1;
    items.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  console.log(`[SURYS_NEWSROOM] articles_validated count=${validatedCount}`);
  console.log(`[SURYS_NEWSROOM] articles_skipped count=${skippedCount}`);

  return items;
}

async function extractIqStructuresNewsroomItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();
  const items = [];
  let validatedCount = 0;
  let skippedCount = 0;

  console.log(
    `[IQ_STRUCTURES_NEWSROOM] source id=${feed.id} name=${feed.name} requestedUrl=${feed.rssUrl} fetchedUrl=${pageUrl}`
  );

  $(".blog__item, .blog__border")
    .toArray()
    .forEach((block) => {
      const candidate = buildIqStructuresNewsroomCandidate($, block, pageUrl);
      if (!candidate?.link || !candidate.title) {
        return;
      }

      const canonicalLink = canonicalizeUrl(candidate.link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push(candidate);
    });

  console.log(`[IQ_STRUCTURES_NEWSROOM] articles_discovered count=${discoveredCandidates.length}`);

  for (const candidate of discoveredCandidates) {
    const lowerLink = String(candidate.link || "").toLowerCase();
    const hostname = getHostname(candidate.link);

    if (
      !hostname.includes("iqstructures.com") &&
      !hostname.includes("iqstructures") &&
      !hostname.includes("iq-structures")
    ) {
      skippedCount += 1;
      console.log(`[IQ_STRUCTURES_NEWSROOM] skipped link=${candidate.link} reason=unexpected-hostname`);
      continue;
    }

    if (
      !lowerLink.includes("/en/article/") ||
      lowerLink.includes("/en/tag/") ||
      lowerLink.includes("/en/media") ||
      lowerLink.endsWith(".pdf") ||
      lowerLink.includes("?page=") ||
      lowerLink.includes("#")
    ) {
      skippedCount += 1;
      console.log(`[IQ_STRUCTURES_NEWSROOM] skipped link=${candidate.link} reason=non-article-url`);
      continue;
    }

    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });

    if (!validated?.accepted) {
      skippedCount += 1;
      if (validated?.reason) {
        console.log(`[IQ_STRUCTURES_NEWSROOM] rejected link=${candidate.link} reason=${validated.reason}`);
      }
      continue;
    }

    validatedCount += 1;
    items.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  console.log(`[IQ_STRUCTURES_NEWSROOM] articles_validated count=${validatedCount}`);
  console.log(`[IQ_STRUCTURES_NEWSROOM] articles_skipped count=${skippedCount}`);

  return items;
}

async function extractWebsiteItems(feed) {
  console.log(`Parsing website source ${feed.id} (${feed.rssUrl})`);
  const response = await fetchWebsiteHtml(feed.rssUrl);
  const html = String(response.data || "");
  const $ = cheerio.load(html);
  const fetchedUrl = response.request?.res?.responseUrl || feed.rssUrl;

  if (isSicpaNewsroomFeed(feed)) {
    const items = await extractSicpaNewsroomItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isSurysNewsroomFeed(feed)) {
    const items = await extractSurysNewsroomItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isIqStructuresNewsroomFeed(feed)) {
    const items = await extractIqStructuresNewsroomItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isCraneCurrencyNewsroomFeed(feed)) {
    const items = await extractCraneCurrencyNewsroomItems(feed);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

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

    const validated = await validateWebsiteArticleCandidate(link, text).catch((error) => {
      console.warn(`Website article validation failed for ${link}:`, error?.message || error);
      return null;
    });
    if (!validated?.accepted) {
      if (validated?.reason) {
        console.log(`Rejected website candidate ${link}: ${validated.reason}`);
      }
      continue;
    }
    if (!articleMatchesSourceRelevanceRule(feed, {
      title: validated.title || text,
      link,
      contentSnippet: validated.contentSnippet || "",
    })) {
      console.log(`Rejected website candidate ${link}: source-relevance-filter`);
      continue;
    }

    seenLinks.add(canonicalLink);
    items.push({
      title: validated.title || text,
      link,
      isoDate: validated.isoDate || inferWebsiteItemDate($, anchor).toISOString(),
      image: validated.image || "",
      contentSnippet:
        validated.contentSnippet || sanitizeFeedText($(anchor).closest("article, li, div").text(), ""),
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

function isGoogleNewsLink(link) {
  return getHostname(link) === "news.google.com";
}

function isGoogleAlertsFeed(feed) {
  try {
    const parsed = new URL(String(feed?.rssUrl || ""));
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return hostname === "google.com" && parsed.pathname.startsWith("/alerts/feeds/");
  } catch {
    return false;
  }
}

function extractItemSourceMetadata(item) {
  const entries = Array.isArray(item?.source) ? item.source : item?.source ? [item.source] : [];

  for (const entry of entries) {
    if (typeof entry === "string") {
      const name = sanitizeFeedText(entry, "");
      if (name) {
        return { name, url: "" };
      }
      continue;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const name = sanitizeFeedText(
      entry._ || entry.text || entry.name || entry.title || "",
      ""
    );
    const url = normalizeText(
      entry.url || entry.href || entry.$?.url || entry.$?.href || entry["@_url"] || entry["@_href"],
      ""
    );

    if (name || url) {
      return { name, url };
    }
  }

  return { name: "", url: "" };
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
  const feedFallbackThumbnail = isGoogleAlertsFeed(feed)
    ? ""
    : resolveFeedImageCandidate(link, feed.sourceFallbackImage || "");
  const thumbnail = normalizeText(extractedThumbnail.url || feedFallbackThumbnail, env.placeholderImage);
  const hasUsableThumbnail =
    Boolean(thumbnail) &&
    thumbnail !== env.placeholderImage &&
    !isGoogleNewsPlaceholderImage(thumbnail);
  const thumbnailSource = extractedThumbnail.url
    ? extractedThumbnail.source
    : feedFallbackThumbnail
      ? "feed-fallback-image"
      : "placeholder";
  const canonicalLink = canonicalizeUrl(link);
  const sourceMeta = extractItemSourceMetadata(item);
  const source = sanitizeFeedText(sourceMeta.name || item.creator || item.author || getSourceName(link), "Unknown");
  const tags = normalizeArticleTags(item);
  const keywords = Array.from(new Set([...tags, ...inferKeywords([title, contentSnippet, feed.topic], 6)]));
  const isNotafiliaArticle = isNotafiliaUrl(link) || isNotafiliaUrl(canonicalLink);
  const sourceUrlCandidate =
    isGoogleNewsLink(link) && sourceMeta.url && getHostname(sourceMeta.url) !== "news.google.com"
      ? sourceMeta.url
      : "";

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
    fetchStatus: hasUsableThumbnail ? "enriched" : "pending",
    articleHash: createDeterministicId(canonicalLink || link),
    thumbnailSource,
    sourceUrlCandidate
  };
}

async function upsertArticle(article) {
  const existing = await findArticleById(article.id);
  if (!existing) {
    const created = await createArticle(article);
    broadcast("article:new", { type: "article:new", article: created });
    return { created: true, article: created };
  }

  const shouldBackfillThumbnail =
    !hasUsableStoredThumbnail(existing.thumbnail) &&
    hasUsableStoredThumbnail(article.thumbnail);
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

async function enrichGoogleNewsThumbnailFromSourceUrl(article) {
  if (
    !article ||
    !article.sourceUrlCandidate ||
    (article.thumbnail &&
      article.thumbnail !== env.placeholderImage &&
      !isGoogleNewsPlaceholderImage(article.thumbnail))
  ) {
    return article;
  }

  const thumbnailExtractionUrl = article.sourceUrlCandidate;
  const enriched = await scrapeArticleMetadata(
    thumbnailExtractionUrl,
    article.contentSnippet || article.summary || "",
    article.title || "",
    {
      existingThumbnail: article.thumbnail,
      rssThumbnailSource:
        article.thumbnail &&
        article.thumbnail !== env.placeholderImage &&
        !isGoogleNewsPlaceholderImage(article.thumbnail)
          ? article.thumbnailSource || "article-existing"
          : "",
    }
  );

  const nextThumbnail = normalizeText(enriched?.thumbnail, "");
  const nextThumbnailIsUsable =
    Boolean(nextThumbnail) &&
    nextThumbnail !== env.placeholderImage &&
    !isGoogleNewsPlaceholderImage(nextThumbnail);

  if (DEBUG_IMAGE_EXTRACTION) {
    console.log("[google-news-thumbnail-source-url]", {
      articleTitle: article.title || "",
      googleNewsUrl: article.link || "",
      sourceUrl: article.sourceUrlCandidate,
      thumbnailExtractionUrl,
      thumbnailResult: nextThumbnail || "",
      thumbnailSource: enriched?.thumbnailSource || "",
    });
  }

  if (!nextThumbnailIsUsable) {
    return article;
  }

  return {
    ...article,
    thumbnail: nextThumbnail,
    thumbnailSource: enriched?.thumbnailSource || "google-news-source-url",
    fetchStatus: "enriched",
  };
}

function queueThumbnailEnrichment(article) {
  if (!article?.id) {
    return;
  }

  if (
    hasUsableStoredThumbnail(article.thumbnail)
  ) {
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
  const vendorFeedLogLabel = getVendorFeedLogLabel(feed);

  try {
    console.log(`Starting feed sync for ${feed.id} (${feed.name || feed.rssUrl})`);
    if (vendorFeedLogLabel) {
      console.log(
        `[${vendorFeedLogLabel}] source id=${feed.id} name=${feed.name || ""} sourceType=${feed.sourceType || ""} rssUrl=${feed.rssUrl || ""}`
      );
    }
    await updateFeedRecord(feed.id, {
      lastStatus: "refreshing",
      lastError: null
    });

    let resolvedItems = [];
    if (feed.sourceType === "website") {
      resolvedItems = await extractWebsiteItems(feed);
      if (vendorFeedLogLabel) {
        console.log(`[${vendorFeedLogLabel}] feed_loaded feedId=${feed.id} rssUrl=${feed.rssUrl}`);
      }
    } else {
      console.log(`Fetching RSS source ${feed.id} (${feed.rssUrl})`);
      const parsedFeed = await parser.parseURL(feed.rssUrl);
      if (vendorFeedLogLabel) {
        console.log(`[${vendorFeedLogLabel}] feed_loaded feedId=${feed.id} rssUrl=${feed.rssUrl}`);
      }
      resolvedItems = Array.isArray(parsedFeed.items) ? parsedFeed.items : [];
    }

    if (vendorFeedLogLabel) {
      console.log(`[${vendorFeedLogLabel}] articles_found count=${resolvedItems.length}`);
    }

    for (const item of resolvedItems) {
      try {
        let normalized = normalizeItem(feed, item);
        if (!normalized) {
          continue;
        }

        normalized = await enrichGoogleNewsThumbnailFromSourceUrl(normalized);

        console.log(
          `Thumbnail source for article ${normalized.id}: ${normalized.thumbnailSource || "placeholder"}`
        );

        const result = await upsertArticle(normalized);
        if (!result.created) {
          if (vendorFeedLogLabel) {
            console.log(
              `[${vendorFeedLogLabel}] article_skipped_existing articleId=${normalized.id} title=${JSON.stringify(normalized.title || "")} link=${normalized.link || ""}`
            );
          }
          queueThumbnailEnrichment(result.article);
          continue;
        }

        newArticles += 1;
        console.log(`Stored new article ${result.article.id} for feed ${feed.id}`);
        if (vendorFeedLogLabel) {
          console.log(
            `[${vendorFeedLogLabel}] article_imported articleId=${result.article.id} title=${JSON.stringify(result.article.title || "")} link=${result.article.link || ""}`
          );
        }

        queueThumbnailEnrichment(result.article);
      } catch (itemError) {
        console.error(`Article ingestion error for feed ${feed.id}:`, itemError?.stack || itemError);
        if (vendorFeedLogLabel) {
          console.log(
            `[${vendorFeedLogLabel}] article_error title=${JSON.stringify(item?.title || "")} link=${resolveItemLink(item) || ""} message=${itemError?.message || itemError}`
          );
        }
      }
    }

    if (vendorFeedLogLabel) {
      console.log(`[${vendorFeedLogLabel}] articles_imported count=${newArticles}`);
      console.log(`[${vendorFeedLogLabel}] articles_skipped count=${Math.max(0, resolvedItems.length - newArticles)}`);
    }

    const updatedFeed = await updateFeedRecord(feed.id, {
      lastFetchedAt: new Date(),
      lastStatus: "success",
      lastError: null,
      lastInsertedCount: newArticles
    });
    broadcast("feed:update", { type: "feed:update", feed: updatedFeed });

    // Retain poll logs for failures and meaningful ingestion wins.
    // Successful zero-insert polls are extremely frequent and can exhaust database storage
    // without adding useful operational history to the dashboard.
    if (newArticles > 0) {
      await createPollLog({
        feedId: feed.id,
        startedAt,
        finishedAt: new Date(),
        status: "success",
        newArticles
      });
    }

    console.log(`Feed sync complete for ${feed.id}; inserted ${newArticles} new articles`);
    return { feedId: String(feed.id), newArticles };
  } catch (error) {
    if (vendorFeedLogLabel) {
      console.log(
        `[${vendorFeedLogLabel}] feed_sync_error feedId=${feed.id} rssUrl=${feed.rssUrl} message=${error.message}`
      );
    }
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
      const enriched = await scrapeArticleMetadata(
        article.link,
        article.contentSnippet || article.summary,
        article.title || "",
        {
          existingThumbnail: article.thumbnail,
          rssThumbnailSource:
            article.thumbnail &&
            article.thumbnail !== env.placeholderImage &&
            !isGoogleNewsPlaceholderImage(article.thumbnail)
              ? "article-existing"
              : "",
        }
      );
      const updatedArticle = await updateArticle(article.id, {
        thumbnail:
          article.thumbnail !== env.placeholderImage && !isGoogleNewsPlaceholderImage(article.thumbnail)
            ? article.thumbnail
            : enriched.thumbnail,
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
