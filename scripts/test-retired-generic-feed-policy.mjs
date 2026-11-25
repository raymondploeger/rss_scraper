import assert from "node:assert/strict";
import fs from "node:fs";
import { buildArticleWhere } from "../backend/src/database/articleRepository.js";
import { createArchiveService } from "../backend/src/services/archiveService.js";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";
import { ingestNormalizedArticle } from "../backend/src/services/rssService.js";
import { retireExactGenericAggregateFeeds } from "../backend/src/services/strategicFeedBootstrapService.js";
import { filterDefaultFeedRelevanceBeforeGrouping } from "../frontend/public/default-feed-relevance-stream.js";
import {
  RETIRED_GENERIC_AGGREGATE_RSS_URLS,
  isRetiredGenericAggregateFeed,
} from "../frontend/public/feed-retirement-policy.js";

const retiredOvd = "https://www.bing.com/news/search?q=%22OVD%22&format=rss";
const retiredDovid = "https://www.google.com/alerts/feeds/08517052598424393837/14902034666422470603";
const kinegram = { name: "OVD Kinegram Insights", rssUrl: "https://www.kinegram.com/events-insights/insights" };
const bingBanknotes = { name: "Bing Mirror - banknotes", rssUrl: "https://www.bing.com/news/search?q=%22banknotes%22&format=rss" };
const constrainedDocumentFeed = { name: "Bing News - Passport Security Features", rssUrl: "https://www.bing.com/news/search?q=%22passport%22%20%22security%20features%22&format=rss" };
const ovdEmergencyArticle = { title: "OVD emergency dispatch: fire brigade sent to gas leak", contentSnippet: "Emergency responders attended the incident." };
const dovidPersonArticle = { title: "Dovid Cohen announces community fundraiser", contentSnippet: "The local resident organised the event." };
const kinegramDetailArticle = { title: "Kinegram detail: optical security feature for travel documents", contentSnippet: "The issuer uses an optical variable device in its document-security programme." };
const banknoteArticle = { title: "Central bank issues new commemorative banknotes", contentSnippet: "The new banknote series enters circulation with upgraded security features." };

assert.equal(RETIRED_GENERIC_AGGREGATE_RSS_URLS.length, 5, "the central list contains only the five audited generic aggregate URLs");
assert.equal(isRetiredGenericAggregateFeed({ rssUrl: retiredOvd }), true, "bare OVD Bing query is retired by exact RSS URL");
assert.equal(isRetiredGenericAggregateFeed({ rssUrl: retiredDovid }), true, "active bare DOVID Google Alert is retired by exact RSS URL");
assert.equal(isRetiredGenericAggregateFeed(kinegram), false, "Kinegram Insights is not blocked by its OVD name");
assert.equal(isRetiredGenericAggregateFeed(bingBanknotes), false, "Bing banknote mirror is not blocked by host identity");
assert.equal(isRetiredGenericAggregateFeed(constrainedDocumentFeed), false, "other constrained document-security feeds remain eligible");

const feedControllerSource = fs.readFileSync(new URL("../backend/src/controllers/feedController.js", import.meta.url), "utf8");
const bootstrapSource = fs.readFileSync(new URL("../backend/src/services/strategicFeedBootstrapService.js", import.meta.url), "utf8");
const mirrorBootstrapSource = fs.readFileSync(new URL("../backend/scripts/bing-mirror-google-alerts.js", import.meta.url), "utf8");
assert.match(feedControllerSource, /isRetiredGenericAggregateRssUrl\(resolvedFeedUrl\)/, "manual feed configuration rejects exact retired URLs");
assert.match(bootstrapSource, /isRetiredGenericAggregateRssUrl\(definition\.rssUrl\)/, "strategic bootstrap cannot recreate exact retired URLs");
assert.doesNotMatch(mirrorBootstrapSource, /^\s*"DOVID",$/m, "bare DOVID mirror query is not recreated");
assert.doesNotMatch(mirrorBootstrapSource, /^\s*"OVD",$/m, "bare OVD mirror query is not recreated");

assert.equal(getSourceRelevanceAssessment({ rssUrl: retiredOvd }, ovdEmergencyArticle).accepted, false, "generic OVD emergency article is rejected at feed admission");
assert.equal(getSourceRelevanceAssessment({ rssUrl: retiredDovid }, dovidPersonArticle).accepted, false, "generic DOVID person-name article is rejected at feed admission");
assert.equal(getSourceRelevanceAssessment(kinegram, kinegramDetailArticle).accepted, true, "Kinegram detail article remains admitted");
assert.equal(getSourceRelevanceAssessment(bingBanknotes, banknoteArticle).accepted, true, "Bing banknote article remains admitted");

let upserts = 0;
const ingestResult = await ingestNormalizedArticle({ id: "retired-ovd", rssUrl: retiredOvd }, ovdEmergencyArticle, {
  upsertArticle: async () => { upserts += 1; },
  enrichGoogleNewsThumbnailFromSourceUrl: async (article) => article,
  enrichDirectArticleThumbnail: async (_feed, article) => article,
});
assert.equal(ingestResult.accepted, false, "retired feed cannot enter ingest relevance paths");
assert.equal(upserts, 0, "retired feed rejection performs no write");

