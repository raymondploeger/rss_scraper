import {
  createFeed,
  findFeedByRssUrl,
  listFeeds,
  updateFeed,
} from "../src/database/feedRepository.js";
import { disconnectDatabase } from "../src/config/db.js";

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const dbOnly = args.includes("--db-only");
const configuredOnly = args.includes("--configured-only");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 0) : 0;

const CONFIGURED_GOOGLE_ALERT_QUERIES = [
  "banknote design",
  "banknote issuance",
  "banknote redesign",
  "banknote security features",
  "banknote",
  "banknotes",
  "central bank currency",
  "commemorative banknote",
  "currency redenomination",
  "currency reform",
  "digital identity wallet",
  "document authentication",
  "document security features",
  "document security",
  "DOVID",
  "drivers license",
  "eID wallet",
  "electronic identity card",
  "electronic passport",
  "eMRTD",
  "ePassport",
  "identity document",
  "identity proofing",
  "identity verification",
  "micro optics",
  "mobile ID",
  "municipal identity card",
  "national ID card",
  "new banknote",
  "new currency",
  "new passport",
  "OVD",
  "passport redesign",
  "passport",
  "polymer banknote",
  "real id",
  "residence permit",
  "secure document",
  "security features",
  "security printing",
  "security printing",
  "security thread",
  "travel document",
  "travel visa",
  "tribal identification card",
  "verifiable credentials",
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase();
}

function dedupeByComparable(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const key = normalizeComparable(value);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(value);
  });
  return result;
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

function buildExactPhraseQuery(value) {
  const cleaned = normalizeText(value).replace(/^"+|"+$/g, "");
  return cleaned ? `"${cleaned}"` : "";
}

function inferTopicForConfiguredQuery(query) {
  const text = normalizeComparable(query);
  if (
    /\b(banknote|banknotes|currency|central bank|redenomination)\b/.test(text)
  ) {
    return "Banknotes";
  }
  if (
    /\b(dovid|ovd|micro optics|security printing|security features|security thread)\b/.test(text)
  ) {
    return "Shared Security Printing";
  }
  if (
    /\b(digital identity wallet|eid wallet|identity proofing|identity verification|mobile id|verifiable credentials)\b/.test(text)
  ) {
    return "Digital Identity & Biometrics";
  }
  return "Identity Documents";
}

function buildMirrorName(feed, query) {
  const cleanedName = stripGoogleAlertNameNoise(feed?.name);
  const base = cleanedName || normalizeText(query).replace(/^"+|"+$/g, "") || "Untitled Google Alert";
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
    existingFeedName: plan.existingFeedName,
    bingRssUrl: plan.bingRssUrl,
  };
}

function getMirrorStatus({ query, existingByUrl, existingByName, shouldApply, duplicatePlannedQuery = false }) {
  if (!query) {
    return "skipped";
  }
  if (duplicatePlannedQuery) {
    return "already_planned_by_database_feed";
  }
  if (existingByUrl?.isActive === false) {
    return shouldApply ? "pending_reactivate" : "would_reactivate_inactive";
  }
  if (existingByUrl) {
    return "already_exists_by_url";
  }
  if (existingByName?.isActive === false) {
    return shouldApply ? "pending_reactivate" : "would_reactivate_inactive";
  }
  if (existingByName) {
    return "already_exists_by_name";
  }
  return shouldApply ? "pending_create" : "would_create";
}

