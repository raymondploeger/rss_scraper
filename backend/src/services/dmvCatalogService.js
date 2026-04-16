import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
const CANADA_ABBRS = new Set(["AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "NT", "NU", "YT"]);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DMV_CATALOG_PATH = path.resolve(__dirname, "../../data/dmvFeeds.json");

let cachedDmvCatalog = null;

function normalizeCatalogText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isCanadianDmvAbbr(abbr) {
  return CANADA_ABBRS.has(String(abbr || "").toUpperCase());
}

export function loadDmvCatalog() {
  if (cachedDmvCatalog) {
    return cachedDmvCatalog;
  }

  console.log(`Loading DMV catalog from ${DMV_CATALOG_PATH}`);

  try {
    const raw = readFileSync(DMV_CATALOG_PATH, "utf8");
    const cleanedRaw = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
    const parsed = JSON.parse(cleanedRaw);
    const isArray = Array.isArray(parsed);

    if (!isArray) {
      console.error(`Invalid DMV catalog at ${DMV_CATALOG_PATH}: parsed JSON is not an array`);
      return [];
    }

    cachedDmvCatalog = parsed;
    console.log(`Loaded DMV catalog from ${DMV_CATALOG_PATH}: isArray=${isArray}, length=${cachedDmvCatalog.length}`);
  } catch (error) {
    console.error(`Failed to load DMV catalog from ${DMV_CATALOG_PATH}:`, error?.stack || error);
    return [];
  }

  return cachedDmvCatalog;
}

export function getDmvCatalogEntry(feed) {
  const rssUrl = String(feed?.rssUrl || "").trim();
  const feedName = normalizeCatalogText(feed?.name);

  return (
    loadDmvCatalog().find((entry) => {
      const entryRssUrl = String(entry?.rss_url || entry?.rssUrl || "").trim();
      const entryRegion = String(entry?.region || (isCanadianDmvAbbr(entry?.abbr) ? "canada" : "us")).toLowerCase();
      const entryMode = String(entry?.mode || (entryRssUrl ? "rss" : "link-only")).toLowerCase();
      const entryStateName = normalizeCatalogText(entry?.state);
      const entryDmvName = normalizeCatalogText(entry?.state ? `${entry.state} DMV` : "");

      if (entryRegion === "canada") {
        return Boolean(entryMode === "rss" && entryRssUrl && rssUrl && entryRssUrl === rssUrl);
      }

      if (entryRssUrl && rssUrl && entryRssUrl === rssUrl) {
        return true;
      }

      return Boolean(feedName && (feedName === entryDmvName || feedName === entryStateName));
    }) || null
  );
}

export function toDmvCatalogDto(entry) {
  const rssUrl = entry.rss_url || entry.rssUrl || null;

  return {
    state: entry.state,
    abbr: entry.abbr,
    rssUrl,
    officialUrl: entry.official_url,
    feedPath: entry.feed_path,
    region: entry.region || (isCanadianDmvAbbr(entry.abbr) ? "canada" : "us"),
    mode: entry.mode || (rssUrl ? "rss" : "link-only"),
  };
}
