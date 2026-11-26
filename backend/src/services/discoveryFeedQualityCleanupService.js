import { assessDiscoveryFeedQuality } from "./discoveryFeedQualityService.js";

export const DISCOVERY_FEED_QUALITY_TARGETS = Object.freeze([
  "OVD",
  "Security Features",
  "banknotes",
  "passports",
]);

export const DISCOVERY_FEED_QUALITY_BATCH_SIZE = 100;
export const DISCOVERY_FEED_QUALITY_PREVIEW_LIMIT = 20;
export const DISCOVERY_FEED_QUALITY_EXACT_TARGET_URLS = Object.freeze({
  OVD: "https://www.google.com/alerts/feeds/08517052598424393837/16541274970187058676",
  "Security Features": "https://www.google.com/alerts/feeds/08517052598424393837/1632750707624179991",
});

export function selectedDiscoveryFeedQualityTargets(selectedFeeds) {
  if (selectedFeeds === undefined) return [...DISCOVERY_FEED_QUALITY_TARGETS];
  if (!Array.isArray(selectedFeeds) || selectedFeeds.length === 0) {
    throw new Error("At least one discovery-feed-quality target must be selected");
  }
  const selected = new Set(selectedFeeds);
  const targets = DISCOVERY_FEED_QUALITY_TARGETS.filter((name) => selected.has(name));
  if (targets.length !== selected.size) {
    throw new Error("Unknown discovery-feed-quality target selection");
  }
  return targets;
}

export function discoveryFeedQualityTargetWhere(selectedFeeds) {
  const targets = selectedDiscoveryFeedQualityTargets(selectedFeeds);
  return {
    OR: targets.map((name) => ({
      name,
      rssUrl: exactTargetUrlForSelection(targets, name)
        || { startsWith: "https://www.google.com/alerts/feeds/" },
    })),
  };
}

function exactTargetUrlForSelection(targets, name) {
  // The all-target maintenance run retains its historic Google Alert prefix
  // scope for Security Features. Its named selector is intentionally stricter.
  if (name === "Security Features" && targets.length !== 1) return undefined;
  return DISCOVERY_FEED_QUALITY_EXACT_TARGET_URLS[name];
}

function exactPlanTargetUrlForSelection(targets, name) {
  return name === "Security Features" && targets.length === 1
    ? DISCOVERY_FEED_QUALITY_EXACT_TARGET_URLS[name]
    : undefined;
}

function feedNameOf(article) {
  return String(article?.feed?.name || article?.feedName || "Unknown");
}

function hasProtectedRelation(article) {
  return (article?.wishlistMatches?.length || 0) > 0 || (article?.noiseFeedback?.length || 0) > 0;
}

function discoveryQualityText(article) {
  // Discovery policy deliberately considers only article text. Do not couple
  // cleanup to ingest classification or stored metadata.
  return {
    title: article?.title || "",
    contentSnippet: article?.contentSnippet || "",
    summary: article?.summary || "",
  };
}

export function buildDiscoveryFeedQualityCleanupPlan(snapshot = [], { selectedFeeds } = {}) {
  const targets = selectedDiscoveryFeedQualityTargets(selectedFeeds);
  const selectedTargetNames = new Set(targets);
  const selectedSnapshot = snapshot.filter((article) => {
    const feedName = feedNameOf(article);
    if (!selectedTargetNames.has(feedName)) return false;
    const exactUrl = exactPlanTargetUrlForSelection(targets, feedName);
    return !exactUrl || article?.feed?.rssUrl === exactUrl || article?.feedRssUrl === exactUrl;
  });
  const snapshotByFeed = Object.fromEntries(targets.map((name) => [name, 0]));
  const rejectedByFeed = Object.fromEntries(targets.map((name) => [name, 0]));
  const eligible = [];
  let rejectedCount = 0;
  let skippedRelationsCount = 0;

  for (const article of selectedSnapshot) {
    const feed = article.feed || { name: article.feedName, rssUrl: article.feedRssUrl };
    const feedName = feedNameOf(article);
    snapshotByFeed[feedName] = (snapshotByFeed[feedName] || 0) + 1;
    const assessment = assessDiscoveryFeedQuality(feed, discoveryQualityText(article));
    if (assessment.accepted) continue;

    rejectedCount += 1;
    rejectedByFeed[feedName] = (rejectedByFeed[feedName] || 0) + 1;
    if (hasProtectedRelation(article)) {
      skippedRelationsCount += 1;
      continue;
    }
    eligible.push({
      id: String(article.id),
      feed: feedName,
      reason: assessment.reason,
      title: String(article.title || ""),
    });
  }

  return {
    selectedFeeds: targets,
    snapshotCount: selectedSnapshot.length,
    snapshotIds: selectedSnapshot.map((article) => String(article.id)),
    snapshotByFeed,
    rejectedCount,
    rejectedByFeed,
    skippedRelationsCount,
    eligibleCount: eligible.length,
    eligible,
  };
}

