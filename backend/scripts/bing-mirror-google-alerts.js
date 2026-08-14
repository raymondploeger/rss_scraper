import {
  createFeed,
  findFeedByRssUrl,
  listFeeds,
} from "../src/database/feedRepository.js";
import { disconnectDatabase } from "../src/config/db.js";

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 0) : 0;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase();
}

function getUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

function isGoogleNewsOrAlertFeed(feed) {
  const parsed = getUrl(feed?.rssUrl);
  if (!parsed) {
    return false;
  }

  const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  return (
    hostname === "news.google.com" &&
    (
      pathname.startsWith("/rss/search") ||
      pathname.startsWith("/alerts/feeds/")
    )
  );
}

function decodeQuery(value) {
  return normalizeText(
    String(value || "")
      .replace(/\+/g, " ")
      .replace(/\s+-site:\S+/gi, "")
  );
}

function stripGoogleAlertNameNoise(value) {
  return normalizeText(
    String(value || "")
      .replace(/\bgoogle\s+alerts?\b/gi, "")
      .replace(/\bgoogle\s+news\b/gi, "")
      .replace(/\balert\b/gi, "")
      .replace(/\brss\b/gi, "")
      .replace(/^[-–—:|/\\\s]+|[-–—:|/\\\s]+$/g, "")
  );
}

function extractGoogleFeedQuery(feed) {
  const parsed = getUrl(feed?.rssUrl);
  if (!parsed) {
    return {
      query: "",
      querySource: "unavailable",
      confidence: "none",
      reason: "invalid_google_feed_url",
    };
  }

  const urlQuery = decodeQuery(parsed.searchParams.get("q"));
  if (urlQuery) {
    return {
      query: urlQuery,
      querySource: "google_news_q_param",
      confidence: "high",
      reason: "",
    };
  }

  const nameQuery = stripGoogleAlertNameNoise(feed?.name);
  if (nameQuery) {
    return {
      query: nameQuery,
      querySource: "feed_name_fallback",
      confidence: "medium",
      reason: "google_alert_url_does_not_expose_query",
    };
  }

  return {
    query: "",
    querySource: "unavailable",
    confidence: "none",
    reason: "google_alert_query_not_recoverable",
  };
}

function buildBingNewsRssUrl(query) {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  return `https://www.bing.com/news/search?q=${encodedQuery}&format=rss`;
}

function buildMirrorName(feed, query) {
  const cleanedName = stripGoogleAlertNameNoise(feed?.name);
  const base = cleanedName || normalizeText(query) || "Untitled Google Alert";
  return `Bing Mirror - ${base}`;
}

function getExistingFeedMaps(feeds) {
  const byUrl = new Map();
  const byName = new Map();
  feeds.forEach((feed) => {
    const urlKey = normalizeComparable(feed.rssUrl);
    const nameKey = normalizeComparable(feed.name);
    if (urlKey) byUrl.set(urlKey, feed);
    if (nameKey) byName.set(nameKey, feed);
  });
  return { byUrl, byName };
}

function formatMirrorPlanRow(plan) {
  return {
    googleAlertName: plan.googleAlertName,
    topic: plan.topic,
    query: plan.query,
    querySource: plan.querySource,
    confidence: plan.confidence,
    bingName: plan.bingName,
    status: plan.status,
    reason: plan.reason,
    bingRssUrl: plan.bingRssUrl,
  };
}

async function main() {
  const feeds = await listFeeds({ order: "ASC" });
  const { byUrl, byName } = getExistingFeedMaps(feeds);
  const googleFeeds = feeds.filter(isGoogleNewsOrAlertFeed);
  const selectedGoogleFeeds = limit ? googleFeeds.slice(0, limit) : googleFeeds;

  const plans = selectedGoogleFeeds.map((feed) => {
    const extraction = extractGoogleFeedQuery(feed);
    const bingRssUrl = extraction.query ? buildBingNewsRssUrl(extraction.query) : "";
    const bingName = extraction.query ? buildMirrorName(feed, extraction.query) : "";
    const existingByUrl = bingRssUrl ? byUrl.get(normalizeComparable(bingRssUrl)) : null;
    const existingByName = bingName ? byName.get(normalizeComparable(bingName)) : null;
    const status = !extraction.query
      ? "skipped"
      : existingByUrl
        ? "already_exists_by_url"
        : existingByName
          ? "already_exists_by_name"
          : shouldApply
            ? "pending_create"
            : "would_create";

    return {
      googleAlertId: feed.id,
      googleAlertName: feed.name,
      googleAlertUrl: feed.rssUrl,
      topic: feed.topic,
      sourceType: feed.sourceType,
      query: extraction.query,
      querySource: extraction.querySource,
      confidence: extraction.confidence,
      bingName,
      bingRssUrl,
      status,
      reason: extraction.reason,
      existingFeedName: existingByUrl?.name || existingByName?.name || "",
    };
  });

  const created = [];
  const failed = [];

  if (shouldApply) {
    for (const plan of plans) {
      if (plan.status !== "pending_create") {
        continue;
      }

      try {
        const existing = await findFeedByRssUrl(plan.bingRssUrl);
        if (existing) {
          plan.status = "already_exists_by_url";
          plan.existingFeedName = existing.name;
          continue;
        }

        const feed = await createFeed({
          name: plan.bingName,
          topic: plan.topic,
          rssUrl: plan.bingRssUrl,
          sourceType: "rss",
          isActive: true,
        });
        plan.status = "created";
        created.push(feed);
      } catch (error) {
        plan.status = "failed";
        plan.reason = error?.message || "create_failed";
        failed.push({
          name: plan.bingName,
          rssUrl: plan.bingRssUrl,
          error: plan.reason,
        });
      }
    }
  }

  const summary = {
    mode: shouldApply ? "apply" : "dry-run",
    googleAlertFeedsFound: googleFeeds.length,
    googleAlertFeedsEvaluated: selectedGoogleFeeds.length,
    wouldCreate: plans.filter((plan) => plan.status === "would_create").length,
    created: created.length,
    alreadyExists: plans.filter((plan) => plan.status.startsWith("already_exists")).length,
    skipped: plans.filter((plan) => plan.status === "skipped").length,
    failed: failed.length,
  };

  console.log("\nBING MIRROR GOOGLE ALERTS");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nMIRROR PLAN");
  console.table(plans.map(formatMirrorPlanRow));

  const uncertain = plans.filter((plan) => plan.querySource !== "google_news_q_param");
  if (uncertain.length) {
    console.log("\nQUERY EXTRACTION REVIEW");
    console.table(
      uncertain.map((plan) => ({
        googleAlertName: plan.googleAlertName,
        query: plan.query,
        querySource: plan.querySource,
        confidence: plan.confidence,
        reason: plan.reason,
      }))
    );
  }

  if (failed.length) {
    console.log("\nFAILED CREATES");
    console.table(failed);
  }
}

main()
  .catch((error) => {
    console.error("Bing mirror diagnostics failed:", error?.stack || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
