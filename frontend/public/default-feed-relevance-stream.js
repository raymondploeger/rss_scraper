import {
  assessDefaultFeedRelevance,
  shouldApplyDefaultFeedRelevanceGate,
} from "./default-feed-relevance-policy.js";

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

  return candidates.filter((article) => assess(article, resolveFeed(article)).accepted);
}
