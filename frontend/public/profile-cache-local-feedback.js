// Profile-cache cards are server-selected and ordered. Apply only local
// feedback exclusions here; do not classify, group, reorder, or backfill them.
export function filterProfileCachePageForLocalFeedback(cards, {
  isHiddenExactArticle = () => false,
  isBlockedByFeedbackRule = () => false,
} = {}) {
  return (Array.isArray(cards) ? cards : []).filter((article) => (
    !isHiddenExactArticle(article) && !isBlockedByFeedbackRule(article)
  ));
}
