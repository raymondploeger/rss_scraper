import cron from "node-cron";
import { env } from "../config/env.js";
import { syncAllFeeds } from "./rssService.js";
import { deleteExpiredArticleNoiseFeedback } from "../database/articleRepository.js";
import { enforceArticleRetention } from "./articleRetentionService.js";

let isRunning = false;
let isRetentionRunning = false;

export function startScheduler() {
  if (!env.schedulerEnabled) {
    console.log("RSS scheduler disabled by SCHEDULER_ENABLED=false");
    return;
  }

  console.log(`Starting RSS scheduler with cron: ${env.pollCron}`);

  cron.schedule(env.pollCron, async () => {
    if (isRunning) {
      console.log("Skipping scheduled refresh because a refresh is already running");
      return;
    }

    isRunning = true;
    try {
      console.log("Running scheduled feed refresh");
      await syncAllFeeds({
        trigger: "scheduled",
        concurrencyOverride: env.scheduledPollConcurrency,
        batchDelayMs: env.scheduledBatchDelayMs,
      });
      console.log("Scheduled feed refresh complete");
    } catch (error) {
      console.error("Scheduled feed refresh failed:", error?.stack || error);
    } finally {
      try {
        await deleteExpiredArticleNoiseFeedback();
      } catch (error) {
        console.error("Noise feedback retention cleanup failed:", error?.stack || error);
      }
      isRunning = false;
    }
  });

  if (env.articleRetentionEnabled) {
    console.log(`Starting article retention scheduler with cron: ${env.articleRetentionCron}`);
    cron.schedule(env.articleRetentionCron, async () => {
      if (isRetentionRunning) {
        console.log("Skipping article retention because a previous retention run is still active");
        return;
      }
      isRetentionRunning = true;
      try {
        const result = await enforceArticleRetention();
        console.log(`[article-retention] deleted=${result.deleted.total} standard=${result.deleted.standard} extended=${result.deleted.extended}`);
      } catch (error) {
        console.error("Article retention cleanup failed:", error?.stack || error);
      } finally {
        isRetentionRunning = false;
      }
    });
  }
}
