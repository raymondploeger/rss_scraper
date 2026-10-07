import { listArticles, updateArticle } from "../src/database/articleRepository.js";
import { listFeeds } from "../src/database/feedRepository.js";
import { classifyArticleForIngest } from "../src/services/articleClassificationService.js";
import { getSourceRelevanceAssessment } from "../src/services/sourceRelevanceService.js";

const APPLY = process.argv.includes("--apply");
const SOURCE_RELEVANT_ONLY = process.argv.includes("--source-relevant-only");
const PROFILE_AFFINITIES_ONLY = process.argv.includes("--profile-affinities-only");
const PAGE_SIZE = 100;
const SAMPLE_LIMIT = 12;
const FEED_ARGUMENT_INDEX = process.argv.indexOf("--feed");
const FEED_ARGUMENT_VALUES = FEED_ARGUMENT_INDEX >= 0
  ? process.argv.slice(FEED_ARGUMENT_INDEX + 1)
  : [];
const FEED_ARGUMENT_END_INDEX = FEED_ARGUMENT_VALUES.findIndex((value) => String(value).startsWith("--"));
const FEED_NAME = FEED_ARGUMENT_VALUES
  .slice(0, FEED_ARGUMENT_END_INDEX < 0 ? FEED_ARGUMENT_VALUES.length : FEED_ARGUMENT_END_INDEX)
  .join(" ")
  .trim();
const SINCE_DAYS_ARGUMENT_INDEX = process.argv.indexOf("--since-days");
const SINCE_DAYS = SINCE_DAYS_ARGUMENT_INDEX >= 0
  ? Math.max(0, Number(process.argv[SINCE_DAYS_ARGUMENT_INDEX + 1] || 0))
  : 0;
const SINCE = SINCE_DAYS
  ? new Date(Date.now() - (SINCE_DAYS * 24 * 60 * 60 * 1000)).toISOString()
  : "";

function sameList(left = [], right = []) {
  // Domains, profile signals and classifications are multi-label sets. Their
  // order may change when a rule receives a higher score, but that does not
  // represent a classification change worth writing back to the database.
  const normalize = (values) => Array.from(new Set(
    (Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)
  )).sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

async function main() {
  const feeds = await listFeeds();
  const feedsById = new Map(feeds.map((feed) => [String(feed.id), feed]));
  const selectedFeed = FEED_NAME
    ? feeds.find((feed) => String(feed.name || "").trim().toLowerCase() === FEED_NAME.toLowerCase())
    : null;
  if (FEED_NAME && !selectedFeed) {
    throw new Error(`No feed found named: ${FEED_NAME}`);
  }
  const profileAffinityFeedIds = PROFILE_AFFINITIES_ONLY && !selectedFeed
    ? feeds
      .filter((feed) => Array.isArray(feed.profileAffinities) && feed.profileAffinities.length)
      .map((feed) => feed.id)
    : [];
  if (PROFILE_AFFINITIES_ONLY && !selectedFeed && !profileAffinityFeedIds.length) {
    throw new Error("No feeds have explicit profile affinities");
  }
  const changes = [];
  let offset = 0;
  let inspected = 0;
  let skippedBySourceRelevance = 0;

  while (true) {
    const filters = {
      ...(selectedFeed ? { feedId: selectedFeed.id } : {}),
      ...(!selectedFeed && PROFILE_AFFINITIES_ONLY ? { feedIds: profileAffinityFeedIds } : {}),
      ...(SINCE ? { since: SINCE } : {}),
    };
    const articles = await listArticles(filters, { limit: PAGE_SIZE, offset });
    if (!articles.length) break;
    inspected += articles.length;

    for (const article of articles) {
      const feed = feedsById.get(String(article.feedId));
      const sourceRelevance = getSourceRelevanceAssessment(feed, article);
      if (SOURCE_RELEVANT_ONLY && !sourceRelevance.accepted) {
        skippedBySourceRelevance += 1;
        continue;
      }
      const classification = classifyArticleForIngest({
        title: article.title,
        contentSnippet: article.contentSnippet || article.summary,
        topic: feed?.topic || article.topic,
        source: article.source,
        feedName: article.feedName,
        link: article.canonicalLink || article.link,
        keywords: article.keywords,
      });
      const changed =
        article.topic !== classification.topic ||
        !sameList(article.domains, classification.domains) ||
        !sameList(article.profileSignals, classification.profileSignals) ||
        !sameList(article.classifications, classification.classifications);
      if (!changed) continue;

      changes.push({
        id: article.id,
        title: article.title,
        from: {
          topic: article.topic,
          domains: article.domains || [],
          profileSignals: article.profileSignals || [],
        },
        to: {
          topic: classification.topic,
          domains: classification.domains,
          profileSignals: classification.profileSignals,
        },
      });
      if (APPLY) {
        await updateArticle(article.id, classification);
      }
    }
    offset += articles.length;
    if (offset % (PAGE_SIZE * 10) === 0) {
      console.log(`[reclassify] inspected=${inspected} changed=${changes.length} skippedBySourceRelevance=${skippedBySourceRelevance}`);
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? "applied" : "dry-run",
    scope: selectedFeed?.name || "all feeds",
    since: SINCE || null,
    sourceRelevantOnly: SOURCE_RELEVANT_ONLY,
    profileAffinitiesOnly: PROFILE_AFFINITIES_ONLY,
    eligibleFeedCount: profileAffinityFeedIds.length || (selectedFeed ? 1 : null),
    inspected,
    skippedBySourceRelevance,
    changed: changes.length,
    examples: changes.slice(0, SAMPLE_LIMIT),
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
