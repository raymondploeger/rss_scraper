import cron from "node-cron";
import { env } from "../config/env.js";
import { syncAllFeeds } from "./rssService.js";

let isRunning = false;

export function startScheduler() {
  console.log(`Starting RSS scheduler with cron: ${env.pollCron}`);

  cron.schedule(env.pollCron, async () => {
    if (isRunning) {
      console.log("Skipping scheduled refresh because a refresh is already running");
      return;
    }

    isRunning = true;
    try {
      console.log("Running scheduled feed refresh");
      await syncAllFeeds();
      console.log("Scheduled feed refresh complete");
    } catch (error) {
      console.error("Scheduled feed refresh failed:", error?.stack || error);
    } finally {
      isRunning = false;
    }
  });
}
