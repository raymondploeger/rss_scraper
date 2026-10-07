import { listArticles, updateArticle } from "../src/database/articleRepository.js";
import { listFeeds } from "../src/database/feedRepository.js";
import { classifyArticleForIngest } from "../src/services/articleClassificationService.js";
import { getSourceRelevanceAssessment } from "../src/services/sourceRelevanceService.js";

const APPLY = process.argv.includes("--apply");
const SOURCE_RELEVANT_ONLY = process.argv.includes("--source-relevant-only");
const PAGE_SIZE = 100;
const SAMPLE_LIMIT = 12;
const FEED_ARGUMENT_INDEX = process.argv.indexOf("--feed");
const FEED_NAME = FEED_ARGUMENT_INDEX >= 0
  ? process.argv.slice(FEED_ARGUMENT_INDEX + 1).filter((value) => value !== "--apply").join(" ").trim()
  : "";

function sameList(left = [], right = []) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  const changes = [];
  let offset = 0;
  let inspected = 0;
  let skippedBySourceRelevance = 0;

  while (true) {
    const articles = await listArticles(selectedFeed ? { feedId: selectedFeed.id } : {}, { limit: PAGE_SIZE, offset });
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
  }

  console.log(JSON.stringify({
    mode: APPLY ? "applied" : "dry-run",
    scope: selectedFeed?.name || "all feeds",
    sourceRelevantOnly: SOURCE_RELEVANT_ONLY,
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
