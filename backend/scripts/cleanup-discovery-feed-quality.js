import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { fileURLToPath } from "node:url";
import {
  applyDiscoveryFeedQualityCleanupPlan,
  buildDiscoveryFeedQualityCleanupOutput,
  buildDiscoveryFeedQualityCleanupPlan,
  DISCOVERY_FEED_QUALITY_TARGETS,
  discoveryFeedQualityTargetWhere,
} from "../src/services/discoveryFeedQualityCleanupService.js";
import { profileCacheService } from "../src/services/profileCacheService.js";

const FEED_SELECTOR_ERROR = "Invalid --feed value. Allowed feed selector: ovd.";

export function parseCleanupDiscoveryFeedQualityArgs(argv) {
  let apply = false;
  let selectedFeeds;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--feed") {
      if (selectedFeeds) throw new Error("--feed may only be provided once; allowed feed selector: ovd.");
      const value = argv[index + 1];
      if (!value || value.startsWith("--") || value.toLowerCase() !== "ovd") {
        throw new Error(FEED_SELECTOR_ERROR);
      }
      selectedFeeds = ["OVD"];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}. Allowed arguments: --apply, --feed ovd.`);
  }

  return { apply, selectedFeeds: selectedFeeds || [...DISCOVERY_FEED_QUALITY_TARGETS] };
}

export async function takeSnapshot(prisma, selectedFeeds) {
  // This is intentionally one complete, id-ordered read before any mutation.
  // Do not convert it to offset/cursor pagination: deletions would mutate it.
  return prisma.article.findMany({
    where: { feed: { is: discoveryFeedQualityTargetWhere(selectedFeeds) } },
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

export async function main(argv = process.argv.slice(2)) {
  // Validate all options before opening a database connection.
  const { apply, selectedFeeds } = parseCleanupDiscoveryFeedQualityArgs(argv);
  const prisma = await connectDatabase();
  try {
    const snapshot = await takeSnapshot(prisma, selectedFeeds);
    const plan = buildDiscoveryFeedQualityCleanupPlan(snapshot, { selectedFeeds });
    if (!apply) {
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
