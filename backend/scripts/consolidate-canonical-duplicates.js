import { getDatabase } from "../src/config/db.js";
import {
  buildCanonicalDuplicateConsolidationPlan,
  snapshotCanonicalDuplicateGroups,
} from "../src/services/canonicalDuplicateConsolidationService.js";

const APPLY = process.argv.includes("--apply");

async function loadFixedSnapshot(prisma) {
  // Intentionally one unpaginated read. Mutations below operate exclusively on
  // the IDs captured here; no cursor/offset can drift as rows are updated.
  const articles = await prisma.article.findMany({
    where: {
      canonicalLink: { not: null },
      NOT: { canonicalLink: "" },
    },
    select: {
      id: true,
      canonicalLink: true,
      createdAt: true,
      wishlistMatches: { select: { id: true } },
      noiseFeedback: { select: { id: true } },
    },
  });
  return snapshotCanonicalDuplicateGroups(articles);
}

async function applyPlan(prisma, snapshotGroups, plan) {
  const primaryRecordsByCanonicalLink = new Map(
    plan.primaryRecords.map((record) => [record.canonicalLink, record])
  );
  const secondaryRecordsByCanonicalLink = new Map();
  for (const record of plan.markedSecondaryRecords) {
    const records = secondaryRecordsByCanonicalLink.get(record.canonicalLink) || [];
    records.push(record);
    secondaryRecordsByCanonicalLink.set(record.canonicalLink, records);
  }

  let appliedUpdateCount = 0;
  await prisma.$transaction(async (transaction) => {
    for (const { canonicalLink, articleIds } of snapshotGroups) {
      const primaryRecord = primaryRecordsByCanonicalLink.get(canonicalLink);
      if (!primaryRecord) continue;

      const snapshotSecondaryIds = new Set(articleIds.filter((id) => id !== primaryRecord.primaryId));
      const secondaryRecords = secondaryRecordsByCanonicalLink.get(canonicalLink) || [];
      const secondaryIds = secondaryRecords
        .map((record) => record.id)
        .filter((id) => snapshotSecondaryIds.has(id));

      await transaction.article.update({
        where: { id: primaryRecord.primaryId },
        data: primaryRecord.update,
      });
      const secondaryUpdateResult = await transaction.article.updateMany({
        where: { id: { in: secondaryIds } },
        data: secondaryRecords[0]?.update,
      });
      if (secondaryUpdateResult.count !== secondaryIds.length) {
        throw new Error(
          `secondary update count mismatch: expected ${secondaryIds.length}, received ${secondaryUpdateResult.count}`
        );
      }
      appliedUpdateCount += 1 + secondaryIds.length;
    }
  }, { maxWait: 10_000, timeout: 300_000 });
  return appliedUpdateCount;
}

function buildSummary(snapshotGroups, plan, mode, appliedUpdateCount = 0) {
  const snapshotArticleIds = snapshotGroups.flatMap((group) => group.articleIds);
  return {
    mode,
    snapshot: {
      groupCount: snapshotGroups.length,
      articleCount: snapshotArticleIds.length,
      groups: snapshotGroups.map(({ canonicalLink, articleIds }) => ({ canonicalLink, articleIds })),
    },
    primaryRecords: plan.primaryRecords.map(({ canonicalLink, primaryId, duplicateGroupId }) => ({
      canonicalLink,
      primaryId,
      duplicateGroupId,
    })),
    markedSecondaries: plan.markedSecondaryRecords.map(({ canonicalLink, id, primaryId, duplicateGroupId }) => ({
      canonicalLink,
      id,
      primaryId,
      duplicateGroupId,
    })),
    skippedGroups: plan.skippedGroups,
    appliedUpdateCount,
    unchangedOutsideSnapshot: {
      mutationCount: 0,
      reason: "Only IDs captured in snapshot.articleIds are ever passed to update.",
    },
  };
}

export function formatCanonicalDuplicateCliSummary(summary) {
  return {
    mode: summary.mode,
    snapshot: {
      groupCount: summary.snapshot.groupCount,
      articleCount: summary.snapshot.articleCount,
    },
    primaryRecordCount: summary.primaryRecords.length,
    markedSecondaryCount: summary.markedSecondaries.length,
    skippedGroupCount: summary.skippedGroups.length,
    skippedGroups: summary.skippedGroups.slice(0, 20).map(({ canonicalLink, reasons }) => ({
      canonicalLink,
      reason: reasons.join(", "),
    })),
    appliedUpdateCount: summary.appliedUpdateCount,
    unchangedOutsideSnapshot: summary.unchangedOutsideSnapshot,
  };
}

export async function consolidateCanonicalDuplicates({ prisma = getDatabase(), apply = APPLY } = {}) {
  const snapshotGroups = await loadFixedSnapshot(prisma);
  const plan = buildCanonicalDuplicateConsolidationPlan(snapshotGroups);
  const appliedUpdateCount = apply ? await applyPlan(prisma, snapshotGroups, plan) : 0;
  return buildSummary(snapshotGroups, plan, apply ? "applied" : "dry-run", appliedUpdateCount);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  consolidateCanonicalDuplicates()
    .then((summary) => console.log(JSON.stringify(formatCanonicalDuplicateCliSummary(summary), null, 2)))
    .catch((error) => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
