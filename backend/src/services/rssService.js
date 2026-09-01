import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { env } from "../config/env.js";
import {
  createArticle,
  deleteArticlesByFeedId,
  findArticleById,
  listPendingArticles,
  updateArticle
} from "../database/articleRepository.js";
import { createPollLog } from "../database/pollLogRepository.js";
import { listFeeds as listFeedRecords, updateFeed as updateFeedRecord } from "../database/feedRepository.js";
import { broadcast } from "./realtimeService.js";
import { articleMatchesSourceRelevanceRule, getSourceRelevanceAssessment } from "./sourceRelevanceService.js";
import {
  enrichArticle,
  isGoogleNewsPlaceholderImage,
  isLikelyGenericMetadataImage,
  scrapeArticleMetadata
} from "./thumbnailService.js";
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

const inFlightFeedSyncs = new Map();
let allFeedsSyncPromise = null;
const thumbnailEnrichmentQueue = [];
const queuedThumbnailEnrichmentIds = new Set();
const activeThumbnailEnrichmentIds = new Set();
let activeThumbnailEnrichmentCount = 0;

const SICPA_NEWSROOM_URL = "https://www.sicpa.com/all-press-releases";
const SURYS_NEWSROOM_URL = "https://surys.com/surys-blog/";
const IQ_STRUCTURES_NEWSROOM_URL = "https://www.iqstructures.com/en/blog";
const CRANE_CURRENCY_NEWSROOM_URL = "https://www.cranecurrency.com/news-insights/";
const CRANE_CURRENCY_SITEMAP_URL = "https://www.cranecurrency.com/sitemap/";
const CRANE_CURRENCY_MAX_ARCHIVE_PAGES = 8;
const CRANE_CURRENCY_MAX_CANDIDATES = 80;
const IND_NEWS_URL = "https://ind.nl/en/news";
const CBP_MEDIA_RELEASES_URL = "https://www.cbp.gov/newsroom/media-releases/all";
const GOV_UK_NEWS_URL = "https://www.gov.uk/search/news-and-communications";
const LANDQART_NEWS_URL = "https://www.landqart.com/en/stories/news";
const POLYVANTIS_PRESS_URL = "https://www.polyvantis.com/en/press";
const LINXENS_NEWS_URL = "https://www.linxens.com/en/news-events";
const VTT_NEWS_URL = "https://www.vttresearch.com/en/news-stories/news-and-stories";
const KINEGRAM_INSIGHTS_URL = "https://www.kinegram.com/events-insights/insights";
const KOENIG_BAUER_PRESS_RELEASES_URL = "https://www.koenig-bauer.com/en/newsroom/press-releases";
const KOENIG_BAUER_MAX_ARCHIVE_PAGES = 4;
const KOENIG_BAUER_MAX_CANDIDATES = 28;
const ATLANTIC_ZEISER_NEWS_URL = "https://www.atlanticzeiser.com/en/news";
const ATLANTIC_ZEISER_MAX_ARCHIVE_PAGES = 3;
const ATLANTIC_ZEISER_MAX_CANDIDATES = 24;
const LINXENS_NEWS_AJAX_URL = "https://www.linxens.com/en/ajax/news-events";

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

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const directMessage = String(error.message || error.error || "").trim();
    if (directMessage) {
      return directMessage;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      return "Unknown object error";
    }
  }

  return "Unknown error";
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

function normalizeWebsiteFeedSignature(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function matchesWebsiteFeedSignature(feed, { exactUrls = [], urlFragments = [], exactNames = [] } = {}) {
  if (!feed) {
    return false;
  }

  const normalizedUrl = normalizeWebsiteFeedSignature(feed.rssUrl);
  const normalizedName = normalizeWebsiteFeedSignature(feed.name);

  if (exactUrls.some((value) => normalizedUrl === normalizeWebsiteFeedSignature(value))) {
    return true;
  }

  if (urlFragments.some((value) => normalizedUrl.includes(normalizeWebsiteFeedSignature(value)))) {
    return true;
  }

  if (exactNames.some((value) => normalizedName === normalizeWebsiteFeedSignature(value))) {
    return true;
  }

  return false;
}

function isLandqartNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [LANDQART_NEWS_URL],
    urlFragments: ["landqart.com/en/stories/news"],
    exactNames: ["Landqart News"],
  });
}

function isIndNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [IND_NEWS_URL],
    urlFragments: ["ind.nl/en/news"],
    exactNames: ["Dutch IND Residence Updates"],
  });
}

function isCbpNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [CBP_MEDIA_RELEASES_URL],
    urlFragments: ["cbp.gov/newsroom/media-releases/all"],
    exactNames: ["CBP Newsroom"],
  });
}

function isEuLisaNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: ["https://www.eulisa.europa.eu/news-and-events"],
    urlFragments: ["eulisa.europa.eu/news-and-events"],
    exactNames: ["eu-LISA Updates"],
  });
}

function isGovUkNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [GOV_UK_NEWS_URL],
    urlFragments: ["gov.uk/search/news-and-communications"],
    exactNames: [
      "GOV.UK News and Communications",
      "UKVI BRP and BRC Guidance",
      "UKVI Biometric Residence Permits",
    ],
  });
}

function isPolyvantisPressFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [POLYVANTIS_PRESS_URL],
    urlFragments: ["polyvantis.com/en/press"],
    exactNames: ["POLYVANTIS Press"],
  });
}

function isLinxensNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [LINXENS_NEWS_URL],
    urlFragments: ["linxens.com/en/news-events"],
    exactNames: ["Linxens News & Events"],
  });
}

function isVttNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [VTT_NEWS_URL],
    urlFragments: [
      "vttresearch.com/en/news-stories/news-and-stories",
      "vttresearch.com/en/news-and-ideas",
    ],
    exactNames: ["VTT News and Stories"],
  });
}

function isKinegramInsightsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [KINEGRAM_INSIGHTS_URL],
    urlFragments: ["kinegram.com/events-insights/insights"],
    exactNames: ["OVD Kinegram Insights"],
  });
}

function isKoenigBauerPressReleasesFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [KOENIG_BAUER_PRESS_RELEASES_URL],
    urlFragments: [
      "koenig-bauer.com/en/newsroom",
      "koenig-bauer.com/en/newsroom/press-releases",
    ],
    exactNames: ["Koenig & Bauer Newsroom"],
  });
}

function isAtlanticZeiserNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: [ATLANTIC_ZEISER_NEWS_URL],
    urlFragments: ["atlanticzeiser.com/en/news"],
    exactNames: ["Atlantic Zeiser News"],
  });
}

function isIcaoNewsFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: ["https://www.icao.int/news"],
    urlFragments: ["icao.int/news"],
    exactNames: ["ICAO Newsroom"],
  });
}

function isIcaoTripFeed(feed) {
  return matchesWebsiteFeedSignature(feed, {
    exactUrls: ["https://www.icao.int/facilitation-programmes/assistance"],
    urlFragments: ["icao.int/facilitation-programmes/assistance"],
    exactNames: ["ICAO TRIP"],
  });
}

function shouldReplaceArticlesOnSync(feed) {
  return (
    isIndNewsFeed(feed) ||
    isCbpNewsFeed(feed) ||
    isEuLisaNewsFeed(feed) ||
    isGovUkNewsFeed(feed) ||
    isIcaoNewsFeed(feed) ||
    isIcaoTripFeed(feed) ||
    isLandqartNewsFeed(feed) ||
    isPolyvantisPressFeed(feed) ||
    isLinxensNewsFeed(feed) ||
    isVttNewsFeed(feed) ||
    isKinegramInsightsFeed(feed) ||
    isKoenigBauerPressReleasesFeed(feed) ||
    isAtlanticZeiserNewsFeed(feed)
  );
}

function isTrackedVendorWebsiteFeed(feed) {
  return (
    isLandqartNewsFeed(feed) ||
    isPolyvantisPressFeed(feed) ||
    isLinxensNewsFeed(feed) ||
    isVttNewsFeed(feed) ||
    isKinegramInsightsFeed(feed) ||
    isKoenigBauerPressReleasesFeed(feed) ||
    isAtlanticZeiserNewsFeed(feed)
  );
}

