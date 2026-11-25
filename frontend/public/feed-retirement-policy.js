// These are audited aggregate-query feeds whose terms collide with unrelated
// acronyms and names.  Keep this list URL-only: neighbouring feeds on the same
// host, including constrained banknote queries, must remain available.
export const RETIRED_GENERIC_AGGREGATE_RSS_URLS = Object.freeze([
  "https://www.bing.com/news/search?q=%22DOVID%22&format=rss",
  "https://www.bing.com/news/search?q=%22OVD%22&format=rss",
  "https://www.bing.com/news/search?q=%22DOVID%22%20%22security%20feature%22&format=rss",
  "https://www.google.com/alerts/feeds/08517052598424393837/16541274970187058676",
  "https://www.google.com/alerts/feeds/08517052598424393837/14902034666422470603",
]);

const RETIRED_GENERIC_AGGREGATE_RSS_URL_SET = new Set(RETIRED_GENERIC_AGGREGATE_RSS_URLS);

export function isRetiredGenericAggregateRssUrl(value) {
  return RETIRED_GENERIC_AGGREGATE_RSS_URL_SET.has(String(value || "").trim());
}

export function isRetiredGenericAggregateFeed(feed) {
  return isRetiredGenericAggregateRssUrl(feed?.rssUrl);
}
