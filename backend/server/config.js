export const config = {
  port: Number(process.env.PORT || 4000),
  maxFeeds: Number(process.env.MAX_FEEDS || 50),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
  scrapeTimeoutMs: Number(process.env.SCRAPE_TIMEOUT_MS || 12000)
};