function isBrokenPolyvantisPressLink(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("/en/press/") && normalized.includes("-copy");
}

function logTrackedVendorWebsiteFeedState(feed, stage, extra = {}) {
  if (!isTrackedVendorWebsiteFeed(feed)) {
    return;
  }

  console.log(
    `[vendor-debug] stage=${stage} feedId=${feed.id} name=${JSON.stringify(feed.name || "")} rssUrl=${feed.rssUrl || ""} ` +
      `sourceType=${feed.sourceType || ""} isLandqart=${isLandqartNewsFeed(feed)} isPolyvantis=${isPolyvantisPressFeed(feed)} ` +
      `isLinxens=${isLinxensNewsFeed(feed)} isVtt=${isVttNewsFeed(feed)} isKinegram=${isKinegramInsightsFeed(feed)} ` +
      `isKoenigBauer=${isKoenigBauerPressReleasesFeed(feed)} isAtlanticZeiser=${isAtlanticZeiserNewsFeed(feed)} shouldReplace=${shouldReplaceArticlesOnSync(feed)} ` +
      `${Object.entries(extra)
        .map(([key, value]) => `${key}=${typeof value === "string" ? JSON.stringify(value) : String(value)}`)
        .join(" ")}`
  );
}

function getTrackedVendorWebsiteFeedDebugSnapshot(feed) {
  return {
    feedId: String(feed?.id || ""),
    name: feed?.name || "",
    rssUrl: feed?.rssUrl || "",
    sourceType: feed?.sourceType || "",
    isLandqart: isLandqartNewsFeed(feed),
    isPolyvantis: isPolyvantisPressFeed(feed),
    isLinxens: isLinxensNewsFeed(feed),
    isVtt: isVttNewsFeed(feed),
    isKinegram: isKinegramInsightsFeed(feed),
    isKoenigBauer: isKoenigBauerPressReleasesFeed(feed),
    isAtlanticZeiser: isAtlanticZeiserNewsFeed(feed),
    shouldReplace: shouldReplaceArticlesOnSync(feed),
  };
}

function shouldBypassDedicatedVendorSourceRelevance(feed) {
  return isTrackedVendorWebsiteFeed(feed);
}

function isGenericWebsiteActionLabel(value) {
  const normalized = sanitizeFeedText(value, "").toLowerCase();
  return ["more", "read more", "discover more", "learn more"].includes(normalized);
}

function findNearbyWebsiteHeadingText($, node) {
  const directCandidates = [
    node.prevAll("h1, h2, h3, h4, .feature-title, [class*='title']").first(),
    node.parent().prevAll("h1, h2, h3, h4, .feature-title, [class*='title']").first(),
    node.closest("article, li, section").find("h1, h2, h3, h4, .feature-title, [class*='title']").first(),
    node.closest("div").parent().find("h1, h2, h3, h4, .feature-title, [class*='title']").first(),
  ];

  for (const candidateNode of directCandidates) {
    const text = sanitizeFeedText(candidateNode?.text?.() || "", "");
    if (text && !isGenericWebsiteActionLabel(text)) {
      return text;
    }
  }

  const ancestorBlocks = node.parents("div, article, li, section").toArray().slice(0, 6);
  for (const ancestor of ancestorBlocks) {
    const ancestorNode = $(ancestor);
    const text = sanitizeFeedText(
      ancestorNode.find("h1, h2, h3, h4, .feature-title, [class*='title']").first().text(),
      ""
    );
    if (text && !isGenericWebsiteActionLabel(text)) {
      return text;
    }
  }

  return "";
}

