import { FeedRecord, ParsedFeedItem, ArticleRecord } from "../types";
import { PLACEHOLDER_THUMBNAIL } from "../config/constants";
import { createHash } from "../utils/hash";
import { canonicalizeUrl, createArticleHash, normalizeTitle, normalizeText } from "../utils/text";

export function normalizeArticle(feed: FeedRecord, item: ParsedFeedItem): ArticleRecord {
  const canonicalLink = canonicalizeUrl(item.link);
  const normalizedTitle = normalizeTitle(item.title);
  const hash = createArticleHash(normalizedTitle, item.source, item.pubDate);

  return {
    id: createHash(canonicalLink || item.link),
    title: normalizeText(item.title, "Untitled Article"),
    normalizedTitle,
    link: item.link,
    canonicalLink,
    pubDate: item.pubDate,
    source: normalizeText(item.source, "Unknown"),
    topic: normalizeText(feed.topic, feed.name || "General"),
    feedId: feed.id,
    thumbnail: normalizeText(item.thumbnail, PLACEHOLDER_THUMBNAIL),
    summary: "",
    summaryShort: "",
    keywords: [],
    contentSnippet: normalizeText(item.contentSnippet, ""),
    author: normalizeText(item.author, ""),
    clusterId: null,
    duplicateGroupId: null,
    isDuplicate: false,
    duplicateOf: null,
    hash,
    language: "unknown",
    sentimentOptional: null,
    fetchStatus: "pending",
  };
}
