import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveSqlitePath() {
  const explicitPath = process.env.SQLITE_PATH;
  const railwayVolumeMount = process.env.RAILWAY_VOLUME_MOUNT_PATH;

  if (explicitPath) {
    return path.isAbsolute(explicitPath) ? explicitPath : path.resolve(__dirname, "../../", explicitPath);
  }

  if (railwayVolumeMount) {
    return path.join(railwayVolumeMount, "rss-monitor.db");
  }

  return path.resolve(__dirname, "../../", "./data/rss-monitor.db");
}

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  port: toNumber(process.env.PORT, 4000),
  host: process.env.HOST || "127.0.0.1",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  pollCron: process.env.POLL_CRON || "*/5 * * * *",
  pollConcurrency: Math.max(1, toNumber(process.env.POLL_CONCURRENCY, 5)),
  requestTimeoutMs: Math.max(1000, toNumber(process.env.REQUEST_TIMEOUT_MS, 10000)),
  maxFeeds: Math.max(1, toNumber(process.env.MAX_FEEDS, 50)),
  scrapeRetryAttempts: Math.max(0, toNumber(process.env.SCRAPE_RETRY_ATTEMPTS, 2)),
  sqlitePath: resolveSqlitePath(),
  publicAppUrl: process.env.PUBLIC_APP_URL || "",
  placeholderImage: process.env.PLACEHOLDER_IMAGE || "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image"
};
