import { getDatabase } from "../config/db.js";

export async function listActiveWishlistItems() {
  const prisma = getDatabase();
  return prisma.wishlistItem.findMany({
    where: { isActive: true },
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

export async function upsertArticleWishlistMatches(articleId, matches) {
  const prisma = getDatabase();
  await prisma.$transaction(matches.map((match) => prisma.articleWishlistMatch.upsert({
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
  })));
}
