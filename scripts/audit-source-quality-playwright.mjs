import { chromium } from "playwright";
import fs from "node:fs";

const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_LIMIT = 18;
const CHROME_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

const DEFAULT_SOURCES = [
  {
    name: "KURZ Press Releases",
    url: "https://www.kurz-world.com/en/newsroom/press/",
  },
  {
    name: "Bundesdruckerei Press Releases",
    url: "https://www.bundesdruckerei.de/en/newsroom/press-releases",
  },
  {
    name: "Atlantic Zeiser News",
    url: "https://www.atlanticzeiser.com/en/news",
  },
];

function parseArgs(argv) {
  const options = {
    sources: DEFAULT_SOURCES,
    output: process.env.SOURCE_QUALITY_OUTPUT || "",
    limit: Number(process.env.SOURCE_QUALITY_LIMIT || DEFAULT_LIMIT),
    timeoutMs: Number(process.env.SOURCE_QUALITY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    headed: process.env.SOURCE_QUALITY_HEADED === "1",
  };

  for (const arg of argv) {
    if (arg.startsWith("--source=")) {
      const value = arg.slice("--source=".length);
      const [name, url] = value.includes("|")
        ? value.split("|").map((part) => part.trim())
        : [value, value];
      if (url) {
        if (options.sources === DEFAULT_SOURCES) {
          options.sources = [];
        }
        options.sources.push({ name: name || url, url });
      }
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--headed") {
      options.headed = true;
    }
  }

  return options;
}

function getChromeExecutablePath() {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function normalizeUrl(url, baseUrl) {
  if (!url || String(url).startsWith("data:")) {
    return "";
  }
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeArticleLink(href, text) {
  const cleanHref = String(href || "").toLowerCase();
  const cleanText = String(text || "").toLowerCase();
  if (!cleanHref || cleanHref.startsWith("mailto:") || cleanHref.startsWith("tel:")) {
    return false;
  }

  if (cleanText.length < 12) {
    return false;
  }

  const positiveHref = [
    "/news/",
    "/press/",
    "/press-releases/",
    "/newsroom/",
    "/media/",
    "/release",
    "/article",
  ].some((fragment) => cleanHref.includes(fragment));
  const datePath = /\/20\d{2}[/-]/.test(cleanHref);
  const positiveText = /\b(press|release|news|launch|publish|introduc|present|report|award|partner|solution|security|passport|document|identity|banknote|currency)\b/.test(cleanText);
  const negativeHref = [
    "#",
    "/tag/",
    "/category/",
    "/privacy",
    "/contact",
    "/career",
    "/jobs",
    "/search",
    "/login",
    "/imprint",
    "/newsletter",
  ].some((fragment) => cleanHref.includes(fragment));

  return !negativeHref && (positiveHref || datePath || positiveText);
}

function scoreCandidate(candidate, sourceHost) {
  let score = 0;
  const title = candidate.title.toLowerCase();
  const link = candidate.link.toLowerCase();
  if (candidate.host === sourceHost) score += 3;
  if (candidate.dateText) score += 3;
  if (candidate.image) score += 2;
  if (title.length >= 35) score += 2;
  if (title.length >= 70) score += 1;
  if (link.includes("/press") || link.includes("/news")) score += 2;
  if (/\b(press|release|news|launch|report|award|partner|solution|security|passport|document|identity|banknote|currency)\b/.test(title)) score += 1;
  if (/^(read more|learn more|more|details)$/i.test(candidate.title)) score -= 5;
  return score;
}

function summarizeImages(items) {
  const counts = new Map();
  for (const item of items) {
    const key = item.image || "";
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const repeated = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([image, count]) => ({ image, count }));

  return {
    totalWithImages: items.filter((item) => item.image).length,
    uniqueImages: counts.size,
    repeatedImages: repeated,
    repeatedImageRatio: items.length
      ? Number((repeated.reduce((sum, entry) => sum + entry.count, 0) / items.length).toFixed(2))
      : 0,
  };
}

async function auditSource(page, source, limit, timeoutMs) {
  const response = await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

  const pageUrl = page.url();
  const sourceHost = new URL(pageUrl).hostname.replace(/^www\./, "");
  const rawCandidates = await page.evaluate(() => {
    function clean(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function getArticleContainer(anchor) {
      const preferred = anchor.closest("article,li,[class*='card'],[class*='teaser'],[class*='press-card'],[class*='news-card'],[class*='item']");
      if (preferred && preferred.querySelectorAll("a[href]").length <= 4) {
        return preferred;
      }

      let current = anchor.parentElement;
      while (current && current !== document.body) {
        const linkCount = current.querySelectorAll("a[href]").length;
        const textLength = clean(current.textContent).length;
        if (linkCount <= 3 && textLength >= 20 && textLength <= 700) {
          return current;
        }
        current = current.parentElement;
      }

      return anchor.parentElement || anchor;
    }

    function pickDate(container) {
      const time = container.querySelector("time[datetime], time");
      if (time) {
        return clean(time.getAttribute("datetime") || time.textContent);
      }

      const text = clean(container.textContent);
      const matches = [
        text.match(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/),
        text.match(/\b\d{1,2}\s+[A-Z][a-z]{2,}\s+20\d{2}\b/),
        text.match(/\b[A-Z][a-z]{2,}\s+\d{1,2},\s+20\d{2}\b/),
        text.match(/\b20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\b/),
      ].find(Boolean);
      return matches?.[0] || "";
    }

    function pickTitle(anchor, container) {
      const labelled = anchor.getAttribute("aria-label") || anchor.getAttribute("title");
      const heading = container.querySelector("h1,h2,h3,h4");
      return clean(heading?.textContent || labelled || anchor.textContent);
    }

    function pickImage(anchor, container) {
      const img = container.querySelector("img") || anchor.querySelector("img");
      if (!img) return "";
      return img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("srcset")?.split(",")[0]?.trim()?.split(/\s+/)[0] ||
        "";
    }

    return [...document.querySelectorAll("a[href]")]
      .map((anchor) => {
        const container = getArticleContainer(anchor);
        return {
          href: anchor.getAttribute("href") || "",
          title: pickTitle(anchor, container),
          anchorText: clean(anchor.textContent),
          dateText: pickDate(container),
          image: pickImage(anchor, container),
          containerText: clean(container.textContent).slice(0, 420),
        };
      });
  });

  const seen = new Set();
  const items = rawCandidates
    .map((candidate) => {
      const link = normalizeUrl(candidate.href, pageUrl);
      const image = normalizeUrl(candidate.image, pageUrl);
      const host = link ? new URL(link).hostname.replace(/^www\./, "") : "";
      return {
        title: normalizeText(candidate.title || candidate.anchorText),
        link,
        host,
        dateText: normalizeText(candidate.dateText),
        image,
        evidence: normalizeText(candidate.containerText),
      };
    })
    .filter((candidate) => candidate.link && candidate.title && looksLikeArticleLink(candidate.link, candidate.title))
    .filter((candidate) => {
      const key = candidate.link;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, sourceHost),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    source,
    finalUrl: pageUrl,
    status: response?.status() || null,
    capturedAt: new Date().toISOString(),
    candidateCount: items.length,
    imageSummary: summarizeImages(items),
    items,
    warnings: [
      items.length === 0 ? "No article-like candidates found." : "",
      summarizeImages(items).repeatedImageRatio >= 0.5 ? "Many candidates share the same image." : "",
      items.some((item) => !item.dateText) ? "Some candidates have no visible date evidence." : "",
    ].filter(Boolean),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({
    executablePath: getChromeExecutablePath(),
    headless: !options.headed,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    });

    const reports = [];
    for (const source of options.sources) {
      reports.push(await auditSource(page, source, options.limit, options.timeoutMs));
    }

    const report = {
      capturedAt: new Date().toISOString(),
      limit: options.limit,
      sourceCount: reports.length,
      reports,
    };

    const json = JSON.stringify(report, null, 2);
    if (options.output) {
      fs.writeFileSync(options.output, `${json}\n`);
    }
    console.log(json);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
