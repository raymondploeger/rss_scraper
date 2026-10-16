import { inspectArticleRetention, enforceArticleRetention } from "../src/services/articleRetentionService.js";

const APPLY = process.argv.includes("--apply");

const result = APPLY
  ? await enforceArticleRetention()
  : await inspectArticleRetention();

console.log(JSON.stringify({
  mode: APPLY ? "applied" : "dry-run",
  standardRetentionDays: 365,
  extendedRetentionDays: 365 * 3,
  extendedProfiles: result.extendedProfileIds,
  eligibleFeedCount: result.eligibleFeedCount,
  extendedFeedCount: result.extendedFeedIds.length,
  defaultBefore: result.defaultBefore.toISOString(),
  extendedBefore: result.extendedBefore.toISOString(),
  ...(APPLY ? { deleted: result.deleted } : { candidates: result.counts }),
}, null, 2));
