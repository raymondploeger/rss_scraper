import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import {
  applyDiscoveryFeedQualityCleanupPlan,
  buildDiscoveryFeedQualityCleanupOutput,
  buildDiscoveryFeedQualityCleanupPlan,
  discoveryFeedQualityTargetWhere,
} from "../src/services/discoveryFeedQualityCleanupService.js";
import { profileCacheService } from "../src/services/profileCacheService.js";

const APPLY = process.argv.includes("--apply");

async function takeSnapshot(prisma) {
  // This is intentionally one complete, id-ordered read before any mutation.
  // Do not convert it to offset/cursor pagination: deletions would mutate it.
  return prisma.article.findMany({
    where: { feed: { is: discoveryFeedQualityTargetWhere() } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      summary: true,
      contentSnippet: true,
      feedName: true,
      feed: { select: { id: true, name: true, rssUrl: true } },
      wishlistMatches: { select: { id: true }, take: 1 },
      noiseFeedback: { select: { id: true }, take: 1 },
    },
  });
}

async function main() {
  const prisma = await connectDatabase();
  try {
    const snapshot = await takeSnapshot(prisma);
    const plan = buildDiscoveryFeedQualityCleanupPlan(snapshot);
    if (!APPLY) {
      console.log(JSON.stringify(buildDiscoveryFeedQualityCleanupOutput({ plan, mode: "dry-run" }), null, 2));
      return;
    }

    console.warn("WARNING: --apply permanently deletes eligible articles; Article has no soft-delete/archive field.");
    const applied = await applyDiscoveryFeedQualityCleanupPlan(prisma, plan, {
      rebuildProfileCaches: () => profileCacheService.rebuildAll(),
    });
    console.log(JSON.stringify(buildDiscoveryFeedQualityCleanupOutput({ plan, mode: "applied", applied }), null, 2));
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