async function main() {
  const feeds = await listFeeds({ order: "ASC" });
  const { byUrl, byName } = getExistingFeedMaps(feeds);
  const googleFeeds = feeds.filter(isGoogleNewsOrAlertFeed);
  const selectedGoogleFeeds = configuredOnly ? [] : limit ? googleFeeds.slice(0, limit) : googleFeeds;
  const configuredQueries = dbOnly ? [] : dedupeByComparable(CONFIGURED_GOOGLE_ALERT_QUERIES);

  const dbPlans = selectedGoogleFeeds.map((feed) => {
    const extraction = extractGoogleFeedQuery(feed);
    const bingRssUrl = extraction.query ? buildBingNewsRssUrl(extraction.query) : "";
    const bingName = extraction.query ? buildMirrorName(feed, extraction.query) : "";
    const existingByUrl = bingRssUrl ? byUrl.get(normalizeComparable(bingRssUrl)) : null;
    const existingByName = bingName ? byName.get(normalizeComparable(bingName)) : null;
    const status = getMirrorStatus({
      query: extraction.query,
      existingByUrl,
      existingByName,
      shouldApply,
    });

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
      existingFeedId: existingByUrl?.id || existingByName?.id || "",
    };
  });
  const plannedQueryKeys = new Set(
    dbPlans
      .map((plan) => normalizeComparable(plan.query))
      .filter(Boolean)
  );

  const configuredPlans = configuredQueries.map((queryText) => {
    const query = buildExactPhraseQuery(queryText);
    const bingRssUrl = query ? buildBingNewsRssUrl(query) : "";
    const bingName = query ? buildMirrorName({ name: queryText }, query) : "";
    const existingByUrl = bingRssUrl ? byUrl.get(normalizeComparable(bingRssUrl)) : null;
    const existingByName = bingName ? byName.get(normalizeComparable(bingName)) : null;
    const duplicatePlannedQuery = plannedQueryKeys.has(normalizeComparable(query));
    const status = getMirrorStatus({
      query,
      existingByUrl,
      existingByName,
      shouldApply,
      duplicatePlannedQuery,
    });

    return {
      googleAlertId: "",
      googleAlertName: queryText,
      googleAlertUrl: "",
      topic: inferTopicForConfiguredQuery(queryText),
      sourceType: "configured",
      query,
      querySource: "configured_current_google_alerts",
      confidence: "high",
      bingName,
      bingRssUrl,
      status,
      reason: duplicatePlannedQuery ? "same_query_already_found_in_database_google_feed" : "",
      existingFeedName: existingByUrl?.name || existingByName?.name || "",
      existingFeedId: existingByUrl?.id || existingByName?.id || "",
    };
  });

  const plans = dbPlans.concat(configuredPlans);

  const created = [];
  const failed = [];

  if (shouldApply) {
    for (const plan of plans) {
      if (plan.status !== "pending_create") {
        if (plan.status === "pending_reactivate" && plan.existingFeedId) {
          try {
            const feed = await updateFeed(plan.existingFeedId, {
              name: plan.bingName,
              topic: plan.topic,
              sourceType: "rss",
              isActive: true,
            });
            plan.status = "reactivated";
            created.push(feed);
          } catch (error) {
            plan.status = "failed";
            plan.reason = error?.message || "reactivate_failed";
            failed.push({
              name: plan.bingName,
              rssUrl: plan.bingRssUrl,
              error: plan.reason,
            });
          }
        }
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
    configuredGoogleAlertQueries: CONFIGURED_GOOGLE_ALERT_QUERIES.length,
    configuredGoogleAlertQueriesDeduped: configuredQueries.length,
    wouldCreate: plans.filter((plan) => plan.status === "would_create").length,
    wouldReactivateInactive: plans.filter((plan) => plan.status === "would_reactivate_inactive").length,
    created: created.length,
    reactivated: plans.filter((plan) => plan.status === "reactivated").length,
    alreadyExists: plans.filter((plan) => plan.status.startsWith("already_exists")).length,
    alreadyPlanned: plans.filter((plan) => plan.status === "already_planned_by_database_feed").length,
    skipped: plans.filter((plan) => plan.status === "skipped").length,
    failed: failed.length,
  };

  console.log("\nBING MIRROR GOOGLE ALERTS");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nMIRROR PLAN");
  console.table(plans.map(formatMirrorPlanRow));

  const uncertain = plans.filter((plan) => !["google_news_q_param", "configured_current_google_alerts"].includes(plan.querySource));
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
