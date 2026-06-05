import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportPath = path.resolve(__dirname, "../data/source-analysis/sicpa-newsroom-diagnostics.txt");

const USER_AGENT = "Mozilla/5.0 (compatible; SICPANewsroomDiagnostics/1.0; +https://openai.com)";
const REQUEST_TIMEOUT_MS = 20000;
const SICPA_NEWSROOM_URL = "https://www.sicpa.com/newsroom";

const NAVIGATION_PATTERNS = [
  "home",
  "newsroom",
  "latest news",
  "back to top",
  "skip to main content",
  "english",
  "français",
  "español",
  "portuguese",
];

const MARKETING_PATTERNS = [
  "/expertise",
  "/history",
  "/career",
  "/company",
  "/integrity",
  "/policies",
  "/sustainability",
  "/sicpa-glance",
  "/our-values",
  "/sicpa-worldwide-locations",
  "/sicpa-africa",
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(baseUrl, candidate) {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return "";
  }
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return {
      url,
      finalUrl: response.url,
      html,
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseDateFromText(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const monthDateMatch = text.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s+\d{4}\b/i
  );
  if (monthDateMatch) {
    const parsed = new Date(monthDateMatch[0]);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const dotDateMatch = text.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/);
  if (dotDateMatch) {
    const normalized = dotDateMatch[0].replace(/[./]/g, "-");
    const parts = normalized.split("-");
    const [left, middle, right] = parts;
    const year = right.length === 2 ? `20${right}` : right;
    const parsed = new Date(`${year}-${middle.padStart(2, "0")}-${left.padStart(2, "0")}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function findLatestNewsUrl($, baseUrl) {
  const direct = $("a[href]")
    .toArray()
    .map((element) => ({
      href: $(element).attr("href") || "",
      text: normalizeText($(element).text()).toLowerCase(),
    }))
    .find((candidate) => candidate.text === "latest news");

  if (!direct) {
    return "";
  }

  return toAbsoluteUrl(baseUrl, direct.href);
}

function buildCandidateFromBlock($, block, baseUrl, sourcePage) {
  const node = $(block);
  const href =
    node.find("a.full-link").first().attr("href") ||
    node.find("a[href]").first().attr("href") ||
    "";
  const url = toAbsoluteUrl(baseUrl, href);
  if (!url) {
    return null;
  }

  const title =
    normalizeText(node.find(".list-title").first().text()) ||
    normalizeText(node.find("h1, h2, h3, h4").first().text()) ||
    normalizeText(node.find("a[href]").map((_, element) => $(element).text()).get().join(" "));
  const excerpt =
    normalizeText(node.find(".list-description").first().text()) ||
    normalizeText(node.text());
  const date =
    parseDateFromText(node.find("time").first().attr("datetime") || "") ||
    parseDateFromText(node.find("time").first().text()) ||
    parseDateFromText(node.text());
  const image = toAbsoluteUrl(baseUrl, node.find("img").first().attr("src") || "");
  const contentType = normalizeText(node.find(".list-type").first().text());

  return {
    title,
    url,
    date: date ? date.toISOString() : "",
    excerpt: excerpt.slice(0, 400),
    image,
    sourcePage,
    contentType,
    rawText: normalizeText(node.text()).slice(0, 500),
  };
}

function collectStructuredCandidates($, baseUrl, sourcePage) {
  const seen = new Set();
  const candidates = [];

  $(".views-row, .media--type-document.media--view-mode-document-card")
    .toArray()
    .forEach((block) => {
      const candidate = buildCandidateFromBlock($, block, baseUrl, sourcePage);
      if (!candidate || !candidate.url || seen.has(candidate.url)) {
        return;
      }

      seen.add(candidate.url);
      candidates.push(candidate);
    });

  return candidates;
}

function collectGenericLinks($, baseUrl, sourcePage) {
  const seen = new Set();
  const candidates = [];

  $("main a[href], article a[href], .view-content a[href], .paragraph a[href]")
    .toArray()
    .forEach((element) => {
      const href = $(element).attr("href") || "";
      const url = toAbsoluteUrl(baseUrl, href);
      if (!url || seen.has(url)) {
        return;
      }

      const container = $(element).closest(".views-row, article, .grid, .paragraph, li, div");
      const title =
        normalizeText(container.find(".list-title").first().text()) ||
        normalizeText($(element).text()) ||
        normalizeText(container.find("h1, h2, h3, h4").first().text());
      const excerpt =
        normalizeText(container.find(".list-description").first().text()) ||
        normalizeText(container.text()).slice(0, 400);
      const date =
        parseDateFromText(container.find("time").first().attr("datetime") || "") ||
        parseDateFromText(container.text());
      const image = toAbsoluteUrl(baseUrl, container.find("img").first().attr("src") || "");

      seen.add(url);
      candidates.push({
        title,
        url,
        date: date ? date.toISOString() : "",
        excerpt,
        image,
        sourcePage,
        contentType: normalizeText(container.find(".list-type").first().text()),
        rawText: normalizeText(container.text()).slice(0, 500),
      });
    });

  return candidates;
}

async function enrichCandidate(candidate) {
  if (candidate.date && candidate.excerpt && candidate.image) {
    return candidate;
  }

  if (candidate.url.toLowerCase().endsWith(".pdf")) {
    return candidate;
  }

  try {
    const response = await fetchHtml(candidate.url);
    const $ = cheerio.load(response.html);
    const bodyText = normalizeText($("main, article, body").first().text());
    const detailDate =
      parseDateFromText($("time").first().attr("datetime") || "") ||
      parseDateFromText($("time").first().text()) ||
      parseDateFromText(bodyText);
    const detailExcerpt =
      normalizeText($("meta[name='description']").attr("content")) ||
      normalizeText($("meta[property='og:description']").attr("content")) ||
      normalizeText($("article p").first().text()) ||
      normalizeText($("main p").first().text());
    const detailImage =
      toAbsoluteUrl(response.finalUrl, $("meta[property='og:image']").attr("content") || "") ||
      toAbsoluteUrl(response.finalUrl, $("img").first().attr("src") || "");

    return {
      ...candidate,
      title:
        candidate.title ||
        normalizeText($("meta[property='og:title']").attr("content")) ||
        normalizeText($("title").first().text()),
      date: candidate.date || (detailDate ? detailDate.toISOString() : ""),
      excerpt: candidate.excerpt || detailExcerpt.slice(0, 400),
      image: candidate.image || detailImage,
    };
  } catch {
    return candidate;
  }
}

function classifyCandidate(candidate) {
  const url = String(candidate.url || "").toLowerCase();
  const title = normalizeText(candidate.title).toLowerCase();
  const excerpt = normalizeText(candidate.excerpt).toLowerCase();
  const contentType = normalizeText(candidate.contentType).toLowerCase();
  const combined = `${title} ${excerpt} ${contentType}`;
  const likelyNewsUrl =
    url.includes("/news/") ||
    url.includes("/press") ||
    url.endsWith(".pdf");

  if (likelyNewsUrl && candidate.date) {
    return "likely_article";
  }

  if (
    url.includes("#") ||
    NAVIGATION_PATTERNS.some((pattern) => title === pattern || combined === pattern) ||
    ["/newsroom", "/fr/tous-les-communiques-de-presse", "/es/todos-los-comunicados-de-prensa"].some((segment) => url.endsWith(segment))
  ) {
    return "rejected_navigation";
  }

  if (
    MARKETING_PATTERNS.some((pattern) => url.includes(pattern)) ||
    combined.includes("sicpa at a glance") ||
    combined.includes("overview")
  ) {
    return "rejected_marketing";
  }

  if (url.includes("/events/")) {
    return "rejected_other";
  }

  if (likelyNewsUrl && !candidate.date) {
    return "rejected_no_date";
  }

  if (likelyNewsUrl) {
    return "likely_article";
  }

  return "rejected_other";
}

function dedupeCandidates(candidates) {
  const byUrl = new Map();

  for (const candidate of candidates) {
    const existing = byUrl.get(candidate.url);
    if (!existing) {
      byUrl.set(candidate.url, candidate);
      continue;
    }

    const replacementScore =
      Number(Boolean(candidate.title)) +
      Number(Boolean(candidate.date)) +
      Number(Boolean(candidate.excerpt)) +
      Number(Boolean(candidate.image));
    const existingScore =
      Number(Boolean(existing.title)) +
      Number(Boolean(existing.date)) +
      Number(Boolean(existing.excerpt)) +
      Number(Boolean(existing.image));

    if (replacementScore > existingScore) {
      byUrl.set(candidate.url, candidate);
    }
  }

  return Array.from(byUrl.values());
}

function formatCandidate(candidate) {
  return [
    `classification: ${candidate.classification}`,
    `title: ${candidate.title || "(none)"}`,
    `url: ${candidate.url}`,
    `date: ${candidate.date || "(none)"}`,
    `excerpt: ${candidate.excerpt || "(none)"}`,
    `image: ${candidate.image || "(none)"}`,
    `source_page: ${candidate.sourcePage}`,
  ].join("\n");
}

function buildReport({ sourcePages, candidates, summary }) {
  const lines = [];
  lines.push("SICPA Newsroom Diagnostics");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Source Pages");
  sourcePages.forEach((page) => {
    lines.push(`- ${page}`);
  });
  lines.push("");
  lines.push("Summary");
  lines.push(`- total_links_found: ${summary.total_links_found}`);
  lines.push(`- candidate_articles_found: ${summary.candidate_articles_found}`);
  lines.push(`- rejected_count: ${summary.rejected_count}`);
  lines.push(`- latest_article_date: ${summary.latest_article_date || "(none)"}`);
  lines.push("");
  lines.push("Candidates");
  candidates.forEach((candidate, index) => {
    lines.push(`${index + 1}.`);
    lines.push(formatCandidate(candidate));
    lines.push("");
  });

  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  const sourcePages = [SICPA_NEWSROOM_URL];
  const newsroomResponse = await fetchHtml(SICPA_NEWSROOM_URL);
  const $newsroom = cheerio.load(newsroomResponse.html);

  const latestNewsUrl = findLatestNewsUrl($newsroom, newsroomResponse.finalUrl);
  if (latestNewsUrl) {
    sourcePages.push(latestNewsUrl);
  }

  let rawCandidates = [
    ...collectStructuredCandidates($newsroom, newsroomResponse.finalUrl, SICPA_NEWSROOM_URL),
    ...collectGenericLinks($newsroom, newsroomResponse.finalUrl, SICPA_NEWSROOM_URL),
  ];

  if (latestNewsUrl) {
    const latestNewsResponse = await fetchHtml(latestNewsUrl);
    const $latestNews = cheerio.load(latestNewsResponse.html);
    rawCandidates = rawCandidates.concat(
      collectStructuredCandidates($latestNews, latestNewsResponse.finalUrl, latestNewsUrl),
      collectGenericLinks($latestNews, latestNewsResponse.finalUrl, latestNewsUrl)
    );
  }

  const deduped = dedupeCandidates(
    rawCandidates.filter((candidate) => {
      const url = String(candidate.url || "");
      return url.startsWith("http://") || url.startsWith("https://");
    })
  );

  const enriched = [];
  for (const candidate of deduped) {
    const completed = await enrichCandidate(candidate);
    enriched.push({
      ...completed,
      classification: classifyCandidate(completed),
    });
  }

  const likelyArticles = enriched
    .filter((candidate) => candidate.classification === "likely_article")
    .filter((candidate) => candidate.date)
    .sort((left, right) => new Date(right.date) - new Date(left.date));

  const summary = {
    total_links_found: enriched.length,
    candidate_articles_found: enriched.filter((candidate) => candidate.classification === "likely_article").length,
    rejected_count: enriched.filter((candidate) => candidate.classification !== "likely_article").length,
    latest_article_date: likelyArticles[0]?.date || "",
  };

  console.log("\n=== SICPA Newsroom Diagnostics ===");
  console.table([
    {
      total_links_found: summary.total_links_found,
      candidate_articles_found: summary.candidate_articles_found,
      rejected_count: summary.rejected_count,
      latest_article_date: summary.latest_article_date || "(none)",
    },
  ]);
  console.table(
    enriched.slice(0, 20).map((candidate) => ({
      classification: candidate.classification,
      title: candidate.title || "(none)",
      url: candidate.url,
      date: candidate.date || "",
    }))
  );

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(
    reportPath,
    buildReport({
      sourcePages,
      candidates: enriched,
      summary,
    }),
    "utf8"
  );

  console.log(`\nReport written to ${reportPath}`);
}

try {
  await main();
} catch (error) {
  console.error("Failed to run SICPA newsroom diagnostics.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
