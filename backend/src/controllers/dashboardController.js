import { countArticles } from "../database/articleRepository.js";
import { countFeeds, listDistinctFeedTopics } from "../database/feedRepository.js";
import { getLatestPollLog } from "../database/pollLogRepository.js";
import { getClientCount } from "../services/realtimeService.js";

export async function getSummary(request, response) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [totalFeeds, activeFeeds, articlesToday, failedFeeds, topics, latestLog, duplicatesHidden] = await Promise.all([
    countFeeds(),
    countFeeds({ isActive: true }),
    countArticles({ from: start }),
    countFeeds({ lastStatus: "error", isActive: true }),
    listDistinctFeedTopics(),
    getLatestPollLog(),
    countArticles({ onlyDuplicates: true })
  ]);

  response.json({
    totalFeeds,
    activeFeeds,
    failedFeeds,
    topics: topics.length,
    articlesToday,
    activeClusters: 0,
    duplicatesHidden,
    clientsConnected: getClientCount(),
    latestPollAt: latestLog?.startedAt || null
  });
}
