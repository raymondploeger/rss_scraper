import { getDatabase } from "../config/db.js";

export async function listActiveWishlistItems() {
  const prisma = getDatabase();
  return prisma.wishlistItem.findMany({
    where: {
      isActive: true,
      workflowStatus: { not: "Completed" },
    },
    select: { id: true, title: true, priority: true, category: true },
    orderBy: { title: "asc" },
  });
}

export async function upsertWishlistItem(item) {
  const prisma = getDatabase();
  return prisma.wishlistItem.upsert({
    where: { normalizedTitle: item.normalizedTitle },
    create: item,
    update: {
      title: item.title,
      acquisitionStatus: item.acquisitionStatus,
      workflowStatus: item.workflowStatus,
      priority: item.priority,
      category: item.category,
      sourceReference: item.sourceReference,
      isActive: item.isActive,
    },
  });
}

export async function deactivateCompletedWishlistItems() {
  const prisma = getDatabase();
  return prisma.wishlistItem.updateMany({
    where: {
      isActive: true,
      workflowStatus: "Completed",
    },
    data: { isActive: false },
  });
}

export async function upsertArticleWishlistMatches(articleId, matches) {
  const prisma = getDatabase();
  const strongMatches = matches.filter((match) => match.confidence === "strong");
  const wishlistItemIds = strongMatches.map((match) => match.wishlistItemId);
  await prisma.$transaction([
    prisma.articleWishlistMatch.deleteMany({
      where: {
        articleId,
        ...(wishlistItemIds.length ? { wishlistItemId: { notIn: wishlistItemIds } } : {}),
      },
    }),
    ...strongMatches.map((match) => prisma.articleWishlistMatch.upsert({
    where: {
      articleId_wishlistItemId: {
        articleId,
        wishlistItemId: match.wishlistItemId,
      },
    },
    create: { articleId, ...match },
    update: {
      confidence: match.confidence,
      matchedTerms: match.matchedTerms,
      imageCandidate: match.imageCandidate,
    },
    })),
  ]);
}
