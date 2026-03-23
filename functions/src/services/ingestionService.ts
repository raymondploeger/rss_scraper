import { assignCluster } from "../clustering/clusterService";
import { createClusterAssigner } from "../clustering/clusterService";
import { summarizeArticle } from "../ai/summaryService";
import { FeedRecord, ArticleRecord } from "../types";
import { enrichArticleMetadata } from "../scraper/thumbnailScraper";
import { normalizeArticle } from "../rss/articleNormalizer";
import { parseFeed } from "../rss/feedParserService";
import { db } from "../database/firestoreService";
import { saveArticle, updateArticle, listArticles, getArticleById } from "./articleService";
import { createDuplicateMatcher } from "./dedupeService";
import { listActiveFeeds, updateFeedStatus } from "./feedService";
import { rebuildTrends } from "../trends/trendService";
import { inferKeywords } from "../utils/text";
import { logError } from "../utils/logger";
import { PLACEHOLDER_THUMBNAIL } from "../config/constants";

async function ingestFeed(feed: FeedRecord) {
  let insertedCount = 0;

  try {
    const parsed = await parseFeed(feed.rssUrl);
    const duplicateMatcher = await createDuplicateMatcher();
    const clusterAssigner = await createClusterAssigner();

    for (const item of parsed.items) {
      const baseArticle = normalizeArticle(feed, item);
      const enrichment = await enrichArticleMetadata(baseArticle.link, baseArticle.contentSnippet);
      const enrichedArticle: ArticleRecord = {
        ...baseArticle,
        canonicalLink: enrichment.canonicalLink || baseArticle.canonicalLink,
        thumbnail: enrichment.thumbnail || baseArticle.thumbnail,
        contentSnippet: enrichment.contentSnippet || enrichment.metaDescription || baseArticle.contentSnippet,
        fetchStatus: enrichment.fetchStatus,
        language: enrichment.language || "unknown",
      };

      const duplicate = duplicateMatcher.detect(enrichedArticle);
      enrichedArticle.isDuplicate = duplicate.isDuplicate;
      enrichedArticle.duplicateOf = duplicate.representativeId;
      enrichedArticle.duplicateGroupId = duplicate.duplicateGroupId;

      if (duplicate.isDuplicate) {
        const created = await saveArticle(enrichedArticle);
        if (created) {
          duplicateMatcher.remember(enrichedArticle);
          insertedCount += 1;
        }
        continue;
      }

      const summary = await summarizeArticle(enrichedArticle);
      enrichedArticle.summary = summary.summary;
      enrichedArticle.summaryShort = summary.summaryShort;
      enrichedArticle.keywords =
        summary.keywords.length > 0
          ? summary.keywords
          : inferKeywords([enrichedArticle.title, enrichedArticle.contentSnippet, enrichedArticle.topic], 6);

      const created = await saveArticle(enrichedArticle);
      if (!created) {
        const existing = await getArticleById(enrichedArticle.id);
        if (existing) {
          const shouldBackfillThumbnail =
            existing.thumbnail === PLACEHOLDER_THUMBNAIL && enrichedArticle.thumbnail !== PLACEHOLDER_THUMBNAIL;
          const shouldBackfillSnippet =
            (!existing.contentSnippet || existing.contentSnippet.length < 40) &&
            enrichedArticle.contentSnippet.length > existing.contentSnippet.length;
          const shouldBackfillLanguage = existing.language === "unknown" && enrichedArticle.language !== "unknown";

          if (shouldBackfillThumbnail || shouldBackfillSnippet || shouldBackfillLanguage) {
            await updateArticle(enrichedArticle.id, {
              thumbnail: shouldBackfillThumbnail ? enrichedArticle.thumbnail : existing.thumbnail,
              contentSnippet: shouldBackfillSnippet ? enrichedArticle.contentSnippet : existing.contentSnippet,
              language: shouldBackfillLanguage ? enrichedArticle.language : existing.language,
              fetchStatus: enrichedArticle.fetchStatus,
            });
          }
        }
        continue;
      }

      duplicateMatcher.remember(enrichedArticle);
      const clusterId = await clusterAssigner.assign({ ...enrichedArticle, clusterId: null });
      await updateArticle(enrichedArticle.id, { clusterId });
      insertedCount += 1;
    }

    await updateFeedStatus(feed.id, {
      lastFetchedAt: new Date().toISOString(),
      lastStatus: "success",
      lastInsertedCount: insertedCount,
      lastError: null,
    });

    return { feedId: feed.id, insertedCount, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    logError(`Feed ingestion failed for ${feed.id}`, error);
    await updateFeedStatus(feed.id, {
      lastFetchedAt: new Date().toISOString(),
      lastStatus: "error",
      lastError: message,
      lastInsertedCount: insertedCount,
    });

    return { feedId: feed.id, insertedCount, error: message };
  }
}

export async function refreshFeeds() {
  const feeds = await listActiveFeeds();
  const results: Array<{ feedId: string; insertedCount: number; error: string | null }> = [];

  for (let index = 0; index < feeds.length; index += 4) {
    const chunk = feeds.slice(index, index + 4);
    const chunkResults = await Promise.all(chunk.map((feed) => ingestFeed(feed)));
    results.push(...chunkResults);
  }

  const articles = await listArticles();
  await rebuildTrends(articles);

  return {
    feedsProcessed: feeds.length,
    results,
  };
}

export async function processArticleBacklog(limit = 20) {
  const snapshot = await db.collection("articles").where("summaryShort", "==", "").limit(limit).get();

  for (const doc of snapshot.docs) {
    try {
      const article = { id: doc.id, ...(doc.data() as Omit<ArticleRecord, "id">) };
      const summary = await summarizeArticle(article);
      const clusterId = article.clusterId || (article.isDuplicate ? article.duplicateOf : await assignCluster(article));
      await updateArticle(article.id, {
        summary: summary.summary,
        summaryShort: summary.summaryShort,
        keywords: summary.keywords,
        clusterId: clusterId || null,
      });
    } catch (error) {
      logError(`Backlog processing failed for ${doc.id}`, error);
    }
  }
}
