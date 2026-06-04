import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import {
  formatRows,
  loadVendorPriorityRows,
  looksLikeRss,
} from "./vendor-source-priority.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportPath = path.resolve(__dirname, "../data/source-analysis/vendor-activity-report.txt");
const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: ["pubDate", "isoDate", "published", "updated", "dc:date"],
  },
});

const USER_AGENT = "Mozilla/5.0 (compatible; VendorActivityDiagnostics/1.0; +https://openai.com)";

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

function parseDateCandidate(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallbackMatch = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (fallbackMatch) {
    const [, year, month, day] = fallbackMatch;
    const fallbackDate = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }

  return null;
}

function daysBetween(now, value) {
  return Math.floor((now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24));
}

function estimateActivityScore({ latestArticleDate, last12MonthsCount, last24MonthsCount, archiveDepth }) {
  let score = 0;
  if (latestArticleDate) {
    const ageDays = daysBetween(new Date(), latestArticleDate);
    if (ageDays <= 30) {
      score += 40;
    } else if (ageDays <= 90) {
      score += 28;
    } else if (ageDays <= 180) {
      score += 18;
    } else if (ageDays <= 365) {
      score += 10;
    }
  }
  score += Math.min(30, last12MonthsCount * 2);
  score += Math.min(20, Math.max(0, last24MonthsCount - last12MonthsCount));
  score += Math.min(10, archiveDepth * 2);
  return Math.round(score);
}

async function fetchUrl(url) {
  const response = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return {
    url: response.request?.res?.responseUrl || response.config?.url || url,
    status: response.status,
    data: response.data,
    headers: response.headers || {},
  };
}

async function analyzeRssSource(url) {
  const feed = await parser.parseURL(url);
  const items = Array.isArray(feed.items) ? feed.items : [];
  const datedItems = items
    .map((item) => parseDateCandidate(item.isoDate || item.pubDate || item.published || item.updated || item["dc:date"]))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime());

  const now = new Date();
  const last12MonthsCount = datedItems.filter((date) => daysBetween(now, date) <= 365).length;
  const last24MonthsCount = datedItems.filter((date) => daysBetween(now, date) <= 730).length;

  return {
    latestArticleDate: datedItems[0] || null,
    estimatedArticlesLast12Months: last12MonthsCount,
    estimatedArticlesLast24Months: last24MonthsCount,
    archiveDepth: Math.min(6, Math.ceil(items.length / 10)),
    detectionMethod: "rss",
    fetchedUrl: url,
  };
}

function collectDateMatches($, baseUrl) {
  const candidates = [];

  $("time").each((_, element) => {
    const value = $(element).attr("datetime") || $(element).text();
    const parsed = parseDateCandidate(value);
    if (parsed) {
      candidates.push({ date: parsed, source: "time", url: baseUrl });
    }
  });

  $("[datetime], meta[property='article:published_time'], meta[name='article:published_time'], meta[name='publish-date'], meta[name='date']").each((_, element) => {
    const value = $(element).attr("datetime") || $(element).attr("content") || $(element).text();
    const parsed = parseDateCandidate(value);
    if (parsed) {
      candidates.push({ date: parsed, source: "meta", url: baseUrl });
    }
  });

  $("a, article, li, div").each((_, element) => {
    const text = $(element).text().trim();
    if (!text) {
      return;
    }
    const parsed = parseDateCandidate(text);
    if (parsed) {
      const href = $(element).attr("href") || $(element).find("a").first().attr("href") || "";
      candidates.push({ date: parsed, source: "text", url: href ? toAbsoluteUrl(baseUrl, href) : baseUrl });
    }
  });

  return candidates;
}

function estimateArchiveDepth($, baseUrl) {
  const archiveLinks = new Set();
  $("a[href]").each((_, element) => {
    const href = normalizeText($(element).attr("href"));
    if (!href) {
      return;
    }
    const text = normalizeText($(element).text()).toLowerCase();
    if (
      /page\/\d+/i.test(href) ||
      /[?&]page=\d+/i.test(href) ||
      text.includes("older") ||
      text.includes("next") ||
      text.includes("archive")
    ) {
      archiveLinks.add(toAbsoluteUrl(baseUrl, href));
    }
  });
  return archiveLinks.size;
}

function inferNewsLinks($, baseUrl) {
  const candidates = [];
  $("a[href]").each((_, element) => {
    const href = normalizeText($(element).attr("href"));
    if (!href) {
      return;
    }
    const absolute = toAbsoluteUrl(baseUrl, href);
    const text = normalizeText($(element).text()).toLowerCase();
    if (
      /news|press|media|blog|article|insight|update|stories/i.test(href) ||
      /news|press|media|blog|article|insight|update|stories/i.test(text)
    ) {
      candidates.push(absolute);
    }
  });
  return Array.from(new Set(candidates)).slice(0, 10);
}

