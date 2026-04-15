import { deleteFeed, listFeeds } from "../database/feedRepository.js";
import { getDmvCatalogEntry, isCanadianDmvAbbr, loadDmvCatalog } from "./dmvCatalogService.js";

const LEGACY_DMV_PROXY_HOST = "rssdmv-production.up.railway.app";

function isLegacyDmvProxyFeed(feed) {
  return String(feed?.rssUrl || "").includes(LEGACY_DMV_PROXY_HOST);
}

function getCanadaCatalogEntryByLegacyPath(feed) {
  let pathname = "";
  try {
    pathname = new URL(feed?.rssUrl || "").pathname.toLowerCase();
  } catch {
    return null;
  }

  return (
    loadDmvCatalog().find((entry) => {
      const region = String(entry.region || "").toLowerCase();
      const feedPath = String(entry.feed_path || entry.feedPath || "").toLowerCase();
      return (region === "canada" || isCanadianDmvAbbr(entry.abbr)) && feedPath === pathname;
    }) || null
  );
}

function isCanadaDmvFeed(feed) {
  const catalogEntry = getDmvCatalogEntry(feed) || getCanadaCatalogEntryByLegacyPath(feed);
  if (catalogEntry) {
    const region = String(catalogEntry.region || "").toLowerCase();
    return region === "canada" || isCanadianDmvAbbr(catalogEntry.abbr);
  }

  const dmvRegion = String(feed?.dmvRegion || "").toLowerCase();
  return dmvRegion === "canada" || dmvRegion === "ca" || isCanadianDmvAbbr(feed?.dmvAbbr);
}

export async function cleanupLegacyCanadaFeeds() {
  const feeds = await listFeeds();
  const legacyCanadaFeeds = feeds.filter(
    (feed) => isLegacyDmvProxyFeed(feed) && isCanadaDmvFeed(feed)
  );
  const deletedFeeds = [];

  for (const feed of legacyCanadaFeeds) {
    const deletedFeed = await deleteFeed(feed.id);
    if (deletedFeed) {
      deletedFeeds.push(deletedFeed.name || feed.name || feed.rssUrl);
    }
  }

  console.log(
    `[dmv-cleanup] Deleted ${deletedFeeds.length} legacy Canada DMV feeds`,
    deletedFeeds
  );

  return {
    deletedCount: deletedFeeds.length,
    deletedFeeds,
  };
}
