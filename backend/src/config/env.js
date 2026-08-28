import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: envFilePath });

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const MAX_RSS_FEEDS = 300;

export const env = {
  port: toNumber(process.env.PORT, 4000),
  host: process.env.HOST || "127.0.0.1",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  pollCron: process.env.POLL_CRON || "0 * * * *",
  pollConcurrency: Math.max(1, toNumber(process.env.POLL_CONCURRENCY, 2)),
  scheduledPollConcurrency: Math.max(1, toNumber(process.env.SCHEDULED_POLL_CONCURRENCY, 2)),
  scheduledBatchDelayMs: Math.max(0, toNumber(process.env.SCHEDULED_BATCH_DELAY_MS, 1500)),
  refreshAbortRssMb: Math.max(0, toNumber(process.env.REFRESH_ABORT_RSS_MB, 2800)),
  requestTimeoutMs: Math.max(1000, toNumber(process.env.REQUEST_TIMEOUT_MS, 10000)),
  maxFeeds: Math.max(MAX_RSS_FEEDS, toNumber(process.env.MAX_FEEDS, MAX_RSS_FEEDS)),
  maxArticlePageSize: Math.max(50, toNumber(process.env.MAX_ARTICLE_PAGE_SIZE, 200)),
  canonicalDedupeCandidateLimit: Math.max(200, toNumber(process.env.CANONICAL_DEDUPE_CANDIDATE_LIMIT, 1500)),
  articleQuerySlowMs: Math.max(250, toNumber(process.env.ARTICLE_QUERY_SLOW_MS, 1500)),
  scrapeRetryAttempts: Math.max(0, toNumber(process.env.SCRAPE_RETRY_ATTEMPTS, 2)),
  thumbnailEnrichmentConcurrency: Math.max(1, toNumber(process.env.THUMBNAIL_ENRICHMENT_CONCURRENCY, 2)),
  thumbnailEnrichmentMaxQueue: Math.max(10, toNumber(process.env.THUMBNAIL_ENRICHMENT_MAX_QUEUE, 150)),
  databaseUrl: process.env.DATABASE_URL || "",
  publicAppUrl: process.env.PUBLIC_APP_URL || "",
  placeholderImage: process.env.PLACEHOLDER_IMAGE || "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image"
};

export { envFilePath };
