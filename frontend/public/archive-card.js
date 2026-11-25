// Archive responses are intentionally compact. Keep this boundary narrow so
// archive rendering never promotes a stored list item into a full article.
export function normalizeArchiveCard(article = {}) {
  const link = String(article?.link || "").trim();
  const feedId = String(article?.feedId || "").trim();
  const title = String(article?.title || "").trim() || "Untitled article";
  const pubDate = String(article?.pubDate || "").trim();
  const id = String(article?.id || "").trim() || `archive:${feedId}|${pubDate}|${link || title}`;
  const source = String(article?.sourceName || article?.source || "").trim() || "Unknown source";

  return {
    id,
    title,
    link,
    canonicalLink: link,
    pubDate,
    source,
    sourceName: source,
    feedId,
    topic: String(article?.topic || "").trim() || "General",
    isArchiveCard: true,
  };
}