const defaultArticles = [
  { id: "retired-ovd", feedId: "retired-ovd", feedRssUrl: retiredOvd, ...ovdEmergencyArticle },
  { id: "kinegram", feedId: "kinegram", feedRssUrl: kinegram.rssUrl, ...kinegramDetailArticle },
  { id: "banknotes", feedId: "banknotes", feedRssUrl: bingBanknotes.rssUrl, ...banknoteArticle },
];
const resolveFeed = (article) => ({ rssUrl: article.feedRssUrl, name: article.feedId });
assert.deepEqual(
  filterDefaultFeedRelevanceBeforeGrouping(defaultArticles, { resolveFeed }).map((article) => article.id),
  ["kinegram", "banknotes"],
  "generic no-profile default relevance excludes only retired feed identities"
);
assert.equal(
  filterDefaultFeedRelevanceBeforeGrouping(defaultArticles, { hasProfile: true, resolveFeed }).length,
  3,
  "profile-cache behavior remains unchanged"
);

const groupedRetiredFirst = {
  id: "grouped-retired-first",
  feedRssUrl: kinegram.rssUrl,
  sources: [
    { id: "retired-member-first", feedRssUrl: retiredOvd, ...ovdEmergencyArticle },
    { id: "kinegram-member", feedRssUrl: kinegram.rssUrl, ...kinegramDetailArticle },
  ],
};
const groupedRetiredLast = {
  id: "grouped-retired-last",
  feedRssUrl: bingBanknotes.rssUrl,
  sources: [
    { id: "banknote-member", feedRssUrl: bingBanknotes.rssUrl, ...banknoteArticle },
    { id: "retired-member-last", feedRssUrl: retiredDovid, ...dovidPersonArticle },
  ],
};
const groupedRetirementResults = filterDefaultFeedRelevanceBeforeGrouping(
  [groupedRetiredFirst, groupedRetiredLast],
  { resolveFeed }
);
assert.deepEqual(
  groupedRetirementResults.map((article) => ({ id: article.id, sourceIds: article.sources.map((source) => source.id) })),
  [
    { id: "kinegram-member", sourceIds: ["kinegram-member"] },
    { id: "banknote-member", sourceIds: ["banknote-member"] },
  ],
  "grouped retirement removes exact retired members in either position before representative choice while retaining Kinegram and banknote members"
);

const activeFeedsByUrl = new Map([
  [retiredOvd, { id: "retired-ovd", rssUrl: retiredOvd, isActive: true }],
  [retiredDovid, { id: "retired-dovid", rssUrl: retiredDovid, isActive: true }],
  ["https://example.test/active", { id: "unrelated", rssUrl: "https://example.test/active", isActive: true }],
]);
const feedUpdates = [];
const lookedUpRetiredUrls = [];
const retirementResult = await retireExactGenericAggregateFeeds({
  findFeedByRssUrl: async (rssUrl) => {
    lookedUpRetiredUrls.push(rssUrl);
    return activeFeedsByUrl.get(rssUrl) || null;
  },
  updateFeedRecord: async (id, updates) => {
    feedUpdates.push({ id, updates });
    const feed = [...activeFeedsByUrl.values()].find((candidate) => candidate.id === id);
    Object.assign(feed, updates);
    return { ...feed, ...updates };
  },
});
assert.deepEqual(lookedUpRetiredUrls, RETIRED_GENERIC_AGGREGATE_RSS_URLS, "bootstrap retirement checks every exact retired URL");
assert.deepEqual(
  feedUpdates,
  [
    { id: "retired-ovd", updates: { isActive: false, lastStatus: "idle", lastError: null } },
    { id: "retired-dovid", updates: { isActive: false, lastStatus: "idle", lastError: null } },
  ],
  "bootstrap retirement deactivates only exact active retired URLs without article deletion"
);
assert.equal(retirementResult.retired, 2, "all matching active retired URLs are counted");
assert.equal(retirementResult.failed, 0, "deterministic mocked retirement succeeds");
assert.equal(activeFeedsByUrl.get("https://example.test/active").isActive, true, "nonmatching feeds remain unchanged");
const repeatedRetirementResult = await retireExactGenericAggregateFeeds({
  findFeedByRssUrl: async (rssUrl) => {
    const feed = activeFeedsByUrl.get(rssUrl);
    return feed || null;
  },
  updateFeedRecord: async () => { throw new Error("idempotent retirement must not update inactive feeds"); },
});
assert.equal(repeatedRetirementResult.retired, 0, "retirement is idempotent once matching feeds are inactive");

const where = buildArticleWhere({ excludeRetiredGenericAggregateFeeds: true });
assert.ok(
  where.AND?.some((condition) => condition.NOT?.feed?.rssUrl?.in?.includes(retiredOvd)),
  "archive repository excludes retired feeds by exact related-feed RSS URL"
);

let listFilters;
let countFilters;
const archive = createArchiveService({
  repository: {
    listArchivePage: async ({ filters }) => { listFilters = filters; return []; },
    countArchiveArticles: async (filters) => { countFilters = filters; return 0; },
  },
});
await archive.read();
assert.equal(listFilters.excludeRetiredGenericAggregateFeeds, true, "archive list receives retirement predicate filter");
assert.deepEqual(countFilters, listFilters, "archive count and list use identical retirement filters");

process.stdout.write("Retired generic feed policy checks passed.\\n");
