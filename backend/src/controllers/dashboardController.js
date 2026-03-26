import { countArticles } from "../database/articleRepository.js";
import { countFeeds, listDistinctFeedTopics } from "../database/feedRepository.js";
import { getLatestPollLog } from "../database/pollLogRepository.js";
import { getClientCount } from "../services/realtimeService.js";
import { isRuntimeReady } from "../services/runtimeState.js";

export async function getSummary(request, response) {
  try {
    if (!isRuntimeReady()) {
      response.json({
        totalFeeds: 0,
        activeFeeds: 0,
        failedFeeds: 0,
        topics: 0,
        articlesToday: 0,
        activeClusters: 0,
        duplicatesHidden: 0,
        clientsConnected: getClientCount(),
        latestPollAt: null
      });
      return;
    }

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
  } catch (error) {
    console.error("Dashboard summary error:", error?.stack || error);
    response.status(500).json({ error: error?.message || "Failed to load dashboard summary" });
  }
}
