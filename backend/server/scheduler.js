import cron from "node-cron";
import { env } from "./config.js";
import { syncAllFeeds } from "../rss/rssSync.js";

export function startFeedScheduler() {
  cron.schedule(env.pollCron, async () => {
    try {
      await syncAllFeeds();
    } catch (error) {
      console.error("Scheduled sync failed", error);
    }
  });
}
