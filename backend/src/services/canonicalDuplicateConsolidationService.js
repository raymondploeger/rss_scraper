import { createDeterministicId } from "../utils/text.js";

function normalizedCanonicalLink(value) {
  return String(value || "").trim();
}

function snapshotArticle(article, canonicalLink) {
  return Object.freeze({
    id: String(article.id),
    canonicalLink,
    createdAt: new Date(article.createdAt).toISOString(),
    wishlistMatchIds: Object.freeze((article.wishlistMatches || []).map((match) => String(match.id))),
    noiseFeedbackIds: Object.freeze((article.noiseFeedback || []).map((feedback) => String(feedback.id))),
  });
}

function compareByCreatedAtThenId(left, right) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

/**
 * Produces an immutable, in-memory snapshot of eligible canonical-link groups.
 * The returned snapshot deliberately contains only identifiers and relationship
 * presence needed for a safe consolidation plan.
 */
export function snapshotCanonicalDuplicateGroups(articles) {
  const groupsByCanonicalLink = new Map();

  for (const article of articles || []) {
    const canonicalLink = normalizedCanonicalLink(article?.canonicalLink);
    if (!canonicalLink) continue;
    const group = groupsByCanonicalLink.get(canonicalLink) || [];
    group.push(snapshotArticle(article, canonicalLink));
    groupsByCanonicalLink.set(canonicalLink, group);
  }

  return Object.freeze(Array.from(groupsByCanonicalLink.entries())
    .filter(([, articlesInGroup]) => articlesInGroup.length > 1)
    .map(([canonicalLink, articlesInGroup]) => {
      const articles = Object.freeze([...articlesInGroup].sort(compareByCreatedAtThenId));
      return Object.freeze({
        canonicalLink,
        articleIds: Object.freeze(articles.map((article) => article.id)),
        articles,
      });
    }));
}

function skipReasons(group) {
  const reasons = [];
  if (group.articles.some((article) => article.wishlistMatchIds.length > 0)) reasons.push("wishlistMatches");
  if (group.articles.some((article) => article.noiseFeedbackIds.length > 0)) reasons.push("noiseFeedback");
  return reasons;
}

/**
 * Converts a fixed snapshot to the only updates the consolidator may issue.
 * No input object is modified and no article fields other than duplicate state
 * are represented in an update payload.
 */
export function buildCanonicalDuplicateConsolidationPlan(snapshotGroups) {
  const primaryRecords = [];
  const markedSecondaryRecords = [];
  const skippedGroups = [];

  for (const group of snapshotGroups || []) {
    const reasons = skipReasons(group);
    if (reasons.length) {
      skippedGroups.push({
        canonicalLink: group.canonicalLink,
        articleIds: [...group.articleIds],
        reasons,
      });
      continue;
    }

    const [primary, ...secondaries] = group.articles;
    const duplicateGroupId = createDeterministicId(group.canonicalLink);
    primaryRecords.push({
      canonicalLink: group.canonicalLink,
      primaryId: primary.id,
      duplicateGroupId,
      update: { isDuplicate: false, duplicateOf: null, duplicateGroupId },
    });
    for (const secondary of secondaries) {
      markedSecondaryRecords.push({
        canonicalLink: group.canonicalLink,
        id: secondary.id,
        primaryId: primary.id,
        duplicateGroupId,
        update: { isDuplicate: true, duplicateOf: primary.id, duplicateGroupId },
      });
    }
  }

  return Object.freeze({
    snapshotGroupCount: snapshotGroups.length,
    primaryRecords: Object.freeze(primaryRecords),
    markedSecondaryRecords: Object.freeze(markedSecondaryRecords),
    skippedGroups: Object.freeze(skippedGroups),
  });
}