export function buildDiscoveryFeedQualityCleanupOutput({ plan, mode, applied = 0 }) {
  return {
    mode,
    selectedFeeds: plan.selectedFeeds,
    warning: mode === "applied"
      ? "Permanent deletion completed; Article has no soft-delete/archive field."
      : "Dry run only; pass --apply for permanent deletion. Article has no soft-delete/archive field.",
    snapshot: {
      total: plan.snapshotCount,
      perFeed: plan.snapshotByFeed,
    },
    rejected: {
      total: plan.rejectedCount,
      perFeed: plan.rejectedByFeed,
    },
    eligible: plan.eligibleCount,
    skippedRelations: plan.skippedRelationsCount,
    applied,
    // The delete predicate is always an intersection with snapshotIds.
    unchangedOutsideSnapshot: 0,
    preview: plan.eligible.slice(0, DISCOVERY_FEED_QUALITY_PREVIEW_LIMIT),
  };
}

export async function applyDiscoveryFeedQualityCleanupPlan(prisma, plan, {
  batchSize = DISCOVERY_FEED_QUALITY_BATCH_SIZE,
  rebuildProfileCaches,
} = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }
  const snapshotIds = Array.from(new Set(plan.snapshotIds || []));
  const snapshotIdSet = new Set(snapshotIds);
  const eligibleIds = (plan.eligible || []).map((entry) => String(entry.id));
  if (eligibleIds.some((id) => !snapshotIdSet.has(id))) {
    throw new Error("Refusing to delete an ID outside the fixed snapshot");
  }
  if (eligibleIds.length && typeof rebuildProfileCaches !== "function") {
    throw new Error("Refusing cleanup without an authoritative profile-cache rebuild handler");
  }

  let applied = 0;
  for (let start = 0; start < eligibleIds.length; start += batchSize) {
    const batchIds = eligibleIds.slice(start, start + batchSize);
    const result = await prisma.$transaction(async (tx) => {
      // This is a maintenance barrier for every persistent profile cache
      // state, not merely states whose current build contains this batch.
      // Otherwise an unrelated idle profile could acquire a lease after a
      // selective fence, read pre-delete rows, and publish that build after
      // the deletion. The generation bump makes a build that read before the
      // barrier fail to publish; clearing its lease lets the post-delete
      // rebuild take over. This and deletion must remain in one transaction.
      await tx.centralBankCacheState.updateMany({
        where: {},
        data: {
          lastError: "Invalidated by discovery-feed-quality cleanup",
          refreshGeneration: { increment: 1 },
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      const deleted = await tx.article.deleteMany({
        where: {
          id: { in: batchIds },
          // Relations can be created after the snapshot. Re-check them in the
          // destructive predicate so a concurrent user signal blocks deletion.
          wishlistMatches: { none: {} },
          noiseFeedback: { none: {} },
          AND: [{ id: { in: snapshotIds } }],
        },
      });
      // Throw inside the transaction so a late relation/snapshot mismatch
      // rolls this batch back. Earlier committed batches remain fenced stale;
      // do not proceed to another destructive batch.
      if (deleted.count !== batchIds.length) {
        throw new Error(`Delete count mismatch: expected ${batchIds.length}, deleted ${deleted.count}`);
      }
      return deleted;
    });
    applied += result.count;
  }
  // Await the same cache service used by normal ingestion. If it fails, the
  // pre-delete fence leaves affected cache reads explicitly stale and apply
  // fails instead of reporting a clean successful run.
  if (applied) await rebuildProfileCaches();
  return applied;
}
