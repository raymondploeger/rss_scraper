import cron from "node-cron";
import { env } from "../config/env.js";
import { syncAllFeeds } from "./rssService.js";

let isRunning = false;

export function startScheduler() {
  cron.schedule(env.pollCron, async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      await syncAllFeeds();
    } finally {
      isRunning = false;
    }
  });
}