function findNearbyWebsiteDate($, node) {
  const dateSelectors = "time, [datetime], .date, [class*='date'], [class*='meta']";
  const directCandidates = [
    node.prevAll(dateSelectors).first(),
    node.parent().prevAll(dateSelectors).first(),
    node.closest("article, li, section").find(dateSelectors).first(),
    node.closest("div").parent().find(dateSelectors).first(),
  ];

  for (const candidateNode of directCandidates) {
    const structuredValue =
      candidateNode?.attr?.("datetime") ||
      candidateNode?.attr?.("content") ||
      candidateNode?.text?.() ||
      "";
    const parsed =
      parseWebsiteDate(structuredValue) ||
      parseWebsiteDateFromText(structuredValue);
    if (parsed) {
      return parsed;
    }
  }

  const ancestorBlocks = node.parents("div, article, li, section").toArray().slice(0, 6);
  for (const ancestor of ancestorBlocks) {
    const ancestorNode = $(ancestor);
    const structuredValue =
      ancestorNode.find(dateSelectors).first().attr("datetime") ||
      ancestorNode.find(dateSelectors).first().attr("content") ||
      ancestorNode.find(dateSelectors).first().text() ||
      ancestorNode.prevAll(dateSelectors).first().attr("datetime") ||
      ancestorNode.prevAll(dateSelectors).first().text() ||
      ancestorNode.text();
    const parsed =
      parseWebsiteDate(structuredValue) ||
      parseWebsiteDateFromText(structuredValue);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

async function fetchWebsitePublishedDateForLink(link) {
  if (!link) {
    return null;
  }

  try {
    const response = await fetchWebsiteHtml(link);
    const html = String(response.data || "");
    if (!html) {
      return null;
    }

    const $ = cheerio.load(html);
    return extractWebsitePublishedDate($, link);
  } catch {
    return null;
  }
}

function matchesWebsiteSourceCandidatePolicy(feed, link) {
  const lowerLink = String(link || "").toLowerCase();

  if (isCbpNewsFeed(feed)) {
    return (
      lowerLink.includes("/newsroom/") &&
      (
        lowerLink.includes("/national-media-release/") ||
        lowerLink.includes("/local-media-release/") ||
        lowerLink.includes("/media-release/") ||
        lowerLink.includes("/announcements/")
      )
    );
  }

  if (isGovUkNewsFeed(feed)) {
    return lowerLink.includes("/government/news/");
  }

  if (isLandqartNewsFeed(feed)) {
    return lowerLink.includes("/en/stories/news/") && !lowerLink.endsWith("/en/stories/news");
  }

  if (isPolyvantisPressFeed(feed)) {
    return lowerLink.includes("/en/press/") && !lowerLink.endsWith("/en/press");
  }

  if (isLinxensNewsFeed(feed)) {
    return lowerLink.includes("/en/news-events/") && !lowerLink.includes("/en/insight-hub/");
  }

  if (isVttNewsFeed(feed)) {
    return (
      lowerLink.includes("/en/news-and-ideas/") &&
      !lowerLink.includes("/services/") &&
      !lowerLink.includes("/ourservices/") &&
      !lowerLink.includes("/industries/")
    );
  }

  if (isKinegramInsightsFeed(feed)) {
    return lowerLink.includes("/events-insights/details/");
  }

  if (isKoenigBauerPressReleasesFeed(feed)) {
    return lowerLink.includes("/en/newsroom/press-releases/article/");
  }

  if (isAtlanticZeiserNewsFeed(feed)) {
    return lowerLink.includes("/en/news/") && lowerLink !== ATLANTIC_ZEISER_NEWS_URL;
  }

  return true;
}

function resolveRelativeWebsiteLink(href, pageUrl) {
  try {
    return href ? new URL(href, pageUrl).toString() : "";
  } catch {
    return "";
  }
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

  if (normalized.includes("s.w.org/images/core/emoji")) {
    return false;
  }

  if (
    normalized.includes("/profiles/cbpd8_gov/themes/custom/cbpd8_gov_theme/") ||
    normalized.includes("/themes/custom/cbpd8_gov_theme/") ||
    normalized.includes("/sites/default/files/cbp-seal-vertical-blue_twitter-card") ||
    /\/sites\/default\/files\/(?:styles\/[^/]+\/public\/)?[^/?#]*_card_[^/?#]*\.(?:jpe?g|png|webp)(?:$|[?#.])/i.test(normalized)
  ) {
    return false;
  }

  if (["logo", "icon", "avatar", "org-member-transparent", "pixel", "tracking"].some((token) => normalized.includes(token))) {
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
    if (
      pathname.includes("/binaries/content/gallery/") &&
      /\.(?:jpg|jpeg|png|gif|webp|avif|svg)(?:\/|$)/i.test(pathname)
    ) {
      return true;
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
    !isLikelyGenericMetadataImage(value) &&
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
    ".news-date",
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
    isoDate: publishedDate ? publishedDate.toISOString() : "",
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

function getWebsiteCandidateTitle($, anchor) {
  const anchorText = sanitizeFeedText($(anchor).text(), "");
  const genericAnchorText = [
    "more",
    "read more",
    "learn more",
    "discover more",
    "discover",
    "view more",
  ];
  const normalizedAnchorText = anchorText.toLowerCase();
  const primaryContainers = [
    $(anchor).closest("article"),
    $(anchor).closest("li"),
    $(anchor).closest("section"),
    $(anchor).closest("div"),
  ];

  for (const container of primaryContainers) {
    if (!container || !container.length) {
      continue;
    }

    const headingText = sanitizeFeedText(
      container.find("h1, h2, h3, h4, h5, h6, [class*='title'], [class*='headline']").first().text(),
      ""
    );
    if (headingText && headingText.toLowerCase() !== normalizedAnchorText) {
      return headingText;
    }
  }

  if (!genericAnchorText.includes(normalizedAnchorText)) {
    return anchorText;
  }

  const previousHeading = sanitizeFeedText(
    $(anchor).prevAll("h1, h2, h3, h4, h5, h6").first().text(),
    ""
  );
  if (previousHeading) {
    return previousHeading;
  }

  return anchorText;
}

function scoreWebsiteAnchor($, anchor, pageUrl) {
  const href = $(anchor).attr("href") || "";
  const text = getWebsiteCandidateTitle($, anchor);
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

  const dayMonthYearMatch = text.match(
    /\b\d{1,2}\.?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)[a-z]*\s+\d{4}\b/i
  );
  if (dayMonthYearMatch) {
    const normalized = dayMonthYearMatch[0].replace(/\./g, "");
    const parsed = parseWebsiteDate(normalized);
    if (parsed) {
      return parsed;
    }
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

function buildLandqartNewsCandidate($, anchor, pageUrl) {
  const node = $(anchor);
  const href = node.attr("href") || "";
  const link = resolveRelativeWebsiteLink(href, pageUrl);
  if (!link) {
    return null;
  }

  const title =
    findNearbyWebsiteHeadingText($, node) ||
    (isGenericWebsiteActionLabel(node.text()) ? "" : sanitizeFeedText(node.text(), ""));
  const excerpt =
    sanitizeFeedText(node.prevAll("p").first().text(), "") ||
    sanitizeFeedText(node.closest("li, article, div").find("p").first().text(), "");
  const date =
    findNearbyWebsiteDate($, node) ||
    parseWebsiteDate(node.closest("li, article, div").find("time").first().attr("datetime") || "") ||
    parseWebsiteDateFromText(node.prevAll().text()) ||
    parseWebsiteDateFromText(node.closest("li, article, div").text());

  return {
    title,
    link,
    excerpt,
    date,
  };
}

async function extractLandqartNewsItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  $("main a[href*='/en/stories/news/'], a[href*='/en/stories/news/']")
    .toArray()
    .forEach((anchor) => {
      const href = $(anchor).attr("href") || "";
      const link = resolveRelativeWebsiteLink(href, pageUrl);
      if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
        return;
      }

      const canonicalLink = canonicalizeUrl(link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      const candidate = buildLandqartNewsCandidate($, anchor, pageUrl);
      if (!candidate?.title || !candidate.link) {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push(candidate);
    });

  const validatedItems = [];
  for (const candidate of discoveredCandidates) {
    if (!shouldBypassDedicatedVendorSourceRelevance(feed) && !articleMatchesSourceRelevanceRule(feed, {
      title: candidate.title,
      link: candidate.link,
      contentSnippet: candidate.excerpt || "",
    })) {
      continue;
    }

    validatedItems.push({
      title: candidate.title,
      link: candidate.link,
      isoDate: candidate.date ? candidate.date.toISOString() : new Date().toISOString(),
      contentSnippet: candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  logTrackedVendorWebsiteFeedState(feed, "extract-landqart-complete", {
    discoveredCount: discoveredCandidates.length,
    validatedCount: validatedItems.length,
    pageUrl,
  });

  return validatedItems;
}

async function extractPolyvantisPressItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  $(".mod_newsarchive a[href*='/en/press/'], main a[href*='/en/press/']")
    .toArray()
    .forEach((anchor) => {
      const node = $(anchor);
      const href = node.attr("href") || "";
      const link = resolveRelativeWebsiteLink(href, pageUrl);
      if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
        return;
      }
      const canonicalLink = canonicalizeUrl(link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      const container = node.closest("article, li, div");
      const rawText = sanitizeFeedText(
        container.text() || node.text(),
        ""
      );
      const dateMatch = rawText.match(/\b\d{1,2}\.\s+[A-Za-z]+\s+\d{4}\b/);
      const title =
        sanitizeFeedText(node.attr("title"), "") ||
        sanitizeFeedText(node.find("h1, h2, h3, h4").first().text(), "") ||
        sanitizeFeedText(container.find("h1, h2, h3, h4").first().text(), "") ||
        sanitizeFeedText(node.text(), "");
      if (!title || title.toLowerCase() === "more") {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push({
        title,
        link,
        excerpt:
          sanitizeFeedText(container.find("p").first().text(), "") ||
          sanitizeFeedText(rawText.replace(title, "").replace(/\s*More\s*$/i, ""), "") ||
          title,
        date:
          parseWebsiteDateFromText(container.find(".plexiglas-teaser__date").first().text()) ||
          parseWebsiteDateFromText(dateMatch?.[0] || ""),
      });
    });

  const validatedItems = [];
  for (const candidate of discoveredCandidates) {
    const resolvedCandidate = await (async () => {
      try {
        const response = await fetchWebsiteHtml(candidate.link);
        const fetchedUrl = response.request?.res?.responseUrl || candidate.link;
        const html = String(response.data || "");
        if (!html) {
          return candidate;
        }

        const articlePage = cheerio.load(html);
        const canonicalHref =
          articlePage("link[rel='canonical']").first().attr("href") ||
          articlePage('link[rel="canonical"]').first().attr("href") ||
          fetchedUrl;
        const resolvedLink = resolveRelativeWebsiteLink(canonicalHref, fetchedUrl) || fetchedUrl;
        if (
          !matchesWebsiteSourceCandidatePolicy(feed, resolvedLink) ||
          String(resolvedLink).toLowerCase().includes("-copy")
        ) {
          return null;
        }

        const resolvedTitle =
          sanitizeFeedText(articlePage("h1").first().text(), "") ||
          sanitizeFeedText(articlePage('meta[property="og:title"]').attr("content"), "") ||
          sanitizeFeedText(articlePage("title").first().text(), "") ||
          candidate.title;
        const resolvedExcerpt =
          extractWebsiteArticleBody(articlePage) ||
          sanitizeFeedText(articlePage('meta[property="og:description"]').attr("content"), "") ||
          candidate.excerpt ||
          resolvedTitle;
        const resolvedDate =
          extractWebsitePublishedDate(articlePage, resolvedLink) ||
          candidate.date ||
          null;

        return {
          ...candidate,
          title: resolvedTitle || candidate.title,
          link: resolvedLink,
          excerpt: resolvedExcerpt || candidate.excerpt || "",
          date: resolvedDate,
        };
      } catch {
        return null;
      }
    })();

    if (!resolvedCandidate?.title || !resolvedCandidate.link) {
      continue;
    }

    const resolvedDate = resolvedCandidate.date || (await fetchWebsitePublishedDateForLink(resolvedCandidate.link));
    if (!shouldBypassDedicatedVendorSourceRelevance(feed) && !articleMatchesSourceRelevanceRule(feed, {
      title: resolvedCandidate.title,
      link: resolvedCandidate.link,
      contentSnippet: resolvedCandidate.excerpt || "",
    })) {
      continue;
    }

    validatedItems.push({
      title: resolvedCandidate.title,
      link: resolvedCandidate.link,
      isoDate: resolvedDate ? resolvedDate.toISOString() : new Date().toISOString(),
      contentSnippet: resolvedCandidate.excerpt || "",
      author: "",
      source: getSourceName(resolvedCandidate.link),
    });
  }

  logTrackedVendorWebsiteFeedState(feed, "extract-polyvantis-complete", {
    discoveredCount: discoveredCandidates.length,
    validatedCount: validatedItems.length,
    pageUrl,
  });

  return validatedItems;
}

async function extractLinxensNewsItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();
  let currentPage = 1;
  let totalPages = 1;

  while (currentPage <= totalPages) {
    const pageUrlWithPagination = `${LINXENS_NEWS_AJAX_URL}?page=${currentPage}`;
    const response = await fetchWebsiteHtml(pageUrlWithPagination);
    const ajaxHtml = String(response.data || "");
    const ajax$ = cheerio.load(ajaxHtml);

    const discoveredPageCandidates = [];
    ajax$("article.my-3, article.item")
      .toArray()
      .forEach((block) => {
        const node = ajax$(block);
        const href = node.find("a[href*='/en/news-events/']").first().attr("href") || "";
        const link = resolveRelativeWebsiteLink(href, LINXENS_NEWS_AJAX_URL);
        if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
          return;
        }
        const canonicalLink = canonicalizeUrl(link);
        if (!canonicalLink || seenLinks.has(canonicalLink)) {
          return;
        }

        const text =
          sanitizeFeedText(node.find("h3").first().text(), "") ||
          sanitizeFeedText(node.find("a[href*='/en/news-events/']").first().text(), "");
        if (!text) {
          return;
        }

        const image = resolveFeedImageCandidate(link, node.find("img").first().attr("src") || "");
        seenLinks.add(canonicalLink);
        discoveredPageCandidates.push({
          title: text,
          link,
          excerpt: sanitizeFeedText(node.find("p").first().text(), ""),
          date: parseWebsiteDateFromText(node.find(".small.upper.green").first().text()),
          image,
        });
      });

    const paginationPages = ajax$("a[data-page]")
      .toArray()
      .map((element) => Number.parseInt(String(ajax$(element).attr("data-page") || ""), 10))
      .filter((value) => Number.isFinite(value) && value > 0);
    totalPages = Math.max(totalPages, paginationPages.length ? Math.max(...paginationPages) : currentPage);
    discoveredCandidates.push(...discoveredPageCandidates);

    if (!discoveredPageCandidates.length && currentPage > 1) {
      break;
    }

    currentPage += 1;
  }

  const validatedItems = [];
  for (const candidate of discoveredCandidates) {
    const resolvedDate = candidate.date || (await fetchWebsitePublishedDateForLink(candidate.link));
    if (!shouldBypassDedicatedVendorSourceRelevance(feed) && !articleMatchesSourceRelevanceRule(feed, {
      title: candidate.title,
      link: candidate.link,
      contentSnippet: candidate.excerpt || "",
    })) {
      continue;
    }

    validatedItems.push({
      title: candidate.title,
      link: candidate.link,
      isoDate: resolvedDate ? resolvedDate.toISOString() : new Date().toISOString(),
      contentSnippet: candidate.excerpt || "",
      image: candidate.image || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  logTrackedVendorWebsiteFeedState(feed, "extract-linxens-complete", {
    discoveredCount: discoveredCandidates.length,
    validatedCount: validatedItems.length,
    pageUrl,
  });

  return validatedItems;
}

async function extractVttNewsItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  $(".view--news-and-ideas .views-row, .views-infinite-scroll-content-wrapper .views-row")
    .toArray()
    .forEach((block) => {
      const node = $(block);
      const href = node.find("a.card__url[href*='/en/news-and-ideas/']").first().attr("href") || "";
      const link = resolveRelativeWebsiteLink(href, pageUrl);
      if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
        return;
      }
      const canonicalLink = canonicalizeUrl(link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      const rawText = sanitizeFeedText(node.text(), "");
      const text = sanitizeFeedText(node.find(".node__title, .card__title--content").first().text(), "");
      if (!text) {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push({
        title: text,
        link,
        excerpt: sanitizeFeedText(node.find(".card__body, .card__content").text(), ""),
        date:
          parseWebsiteDate(node.find(".published-at time").first().attr("datetime") || "") ||
          parseWebsiteDateFromText(node.find(".published-at time").first().text()) ||
          parseWebsiteDateFromText(rawText),
      });
    });

  const validatedItems = [];
  for (const candidate of discoveredCandidates) {
    const resolvedDate = candidate.date || (await fetchWebsitePublishedDateForLink(candidate.link));
    if (!shouldBypassDedicatedVendorSourceRelevance(feed) && !articleMatchesSourceRelevanceRule(feed, {
      title: candidate.title,
      link: candidate.link,
      contentSnippet: candidate.excerpt || "",
    })) {
      continue;
    }

    validatedItems.push({
      title: candidate.title,
      link: candidate.link,
      isoDate: resolvedDate ? resolvedDate.toISOString() : new Date().toISOString(),
      contentSnippet: candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  logTrackedVendorWebsiteFeedState(feed, "extract-vtt-complete", {
    discoveredCount: discoveredCandidates.length,
    validatedCount: validatedItems.length,
    pageUrl,
  });

  return validatedItems;
}

async function extractKinegramInsightsItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  $("a[href*='/events-insights/details/']")
    .toArray()
    .forEach((anchor) => {
      const node = $(anchor);
      const href = node.attr("href") || "";
      const link = resolveRelativeWebsiteLink(href, pageUrl);
      if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
        return;
      }
      const canonicalLink = canonicalizeUrl(link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      const title =
        sanitizeFeedText(node.text(), "") ||
        sanitizeFeedText(node.attr("title"), "") ||
        findNearbyWebsiteHeadingText($, node);
      if (!title) {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push({
        title,
        link,
        excerpt: sanitizeFeedText(node.closest("article, li, div").text(), "").replace(title, "").trim(),
        date: findNearbyWebsiteDate($, node),
      });
    });

  const validatedItems = [];
  for (const candidate of discoveredCandidates) {
    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch(() => null);
    if (!validated?.accepted) {
      continue;
    }

    const resolvedLink = validated.canonicalLink || candidate.link;
    if (!String(resolvedLink || "").includes("/events-insights/details/")) {
      continue;
    }

    const resolvedDate =
      (validated.isoDate ? new Date(validated.isoDate) : null) ||
      (await fetchWebsitePublishedDateForLink(resolvedLink)) ||
      candidate.date;

    validatedItems.push({
      title: validated.title || candidate.title,
      link: resolvedLink,
      isoDate: resolvedDate ? resolvedDate.toISOString() : new Date().toISOString(),
      image: validated.image || "",
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(resolvedLink),
    });
  }

  logTrackedVendorWebsiteFeedState(feed, "extract-kinegram-complete", {
    discoveredCount: discoveredCandidates.length,
    validatedCount: validatedItems.length,
    pageUrl,
  });

  return validatedItems;
}

async function extractKoenigBauerPressReleaseItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  const collectCandidatesFromPage = (page$, currentPageUrl) => {
    let pageCandidateCount = 0;

    page$(".news-list-view .news-item, .full-listing .news-item, .news-item")
      .toArray()
      .forEach((block) => {
        const node = page$(block);
        let anchor = node.find("a.stretched-link[href*='/en/newsroom/press-releases/article/']").first();
        if (!anchor.length) {
          anchor = node.find("h1 a[href], h2 a[href], h3 a[href], h4 a[href]").first();
        }
        const href = anchor.attr("href") || "";
        const link = resolveRelativeWebsiteLink(href, currentPageUrl);
        if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
          return;
        }

        const canonicalLink = canonicalizeUrl(link);
        if (!canonicalLink || seenLinks.has(canonicalLink)) {
          return;
        }

        const title =
          sanitizeFeedText(anchor.attr("title"), "") ||
          sanitizeFeedText(anchor.text(), "") ||
          sanitizeFeedText(node.find("[itemprop='headline'], h1, h2, h3, h4").first().text(), "");
        if (!title) {
          return;
        }

        const imageNode = node.find("img").first();
        const image =
          pickImageFromSrcset(imageNode.attr("srcset") || imageNode.attr("data-srcset") || "") ||
          imageNode.attr("src") ||
          imageNode.attr("data-src") ||
          "";

        seenLinks.add(canonicalLink);
        pageCandidateCount += 1;
        discoveredCandidates.push({
          title,
          link,
          excerpt: sanitizeFeedText(
            node.find(".spotlight__text p, .text p, [itemprop='description'] p, p").first().text(),
            ""
          ),
          date:
            parseWebsiteDate(node.find("time").first().attr("datetime") || "") ||
            parseWebsiteDateFromText(node.find("time").first().text()),
          image: resolveFeedImageCandidate(link, image),
        });
      });

    return pageCandidateCount;
  };

  const pagesScanned = [{ page: 1, url: pageUrl, candidates: collectCandidatesFromPage($, pageUrl) }];
  for (let page = 2; page <= KOENIG_BAUER_MAX_ARCHIVE_PAGES; page += 1) {
    if (discoveredCandidates.length >= KOENIG_BAUER_MAX_CANDIDATES) {
      break;
    }

    const archiveUrl = `${KOENIG_BAUER_PRESS_RELEASES_URL}/page-${page}`;
    const pageResponse = await fetchWebsiteHtml(archiveUrl).catch((error) => {
      console.warn(`[KOENIG_BAUER] failed to inspect ${archiveUrl}:`, error?.message || error);
      return null;
    });
    if (!pageResponse) {
      break;
    }

    const archivePageUrl = pageResponse.request?.res?.responseUrl || archiveUrl;
    const page$ = cheerio.load(String(pageResponse.data || ""));
    const pageCandidates = collectCandidatesFromPage(page$, archivePageUrl);
    pagesScanned.push({ page, url: archivePageUrl, candidates: pageCandidates });
    if (!pageCandidates) {
      break;
    }
  }

  const validatedItems = [];
  for (const candidate of discoveredCandidates.slice(0, KOENIG_BAUER_MAX_CANDIDATES)) {
    const item = {
      title: candidate.title,
      link: candidate.link,
      contentSnippet: candidate.excerpt || "",
    };
    if (!shouldBypassDedicatedVendorSourceRelevance(feed) && !articleMatchesSourceRelevanceRule(feed, item)) {
      continue;
    }

    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });
    if (!validated?.accepted) {
      continue;
    }

    const contentSnippet =
      String(validated.contentSnippet || "").length >= String(candidate.excerpt || "").length
        ? validated.contentSnippet
        : candidate.excerpt;

    validatedItems.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      image: validated.image || candidate.image || "",
      contentSnippet: contentSnippet || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  logTrackedVendorWebsiteFeedState(feed, "extract-koenig-bauer-complete", {
    discoveredCount: discoveredCandidates.length,
    validatedCount: validatedItems.length,
    pagesScanned: pagesScanned.length,
    pageUrl,
  });

  return validatedItems;
}

async function extractAtlanticZeiserNewsItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  const collectCandidatesFromPage = (page$, currentPageUrl) => {
    let pageCandidateCount = 0;

    page$(".view-content .views-row, .views-row")
      .toArray()
      .forEach((block) => {
        const node = page$(block);
        const anchor = node.find("a.news-block[href*='/en/news/']").first();
        const href = anchor.attr("href") || "";
        const link = resolveRelativeWebsiteLink(href, currentPageUrl);
        if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
          return;
        }

        const canonicalLink = canonicalizeUrl(link);
        if (!canonicalLink || seenLinks.has(canonicalLink)) {
          return;
        }

        const title =
          sanitizeFeedText(node.find(".field--name-title").first().text(), "") ||
          sanitizeFeedText(anchor.find("h1, h2, h3, h4").first().text(), "") ||
          sanitizeFeedText(anchor.text(), "");
        if (!title) {
          return;
        }

        const imageNode = node.find(".bg-cover img, img").first();
        const image =
          pickImageFromSrcset(imageNode.attr("srcset") || imageNode.attr("data-srcset") || "") ||
          imageNode.attr("src") ||
          imageNode.attr("data-src") ||
          "";

        seenLinks.add(canonicalLink);
        pageCandidateCount += 1;
        discoveredCandidates.push({
          title,
          link,
          excerpt: sanitizeFeedText(anchor.text(), "").replace(title, "").replace(/show more/i, "").trim(),
          date:
            parseWebsiteDate(anchor.find("time").first().attr("datetime") || "") ||
            parseWebsiteDateFromText(anchor.find("time").first().text()) ||
            parseWebsiteDateFromText(node.find("time").first().text()),
          image: resolveFeedImageCandidate(link, image),
        });
      });

    return pageCandidateCount;
  };

  const pagesScanned = [{ page: 0, url: pageUrl, candidates: collectCandidatesFromPage($, pageUrl) }];
  for (let page = 1; page < ATLANTIC_ZEISER_MAX_ARCHIVE_PAGES; page += 1) {
    if (discoveredCandidates.length >= ATLANTIC_ZEISER_MAX_CANDIDATES) {
      break;
    }

    const archiveUrl = `${ATLANTIC_ZEISER_NEWS_URL}?page=${page}`;
    const pageResponse = await fetchWebsiteHtml(archiveUrl).catch((error) => {
      console.warn(`[ATLANTIC_ZEISER] failed to inspect ${archiveUrl}:`, error?.message || error);
      return null;
    });
    if (!pageResponse) {
      break;
    }

    const archivePageUrl = pageResponse.request?.res?.responseUrl || archiveUrl;
    const page$ = cheerio.load(String(pageResponse.data || ""));
    const pageCandidates = collectCandidatesFromPage(page$, archivePageUrl);
    pagesScanned.push({ page, url: archivePageUrl, candidates: pageCandidates });
    if (!pageCandidates) {
      break;
    }
  }

  const validatedItems = [];
  for (const candidate of discoveredCandidates.slice(0, ATLANTIC_ZEISER_MAX_CANDIDATES)) {
    if (!shouldBypassDedicatedVendorSourceRelevance(feed) && !articleMatchesSourceRelevanceRule(feed, {
      title: candidate.title,
      link: candidate.link,
      contentSnippet: candidate.excerpt || "",
    })) {
      continue;
    }

    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });
    if (!validated?.accepted) {
      continue;
    }

    const validatedImage = isLikelyGenericMetadataImage(validated.image) ? "" : validated.image;
    const contentSnippet =
      String(validated.contentSnippet || "").length >= String(candidate.excerpt || "").length
        ? validated.contentSnippet
        : candidate.excerpt;

    validatedItems.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      image: candidate.image || validatedImage || "",
      contentSnippet: contentSnippet || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  logTrackedVendorWebsiteFeedState(feed, "extract-atlantic-zeiser-complete", {
    discoveredCount: discoveredCandidates.length,
    validatedCount: validatedItems.length,
    pagesScanned: pagesScanned.length,
    pageUrl,
  });

  return validatedItems;
}

async function extractCbpNewsItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  $("a[href*='/newsroom/']")
    .toArray()
    .forEach((anchor) => {
      const node = $(anchor);
      const href = node.attr("href") || "";
      const link = resolveRelativeWebsiteLink(href, pageUrl);
      if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
        return;
      }

      const canonicalLink = canonicalizeUrl(link);
      if (!canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      const title =
        sanitizeFeedText(node.text(), "") ||
        sanitizeFeedText(node.attr("title"), "") ||
        findNearbyWebsiteHeadingText($, node);
      if (!title || title.toLowerCase() === "media releases") {
        return;
      }

      seenLinks.add(canonicalLink);
      discoveredCandidates.push({
        title,
        link,
        excerpt: sanitizeFeedText(node.closest("article, li, div").text(), "").replace(title, "").trim(),
        date: findNearbyWebsiteDate($, node),
      });
    });

  const validatedItems = [];
  for (const candidate of discoveredCandidates) {
    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch(() => null);
    if (!validated?.accepted) {
      continue;
    }

    validatedItems.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      image: validated.image || "",
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  return validatedItems;
}

async function extractGovUkNewsItems(feed, $, pageUrl) {
  const atomHref = $('link[rel="alternate"][type="application/atom+xml"]').first().attr("href") || "";
  const atomUrl = resolveRelativeWebsiteLink(atomHref, pageUrl);
  if (!atomUrl) {
    return [];
  }

  const parsedFeed = await parser.parseURL(atomUrl);
  const rawItems = Array.isArray(parsedFeed.items) ? parsedFeed.items : [];
  const seenLinks = new Set();

  return rawItems
    .map((item) => {
      const link = resolveItemLink(item);
      const canonicalLink = canonicalizeUrl(link);
      if (!link || !canonicalLink || seenLinks.has(canonicalLink)) {
        return null;
      }
      if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
        return null;
      }

      seenLinks.add(canonicalLink);
      return {
        title: sanitizeFeedText(item.title, ""),
        link,
        isoDate: item.isoDate || item.pubDate || "",
        contentSnippet: sanitizeFeedText(item.contentSnippet || item.summary || item.content || "", ""),
        author: sanitizeFeedText(item.creator || item.author || "", ""),
        source: "gov.uk",
      };
    })
    .filter((item) => item && item.title);
}

function isEuLisaNewsEventArticleUrl(link) {
  try {
    const parsed = new URL(String(link || ""));
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, "");
    if (hostname !== "eulisa.europa.eu") {
      return false;
    }
    return (
      pathname.startsWith("/news-and-events/newsroom/") ||
      pathname.startsWith("/newsroom/") ||
      pathname.startsWith("/news-and-events/events/") ||
      pathname.startsWith("/news-and-events/news/")
    );
  } catch {
    return false;
  }
}

function buildEuLisaNewsCandidate($, block, pageUrl) {
  const node = $(block);
  const anchor = node.is("a[href]") ? node : node.find("a[href]").first();
  const href = anchor.attr("href") || "";
  const link = resolveRelativeWebsiteLink(href, pageUrl);
  if (!link || !isEuLisaNewsEventArticleUrl(link)) {
    return null;
  }

  const title =
    sanitizeFeedText(anchor.text(), "") ||
    sanitizeFeedText(node.find("h1, h2, h3, h4").first().text(), "");
  if (!title || isBlockedWebsiteNavTitle(title)) {
    return null;
  }

  return {
    title,
    link,
    excerpt: sanitizeFeedText(node.closest("article, li, div").text(), "").replace(title, "").trim(),
    date:
      parseWebsiteDate(node.find("time").first().attr("datetime") || "") ||
      parseWebsiteDateFromText(node.text()) ||
      null,
  };
}

async function extractEuLisaNewsItems(feed, $, pageUrl) {
  const candidates = [];
  const seenLinks = new Set();

  $("main a[href], [role='main'] a[href], article a[href], .view-content a[href], a[href]")
    .toArray()
    .forEach((anchor) => {
      const candidate = buildEuLisaNewsCandidate($, anchor, pageUrl);
      const canonicalLink = canonicalizeUrl(candidate?.link || "");
      if (!candidate || !canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }
      seenLinks.add(canonicalLink);
      candidates.push(candidate);
    });

  const validatedItems = [];
  for (const candidate of candidates.slice(0, 30)) {
    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });
    if (!validated?.accepted) {
      if (validated?.reason) {
        console.log(`Rejected eu-LISA candidate ${candidate.link}: ${validated.reason}`);
      }
      continue;
    }

    validatedItems.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      image: validated.image || "",
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  return validatedItems;
}

function buildIndNewsCandidate($, block, pageUrl) {
  const node = $(block);
  const anchor = node.find("a.article__link, .article__body a").first();
  const href = anchor.attr("href") || "";
  const link = resolveRelativeWebsiteLink(href, pageUrl);
  if (!link) {
    return null;
  }

  let pathname = "";
  try {
    pathname = new URL(link).pathname.toLowerCase();
  } catch {
    return null;
  }

  if (!pathname.startsWith("/en/news/") || pathname === "/en/news") {
    return null;
  }

  const title =
    sanitizeFeedText(anchor.text(), "") ||
    sanitizeFeedText(node.find(".article__title").first().text(), "");
  if (!title) {
    return null;
  }

  return {
    title,
    link,
    excerpt: sanitizeFeedText(node.find(".article__description").first().text(), ""),
    date:
      parseWebsiteDate(node.find("time").first().attr("datetime") || "") ||
      parseWebsiteDateFromText(node.find("time").first().text()) ||
      null,
  };
}

async function extractIndNewsItems(feed, $, pageUrl) {
  const discoveredCandidates = [];
  const seenLinks = new Set();

  $(".view-unformatted--news-search .views-row, .view-content article.article")
    .toArray()
    .forEach((block) => {
      const candidate = buildIndNewsCandidate($, block, pageUrl);
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

  const validatedItems = [];
  for (const candidate of discoveredCandidates) {
    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });
    if (!validated?.accepted) {
      continue;
    }

    validatedItems.push({
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : new Date().toISOString()),
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    });
  }

  return validatedItems;
}

function parseIcaoListingDate(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) {
    return parseWebsiteDateFromText(value);
  }

  const [, day, month, yearValue] = match;
  const year = yearValue.length === 2 ? `20${yearValue}` : yearValue;
  return parseWebsiteDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

function buildIcaoNewsCandidate(feed, $, block, pageUrl) {
  const node = $(block);
  const anchor = node.find(".card-title a[href^='/news/'], .card-title a[href*='/news/']").first();
  const href = anchor.attr("href") || "";
  const link = resolveRelativeWebsiteLink(href, pageUrl);
  if (!link || !matchesWebsiteSourceCandidatePolicy(feed, link)) {
    return null;
  }

  const title = sanitizeFeedText(anchor.text(), "");
  if (!title || title.toLowerCase() === "icao newsroom") {
    return null;
  }

  const imageNode = node.find(".card-img img").first();
  const image =
    pickImageFromSrcset(imageNode.attr("srcset") || imageNode.attr("data-srcset") || "") ||
    imageNode.attr("src") ||
    "";

  return {
    title,
    link,
    excerpt: sanitizeFeedText(node.find(".card-contents").text(), "").replace(title, "").trim(),
    date: parseIcaoListingDate(node.find(".card-date").first().text()) || null,
    image: resolveFeedImageCandidate(link, image),
  };
}

async function extractIcaoNewsItems(feed, $, pageUrl) {
  const candidates = [];
  const seenLinks = new Set();

  $(".card-item.views-row, .views-row")
    .toArray()
    .forEach((block) => {
      const candidate = buildIcaoNewsCandidate(feed, $, block, pageUrl);
      const canonicalLink = canonicalizeUrl(candidate?.link || "");
      if (!candidate || !canonicalLink || seenLinks.has(canonicalLink)) {
        return;
      }

      seenLinks.add(canonicalLink);
      candidates.push(candidate);
    });

  const validatedItems = [];
  for (const candidate of candidates.slice(0, 24)) {
    const validated = await validateWebsiteArticleCandidate(candidate.link, candidate.title).catch((error) => {
      console.warn(`Website article validation failed for ${candidate.link}:`, error?.message || error);
      return null;
    });
    if (!validated?.accepted) {
      continue;
    }

    const item = {
      title: validated.title || candidate.title,
      link: candidate.link,
      isoDate: validated.isoDate || (candidate.date ? candidate.date.toISOString() : ""),
      image: validated.image || candidate.image || "",
      contentSnippet: validated.contentSnippet || candidate.excerpt || "",
      author: "",
      source: getSourceName(candidate.link),
    };

    if (!articleMatchesSourceRelevanceRule(feed, item)) {
      continue;
    }

    validatedItems.push(item);
  }

  return validatedItems;
}

function extractIcaoTripItems() {
  return [];
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

  if (isIndNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: ind for source ${feed.id}`);
    const items = await extractIndNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isIcaoNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: icao-news for source ${feed.id}`);
    const items = await extractIcaoNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isIcaoTripFeed(feed)) {
    console.log(`Using dedicated website extractor: icao-trip for source ${feed.id}`);
    const items = extractIcaoTripItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isCbpNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: cbp for source ${feed.id}`);
    const items = await extractCbpNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isEuLisaNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: eulisa for source ${feed.id}`);
    const items = await extractEuLisaNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isGovUkNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: govuk for source ${feed.id}`);
    const items = await extractGovUkNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isLandqartNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: landqart for source ${feed.id}`);
    const items = await extractLandqartNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isPolyvantisPressFeed(feed)) {
    console.log(`Using dedicated website extractor: polyvantis for source ${feed.id}`);
    const items = await extractPolyvantisPressItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isLinxensNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: linxens for source ${feed.id}`);
    const items = await extractLinxensNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isVttNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: vtt for source ${feed.id}`);
    const items = await extractVttNewsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isKinegramInsightsFeed(feed)) {
    console.log(`Using dedicated website extractor: kinegram for source ${feed.id}`);
    const items = await extractKinegramInsightsItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isKoenigBauerPressReleasesFeed(feed)) {
    console.log(`Using dedicated website extractor: koenig-bauer for source ${feed.id}`);
    const items = await extractKoenigBauerPressReleaseItems(feed, $, fetchedUrl);
    console.log(`Extracted ${items.length} candidate website items for source ${feed.id}`);
    return items;
  }

  if (isAtlanticZeiserNewsFeed(feed)) {
    console.log(`Using dedicated website extractor: atlantic-zeiser for source ${feed.id}`);
    const items = await extractAtlanticZeiserNewsItems(feed, $, fetchedUrl);
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

    const text = getWebsiteCandidateTitle($, anchor);
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

    if (!matchesWebsiteSourceCandidatePolicy(feed, link)) {
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

  if (isPolyvantisPressFeed(feed) && isBrokenPolyvantisPressLink(link)) {
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
  const hasUsableThumbnail = hasUsableStoredThumbnail(thumbnail);
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

  const nextPubDate = article.pubDate ? new Date(article.pubDate) : null;
  const currentPubDate = existing.pubDate ? new Date(existing.pubDate) : null;
  const shouldUpdatePubDate =
    nextPubDate &&
    !Number.isNaN(nextPubDate.getTime()) &&
    (!currentPubDate || Number.isNaN(currentPubDate.getTime()) || nextPubDate.getTime() !== currentPubDate.getTime());
  const shouldBackfillThumbnail =
    !hasUsableStoredThumbnail(existing.thumbnail) &&
    hasUsableStoredThumbnail(article.thumbnail);
  const shouldBackfillSnippet = (!existing.contentSnippet || existing.contentSnippet.length < 40) && article.contentSnippet;
  const shouldRefreshCoreMetadata =
    shouldUpdatePubDate ||
    (article.title && article.title !== existing.title) ||
    (article.link && article.link !== existing.link) ||
    (article.canonicalLink && article.canonicalLink !== existing.canonicalLink) ||
    (article.source && article.source !== existing.source) ||
    (article.feedName && article.feedName !== existing.feedName) ||
    (article.summary && article.summary !== existing.summary) ||
    (article.summaryShort && article.summaryShort !== existing.summaryShort) ||
    (article.contentSnippet && article.contentSnippet !== existing.contentSnippet);

  if (shouldBackfillThumbnail || shouldBackfillSnippet || shouldRefreshCoreMetadata) {
    const updated = await updateArticle(existing.id, {
      title: article.title || existing.title,
      normalizedTitle: article.normalizedTitle || existing.normalizedTitle,
      link: article.link || existing.link,
      canonicalLink: article.canonicalLink || existing.canonicalLink,
      source: article.source || existing.source,
      feedName: article.feedName || existing.feedName,
      pubDate: shouldUpdatePubDate ? nextPubDate.toISOString() : existing.pubDate,
      thumbnail: shouldBackfillThumbnail ? article.thumbnail : existing.thumbnail,
      contentSnippet: article.contentSnippet || existing.contentSnippet,
      summary: article.summary || existing.summary,
      summaryShort: article.summaryShort || existing.summaryShort,
      keywords: article.keywords?.length ? article.keywords : existing.keywords,
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

async function enrichDirectArticleThumbnail(feed, article) {
  if (!article || hasUsableStoredThumbnail(article.thumbnail)) {
    return article;
  }

  if (!isGovUkNewsFeed(feed)) {
    return article;
  }

  const enriched = await scrapeArticleMetadata(
    article.link,
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
  ).catch(() => null);

  const nextThumbnail = normalizeText(enriched?.thumbnail, "");
  if (!hasUsableStoredThumbnail(nextThumbnail)) {
    return article;
  }

  return {
    ...article,
    thumbnail: nextThumbnail,
    thumbnailSource: enriched?.thumbnailSource || "website-direct-enrichment",
    fetchStatus: "enriched",
    canonicalLink: enriched?.canonicalLink || article.canonicalLink,
    contentSnippet: enriched?.contentSnippet || article.contentSnippet,
    language: enriched?.language || article.language,
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

  const articleId = String(article.id);
  if (queuedThumbnailEnrichmentIds.has(articleId) || activeThumbnailEnrichmentIds.has(articleId)) {
    return;
  }

  const totalQueuedWork = thumbnailEnrichmentQueue.length + activeThumbnailEnrichmentCount;
  if (totalQueuedWork >= env.thumbnailEnrichmentMaxQueue) {
    console.warn(
      `[thumbnail-enrichment] skipped articleId=${articleId} reason=queue_full queued=${thumbnailEnrichmentQueue.length} active=${activeThumbnailEnrichmentCount} max=${env.thumbnailEnrichmentMaxQueue}`
    );
    return;
  }

  queuedThumbnailEnrichmentIds.add(articleId);
  thumbnailEnrichmentQueue.push(articleId);
  drainThumbnailEnrichmentQueue();
}

function drainThumbnailEnrichmentQueue() {
  while (
    activeThumbnailEnrichmentCount < env.thumbnailEnrichmentConcurrency &&
    thumbnailEnrichmentQueue.length
  ) {
    const articleId = thumbnailEnrichmentQueue.shift();
    if (!articleId) {
      continue;
    }

    queuedThumbnailEnrichmentIds.delete(articleId);
    activeThumbnailEnrichmentIds.add(articleId);
    activeThumbnailEnrichmentCount += 1;

    void enrichArticle(articleId)
      .catch((enrichmentError) => {
        console.error(`Async thumbnail enrichment failed for article ${articleId}:`, enrichmentError?.stack || enrichmentError);
      })
      .finally(() => {
        activeThumbnailEnrichmentIds.delete(articleId);
        activeThumbnailEnrichmentCount = Math.max(0, activeThumbnailEnrichmentCount - 1);
        drainThumbnailEnrichmentQueue();
      });
  }
}

async function runFeedSync(feed) {
  const startedAt = new Date();
  let newArticles = 0;
  const vendorFeedLogLabel = getVendorFeedLogLabel(feed);

  try {
    console.log(`Starting feed sync for ${feed.id} (${feed.name || feed.rssUrl})`);
    logTrackedVendorWebsiteFeedState(feed, "sync-start");
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
      logTrackedVendorWebsiteFeedState(feed, "post-extract-website-items", {
        resolvedCount: resolvedItems.length,
      });
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

    if (feed.sourceType === "website" && shouldReplaceArticlesOnSync(feed)) {
      const deletedCount = await deleteArticlesByFeedId(feed.id);
      console.log(`Replaced existing website-source articles for ${feed.id}: deleted=${deletedCount}`);
      logTrackedVendorWebsiteFeedState(feed, "post-delete-existing", {
        deletedCount,
      });
    }

    for (const item of resolvedItems) {
      try {
        let normalized = normalizeItem(feed, item);
        if (!normalized) {
          logTrackedVendorWebsiteFeedState(feed, "normalize-item-null", {
            itemLink: resolveItemLink(item) || "",
            itemTitle: String(item?.title || ""),
          });
          continue;
        }

        normalized = await enrichGoogleNewsThumbnailFromSourceUrl(normalized);
        normalized = await enrichDirectArticleThumbnail(feed, normalized);

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
    const errorMessage = getErrorMessage(error);
    if (vendorFeedLogLabel) {
      console.log(
        `[${vendorFeedLogLabel}] feed_sync_error feedId=${feed.id} rssUrl=${feed.rssUrl} message=${JSON.stringify(errorMessage)}`
      );
    }
    console.error(`Feed sync error for ${feed.id}:`, error?.stack || error);
    const updatedFeed = await updateFeedRecord(feed.id, {
      lastFetchedAt: new Date(),
      lastStatus: "error",
      lastError: errorMessage,
      lastInsertedCount: newArticles
    });
    broadcast("feed:update", { type: "feed:update", feed: updatedFeed });

    await createPollLog({
      feedId: feed.id,
      startedAt,
      finishedAt: new Date(),
      status: "error",
      newArticles: 0,
      errorMessage
    });

    return { feedId: String(feed.id), newArticles: 0, error: errorMessage };
  }
}

export async function syncFeed(feed) {
  const syncKey = String(feed?.id || feed?.rssUrl || "");
  if (syncKey && inFlightFeedSyncs.has(syncKey)) {
    console.log(`[syncFeed] Reusing in-flight sync for ${syncKey}`);
    return inFlightFeedSyncs.get(syncKey);
  }

  const promise = runFeedSync(feed).finally(() => {
    if (syncKey) {
      inFlightFeedSyncs.delete(syncKey);
    }
  });

  if (syncKey) {
    inFlightFeedSyncs.set(syncKey, promise);
  }

  return promise;
}

function getRefreshMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssMb: Math.round((Number(usage.rss || 0) / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((Number(usage.heapUsed || 0) / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((Number(usage.heapTotal || 0) / 1024 / 1024) * 10) / 10,
  };
}

export async function syncAllFeeds(options = {}) {
  if (allFeedsSyncPromise) {
    console.log("[syncAllFeeds] Reusing in-flight full refresh");
    return allFeedsSyncPromise;
  }

  allFeedsSyncPromise = (async () => {
    const requestedTrigger = String(options.trigger || "manual").trim().toLowerCase() || "manual";
    const requestedConcurrency = Number(options.concurrencyOverride);
    const requestedBatchDelayMs = Number(options.batchDelayMs);
    const batchSize = Math.max(
      1,
      Number.isFinite(requestedConcurrency)
        ? Math.floor(requestedConcurrency)
        : env.pollConcurrency
    );
    const batchDelayMs = Math.max(
      0,
      Number.isFinite(requestedBatchDelayMs)
        ? Math.floor(requestedBatchDelayMs)
        : 250
    );

    console.log(
      `[syncAllFeeds] starting trigger=${requestedTrigger} concurrency=${batchSize} batchDelayMs=${batchDelayMs} refreshAbortRssMb=${env.refreshAbortRssMb}`
    );
    const feeds = await listFeedRecords({ activeOnly: true, order: "ASC" });
    const results = [];
    let abortedForMemory = false;

    for (let index = 0; index < feeds.length; index += batchSize) {
      const memoryBeforeBatch = getRefreshMemorySnapshot();
      if (env.refreshAbortRssMb > 0 && memoryBeforeBatch.rssMb >= env.refreshAbortRssMb) {
        abortedForMemory = true;
        console.warn(
          `[syncAllFeeds] aborting before batch due to memory rssMb=${memoryBeforeBatch.rssMb} thresholdMb=${env.refreshAbortRssMb} processed=${results.length}/${feeds.length} trigger=${requestedTrigger}`
        );
        break;
      }

      const batch = feeds.slice(index, index + batchSize);
      const batchNumber = Math.floor(index / batchSize) + 1;
      const totalBatches = Math.max(1, Math.ceil(feeds.length / batchSize));
      console.log(
        `[syncAllFeeds] starting batch ${batchNumber}/${totalBatches} size=${batch.length} concurrency=${batchSize} trigger=${requestedTrigger} rssMb=${memoryBeforeBatch.rssMb} heapUsedMb=${memoryBeforeBatch.heapUsedMb}`
      );
      const batchResults = await Promise.all(batch.map((feed) => syncFeed(feed)));
      results.push(...batchResults);
      const memoryAfterBatch = getRefreshMemorySnapshot();
      console.log(
        `[syncAllFeeds] completed batch ${batchNumber}/${totalBatches} processed=${results.length}/${feeds.length} trigger=${requestedTrigger} rssMb=${memoryAfterBatch.rssMb} heapUsedMb=${memoryAfterBatch.heapUsedMb}`
      );
      if (index + batchSize < feeds.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    broadcast("refresh:complete", {
      type: "refresh:complete",
      feedsProcessed: feeds.length,
      results,
      trigger: requestedTrigger,
      abortedForMemory,
    });

    return {
      feedsProcessed: feeds.length,
      results,
      trigger: requestedTrigger,
      abortedForMemory,
    };
  })().finally(() => {
    allFeedsSyncPromise = null;
  });

  return allFeedsSyncPromise;
}

export async function syncTrackedVendorWebsiteFeeds() {
  console.log("Starting bootstrap refresh for tracked vendor website feeds");
  const feeds = await listFeedRecords({ activeOnly: true, order: "ASC" });
  const vendorFeeds = feeds.filter((feed) => isTrackedVendorWebsiteFeed(feed));
  const results = [];

  for (const feed of vendorFeeds) {
    results.push(await syncFeed(feed));
  }

  return {
    feedsProcessed: vendorFeeds.length,
    results,
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

export async function inspectTrackedVendorWebsiteFeed(feed) {
  const snapshot = getTrackedVendorWebsiteFeedDebugSnapshot(feed);
  const matchedEuLisaFeed = isEuLisaNewsFeed(feed);
  if (!isTrackedVendorWebsiteFeed(feed) && !matchedEuLisaFeed) {
    return {
      ...snapshot,
      matchedTrackedVendorFeed: false,
      extractor: "generic",
      extractedCount: 0,
      sampleItems: [],
    };
  }

  const items = await extractWebsiteItems(feed);
  return {
    ...snapshot,
    matchedTrackedVendorFeed: true,
    matchedEuLisaFeed,
    extractor: snapshot.isLandqart
      ? "landqart"
      : snapshot.isPolyvantis
        ? "polyvantis"
        : snapshot.isLinxens
        ? "linxens"
        : snapshot.isVtt
          ? "vtt"
          : snapshot.isKoenigBauer
            ? "koenig-bauer"
            : snapshot.isAtlanticZeiser
              ? "atlantic-zeiser"
              : matchedEuLisaFeed
                ? "eulisa"
            : "generic",
    extractedCount: items.length,
    sampleItems: items.slice(0, 5).map((item) => ({
      title: item.title || "",
      link: item.link || "",
      isoDate: item.isoDate || item.pubDate || "",
      contentSnippet: sanitizeFeedText(item.contentSnippet || "", "").slice(0, 280),
    })),
  };
}
