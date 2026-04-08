import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DMV_BASE_URL = "https://rssdmv-production.up.railway.app";
const CANADA_ABBRS = new Set(["AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "NT", "NU", "YT"]);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DMV_CATALOG_PATH = path.resolve(__dirname, "../../data/dmvFeeds.json");

let cachedDmvCatalog = null;

export function isCanadianDmvAbbr(abbr) {
  return CANADA_ABBRS.has(String(abbr || "").toUpperCase());
}

export function loadDmvCatalog() {
  if (cachedDmvCatalog) {
    return cachedDmvCatalog;
  }

  try {
    const raw = readFileSync(DMV_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    cachedDmvCatalog = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedDmvCatalog = [];
  }

  return cachedDmvCatalog;
}

export function getDmvCatalogEntry(feed) {
  const rssUrl = String(feed?.rssUrl || "");
  if (!rssUrl.includes(`${DMV_BASE_URL}/feeds/`)) {
    return null;
  }

  return (
    loadDmvCatalog().find((entry) => {
      const feedPath = String(entry?.feed_path || "");
      return feedPath && rssUrl.endsWith(feedPath);
    }) || null
  );
}

export function toDmvCatalogDto(entry) {
  return {
    state: entry.state,
    abbr: entry.abbr,
    officialUrl: entry.official_url,
    feedPath: entry.feed_path,
    region: entry.region || (isCanadianDmvAbbr(entry.abbr) ? "canada" : "us"),
    mode: entry.mode || "rss",
  };
}
