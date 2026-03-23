import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createApp } from "./server/createApp";
import { processArticleBacklog, refreshFeeds } from "./services/ingestionService";

const app = createApp();

export const api = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  app,
);

export const refreshFeedsJob = onSchedule(
  {
    region: "europe-west1",
    schedule: "every 5 minutes",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    await refreshFeeds();
  },
);

export const processArticlesJob = onSchedule(
  {
    region: "europe-west1",
    schedule: "every 10 minutes",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    await processArticleBacklog();
  },
);