async function analyzeHtmlSource(url) {
  const response = await fetchUrl(url);
  const $ = cheerio.load(String(response.data || ""));
  const dateMatches = collectDateMatches($, response.url);
  const sortedDates = dateMatches
    .map((entry) => entry.date)
    .sort((left, right) => right.getTime() - left.getTime());
  const now = new Date();
  const last12MonthsCount = sortedDates.filter((date) => daysBetween(now, date) <= 365).length;
  const last24MonthsCount = sortedDates.filter((date) => daysBetween(now, date) <= 730).length;
  const archiveDepth = estimateArchiveDepth($, response.url);
  const newsLinks = inferNewsLinks($, response.url);

  return {
    latestArticleDate: sortedDates[0] || null,
    estimatedArticlesLast12Months: last12MonthsCount,
    estimatedArticlesLast24Months: last24MonthsCount,
    archiveDepth: Math.max(archiveDepth, newsLinks.length > 1 ? 1 : 0),
    detectionMethod: "html",
    fetchedUrl: response.url,
    discoveredNewsLinks: newsLinks,
  };
}

async function analyzeVendorActivity(vendor) {
  const sourceUrl = normalizeText(vendor.sourceUrl);
  if (!sourceUrl || vendor.sourceState.acquisitionMethod === "ignore") {
    return {
      vendor: vendor.company,
      latestArticleDate: null,
      estimatedArticlesLast12Months: 0,
      estimatedArticlesLast24Months: 0,
      archiveDepth: 0,
      activityScore: 0,
      sourceUrl,
      acquisitionMethod: vendor.sourceState.acquisitionMethod,
      status: "skipped",
      failureReason: sourceUrl ? "" : "missing_source_url",
    };
  }

  try {
    const result = looksLikeRss(sourceUrl)
      ? await analyzeRssSource(sourceUrl)
      : await analyzeHtmlSource(sourceUrl);

    return {
      vendor: vendor.company,
      latestArticleDate: result.latestArticleDate,
      estimatedArticlesLast12Months: result.estimatedArticlesLast12Months,
      estimatedArticlesLast24Months: result.estimatedArticlesLast24Months,
      archiveDepth: result.archiveDepth,
      activityScore: estimateActivityScore({
        latestArticleDate: result.latestArticleDate,
        last12MonthsCount: result.estimatedArticlesLast12Months,
        last24MonthsCount: result.estimatedArticlesLast24Months,
        archiveDepth: result.archiveDepth,
      }),
      sourceUrl,
      fetchedUrl: result.fetchedUrl,
      acquisitionMethod: vendor.sourceState.acquisitionMethod,
      detectionMethod: result.detectionMethod,
      status: "ok",
      failureReason: "",
    };
  } catch (error) {
    return {
      vendor: vendor.company,
      latestArticleDate: null,
      estimatedArticlesLast12Months: 0,
      estimatedArticlesLast24Months: 0,
      archiveDepth: 0,
      activityScore: 0,
      sourceUrl,
      acquisitionMethod: vendor.sourceState.acquisitionMethod,
      status: "failed",
      failureReason: error instanceof Error ? error.message : String(error || "unknown_error"),
    };
  }
}

function buildReportText(results) {
  const lines = [];
  lines.push("Vendor Activity Diagnostics");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  const ranked = results
    .slice()
    .sort((left, right) => right.activityScore - left.activityScore || right.estimatedArticlesLast12Months - left.estimatedArticlesLast12Months);

  for (const row of ranked) {
    lines.push(`${row.vendor}`);
    lines.push(`  latest_article_date: ${row.latestArticleDate ? row.latestArticleDate.toISOString().slice(0, 10) : ""}`);
    lines.push(`  estimated_articles_last_12_months: ${row.estimatedArticlesLast12Months}`);
    lines.push(`  estimated_articles_last_24_months: ${row.estimatedArticlesLast24Months}`);
    lines.push(`  archive_depth: ${row.archiveDepth}`);
    lines.push(`  activity_score: ${row.activityScore}`);
    lines.push(`  acquisition_method: ${row.acquisitionMethod}`);
    lines.push(`  source_url: ${row.sourceUrl}`);
    lines.push(`  status: ${row.status}`);
    if (row.failureReason) {
      lines.push(`  failure_reason: ${row.failureReason}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  const prioritizedVendors = loadVendorPriorityRows().slice(0, 50);
  const results = [];

  for (const vendor of prioritizedVendors) {
    const activity = await analyzeVendorActivity(vendor);
    results.push({
      ...activity,
      priorityVendorLabel: vendor.priorityVendorLabel,
      sourcePageAvailable: vendor.sourceState.hasNewsPage,
      rssAvailable: vendor.sourceState.hasRss,
    });
  }

  const ranked = results
    .slice()
    .sort((left, right) => right.activityScore - left.activityScore || right.estimatedArticlesLast12Months - left.estimatedArticlesLast12Months);

  console.log("\n=== Vendor Activity Diagnostics ===");
  console.table(formatRows(
    ranked.slice(0, 50).map((row, index) => ({
      rank: index + 1,
      vendor: row.vendor,
      latest_article_date: row.latestArticleDate ? row.latestArticleDate.toISOString().slice(0, 10) : "",
      estimated_articles_last_12_months: row.estimatedArticlesLast12Months,
      estimated_articles_last_24_months: row.estimatedArticlesLast24Months,
      archive_depth: row.archiveDepth,
      activity_score: row.activityScore,
      acquisition_method: row.acquisitionMethod,
      status: row.status,
    }))
  ));

  await fs.writeFile(reportPath, buildReportText(ranked), "utf8");
  console.log(`\nReport written to ${reportPath}`);
}

try {
  await main();
} catch (error) {
  console.error("Failed to run vendor activity diagnostics.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
