import {
  assessDefaultFeedRelevance,
  shouldApplyDefaultFeedRelevanceGate,
} from "./default-feed-relevance-policy.js?v=20261117-passport-context-010";

/**
 * The default-stream policy belongs at the boundary between candidate filtering
 * and event grouping. Keeping it here prevents a grouped card from being built
 * from a rejected candidate while preserving explicit-feed and profile views.
 */
export function filterDefaultFeedRelevanceBeforeGrouping(articles, {
  hasProfile = false,
  hasExplicitFeedOrSource = false,
  resolveFeed = () => ({}),
  assess = assessDefaultFeedRelevance,
} = {}) {
  const candidates = Array.isArray(articles) ? articles : [];
  if (!shouldApplyDefaultFeedRelevanceGate({ hasProfile, hasExplicitFeedOrSource })) {
    return candidates;
  }

  return candidates.flatMap((article) => {
    const groupedSources = Array.isArray(article?.sources) && article.sources.length
      ? article.sources
      : null;

    if (!groupedSources) {
      return assess(article, resolveFeed(article)).accepted ? [article] : [];
    }

    // A cached/backend candidate can already carry a reconciled event group.
    // Filter its members too: grouping may otherwise promote a rejected member
    // as the displayed primary after this boundary has run.
    const relevantSources = groupedSources.filter((sourceArticle) =>
      assess(sourceArticle, resolveFeed(sourceArticle)).accepted
    );
    if (!relevantSources.length) {
      return [];
    }

    const representative = relevantSources[0];
    return [{
      ...article,
      ...representative,
      sources: relevantSources,
      sourceCount: relevantSources.length,
      groupedArticlesCount: Math.max(0, relevantSources.length - 1),
    }];
  });
}
