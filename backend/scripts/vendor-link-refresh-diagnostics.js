import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";
import {
  formatRows,
  loadVendorPriorityRows,
  looksLikeNewsPage,
  looksLikeRss,
} from "./vendor-source-priority.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportPath = path.resolve(__dirname, "../data/source-analysis/vendor-link-refresh-report.txt");

const USER_AGENT = "Mozilla/5.0 (compatible; VendorLinkRefreshDiagnostics/1.0; +https://openai.com)";
const REQUEST_TIMEOUT_MS = 15000;

function normalizeText(value) {
  return String(value || "").trim();
}

function toAbsoluteUrl(baseUrl, candidate) {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return "";
  }
}

function getResponseUrl(response, fallbackUrl) {
  return (
    response?.request?.res?.responseUrl ||
    response?.config?.url ||
    fallbackUrl ||
    ""
  );
}

async function fetchUrl(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 5,
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  return {
    status: response.status,
    finalUrl: getResponseUrl(response, url),
    data: String(response.data || ""),
    headers: response.headers || {},
  };
}

function detectLinkedCandidates($, baseUrl) {
  const rssFeeds = [];
  const newsPages = [];

  $("link[rel='alternate'][type*='rss'], link[rel='alternate'][type*='atom']").each((_, element) => {
    const href = normalizeText($(element).attr("href"));
    const absolute = href ? toAbsoluteUrl(baseUrl, href) : "";
    if (absolute) {
      rssFeeds.push(absolute);
    }
  });

  $("a[href]").each((_, element) => {
    const href = normalizeText($(element).attr("href"));
    if (!href) {
      return;
    }
    const text = normalizeText($(element).text()).toLowerCase();
    const absolute = toAbsoluteUrl(baseUrl, href);
    if (!absolute) {
      return;
    }

    if (looksLikeRss(href) || looksLikeRss(text)) {
      rssFeeds.push(absolute);
    }
    if (looksLikeNewsPage(href) || looksLikeNewsPage(text)) {
      newsPages.push(absolute);
    }
  });

  return {
    rssFeeds: Array.from(new Set(rssFeeds)).slice(0, 10),
    newsPages: Array.from(new Set(newsPages)).slice(0, 10),
  };
}

function chooseRecommendedUrl(currentSourceUrl, redirectTarget, detectedNewsPage, detectedRssFeed) {
  if (detectedRssFeed) {
    return detectedRssFeed;
  }
  if (detectedNewsPage) {
    return detectedNewsPage;
  }
  if (redirectTarget && redirectTarget !== currentSourceUrl) {
    return redirectTarget;
  }
  return currentSourceUrl;
}

function classifyStatus({ sourceUrl, redirectTarget, detectedNewsPage, detectedRssFeed, requestStatus, errorMessage }) {
  if (errorMessage) {
    return "fetch_failed";
  }
  if (!sourceUrl) {
    return "missing_source_url";
  }
  if (detectedRssFeed) {
    return "rss_detected";
  }
  if (detectedNewsPage) {
    return "news_page_detected";
  }
  if (redirectTarget && redirectTarget !== sourceUrl) {
    return "redirected";
  }
  if (requestStatus >= 200 && requestStatus < 400) {
    return "reachable_no_better_link_found";
  }
  return "unknown";
}

async function analyzeVendorLink(vendor) {
  const currentSourceUrl = normalizeText(vendor.sourceUrl);
  if (!currentSourceUrl) {
    return {
      vendor: vendor.company,
      currentSourceUrl,
      status: "missing_source_url",
      redirectTarget: "",
      detectedNewsPage: "",
      detectedRssFeed: "",
      recommendedUrl: "",
      errorMessage: "",
    };
  }

  try {
    const response = await fetchUrl(currentSourceUrl);
    const $ = cheerio.load(response.data);
    const { rssFeeds, newsPages } = detectLinkedCandidates($, response.finalUrl);

    const detectedRssFeed = rssFeeds[0] || "";
    const detectedNewsPage = newsPages.find((candidate) => candidate !== detectedRssFeed) || newsPages[0] || "";
    const redirectTarget = response.finalUrl || currentSourceUrl;

    return {
      vendor: vendor.company,
      currentSourceUrl,
      status: classifyStatus({
        sourceUrl: currentSourceUrl,
        redirectTarget,
        detectedNewsPage,
        detectedRssFeed,
        requestStatus: response.status,
        errorMessage: "",
      }),
      redirectTarget,
      detectedNewsPage,
      detectedRssFeed,
      recommendedUrl: chooseRecommendedUrl(currentSourceUrl, redirectTarget, detectedNewsPage, detectedRssFeed),
      errorMessage: "",
    };
  } catch (error) {
    return {
      vendor: vendor.company,
      currentSourceUrl,
      status: "fetch_failed",
      redirectTarget: "",
      detectedNewsPage: "",
      detectedRssFeed: "",
      recommendedUrl: currentSourceUrl,
      errorMessage: error instanceof Error ? error.message : String(error || "unknown_error"),
    };
  }
}

function buildReportText(rows) {
  const lines = [];
  lines.push("Vendor Link Refresh Diagnostics");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  for (const row of rows) {
    lines.push(row.vendor);
    lines.push(`  current_source_url: ${row.currentSourceUrl}`);
    lines.push(`  status: ${row.status}`);
    lines.push(`  redirect_target: ${row.redirectTarget}`);
    lines.push(`  detected_news_page: ${row.detectedNewsPage}`);
    lines.push(`  detected_rss_feed: ${row.detectedRssFeed}`);
    lines.push(`  recommended_url: ${row.recommendedUrl}`);
    if (row.errorMessage) {
      lines.push(`  error: ${row.errorMessage}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  const topVendors = loadVendorPriorityRows().slice(0, 25);
  const results = [];

  for (const vendor of topVendors) {
    results.push(await analyzeVendorLink(vendor));
  }

  console.log("\n=== Vendor Link Refresh Diagnostics ===");
  console.table(formatRows(
    results.map((row) => ({
      vendor: row.vendor,
      current_source_url: row.currentSourceUrl,
      status: row.status,
      redirect_target: row.redirectTarget,
      detected_news_page: row.detectedNewsPage,
      detected_rss_feed: row.detectedRssFeed,
      recommended_url: row.recommendedUrl,
    }))
  ));

  await fs.writeFile(reportPath, buildReportText(results), "utf8");
  console.log(`\nReport written to ${reportPath}`);
}

try {
  await main();
} catch (error) {
  console.error("Failed to run vendor link refresh diagnostics.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
