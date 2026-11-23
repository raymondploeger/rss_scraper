import { getDatabase } from "../config/db.js";
import { mapArticleRecord } from "./helpers.js";

const STATE_ID = "central_bank";
const LEASE_DURATION_SQL = "5 minutes";

export async function listCentralBankCacheCandidates({ since }) {
  const prisma = getDatabase();
  const rows = await prisma.article.findMany({
    where: { pubDate: { gte: since }, isDuplicate: false },
    orderBy: [{ pubDate: "desc" }, { createdAt: "desc" }],
    include: { feed: true, wishlistMatches: { include: { wishlistItem: { select: { id: true, title: true, priority: true, category: true } } } } },
  });
  return rows.map(mapArticleRecord);
}

export async function loadCentralBankCacheActiveBuild() {
  const prisma = getDatabase();
  return prisma.centralBankCacheState.findUnique({
    where: { id: STATE_ID },
    include: {
      activeBuild: {
        include: {
          entries: {
            include: {
              article: {
                include: {
                  feed: true,
                  wishlistMatches: {
                    include: { wishlistItem: { select: { id: true, title: true, priority: true, category: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function acquireCentralBankCacheLease({ ownerId }) {
  const prisma = getDatabase();
  const rows = await prisma.$queryRaw`
    INSERT INTO "central_bank_cache_state" ("id", "refreshGeneration", "leaseOwner", "leaseExpiresAt", "lastError", "updatedAt")
    VALUES (${STATE_ID}, 1, ${ownerId}, CURRENT_TIMESTAMP + ${LEASE_DURATION_SQL}::interval, '', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE
    SET "refreshGeneration" = "central_bank_cache_state"."refreshGeneration" + 1,
        "leaseOwner" = ${ownerId},
        "leaseExpiresAt" = CURRENT_TIMESTAMP + ${LEASE_DURATION_SQL}::interval,
        "lastError" = '',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "central_bank_cache_state"."leaseExpiresAt" IS NULL
       OR "central_bank_cache_state"."leaseExpiresAt" <= CURRENT_TIMESTAMP
    RETURNING "refreshGeneration"
  `;
  if (!rows.length) return null;
  return { ownerId, generation: Number(rows[0].refreshGeneration) };
}

export async function releaseCentralBankCacheLease({ ownerId, generation }) {
  const prisma = getDatabase();
  await prisma.centralBankCacheState.updateMany({
    where: { id: STATE_ID, refreshGeneration: generation, leaseOwner: ownerId },
    data: { leaseOwner: null, leaseExpiresAt: null },
  });
}

export async function replaceCentralBankCacheAtomically({ generatedAt, articleIds, lease }) {
  const prisma = getDatabase();
  return prisma.$transaction(async (tx) => {
    const build = await tx.centralBankCacheBuild.create({ data: { generatedAt } });
    if (articleIds.length) {
      await tx.centralBankCacheEntry.createMany({ data: articleIds.map((articleId) => ({ buildId: build.id, articleId })), skipDuplicates: true });
    }
    const published = await tx.$queryRaw`
      UPDATE "central_bank_cache_state"
      SET "activeBuildId" = ${build.id}, "generatedAt" = ${generatedAt}, "lastError" = '', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${STATE_ID}
        AND "refreshGeneration" = ${lease.generation}
        AND "leaseOwner" = ${lease.ownerId}
        AND "leaseExpiresAt" > CURRENT_TIMESTAMP
      RETURNING "id"
    `;
    if (!published.length) throw new Error("Central Bank cache refresh lease was lost before publish");
    await tx.centralBankCacheBuild.deleteMany({ where: { id: { not: build.id } } });
    return build;
  });
}

export async function recordCentralBankCacheFailure(error, lease) {
  const prisma = getDatabase();
  const message = String(error?.message || error || "Cache rebuild failed").slice(0, 2000);
  await prisma.$executeRaw`
    UPDATE "central_bank_cache_state"
    SET "lastError" = ${message}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${STATE_ID}
      AND "refreshGeneration" = ${lease.generation}
      AND "leaseOwner" = ${lease.ownerId}
      AND "leaseExpiresAt" > CURRENT_TIMESTAMP
  `;
}
