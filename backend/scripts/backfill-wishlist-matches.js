import { getDatabase } from "../src/config/db.js";
import { deactivateCompletedWishlistItems } from "../src/database/wishlistRepository.js";
import { clearWishlistItemCache, matchAndStoreArticleWishlistSignals } from "../src/services/wishlistMatchingService.js";

const PAGE_SIZE = 100;
const prisma = getDatabase();
let inspected = 0;
let matchedArticles = 0;
let matches = 0;

const snapshotArticleIds = (await prisma.article.findMany({
  where: {
    wishlistMatches: { some: {} },
  },
  select: { id: true },
  orderBy: { id: "asc" },
})).map(({ id }) => id);

const deactivatedCompletedItems = await deactivateCompletedWishlistItems();
clearWishlistItemCache();

for (let start = 0; start < snapshotArticleIds.length; start += PAGE_SIZE) {
  const articleIds = snapshotArticleIds.slice(start, start + PAGE_SIZE);
  const articles = await prisma.article.findMany({
    where: {
      id: { in: articleIds },
    },
    orderBy: { id: "asc" },
  });
  for (const article of articles) {
    const articleMatches = await matchAndStoreArticleWishlistSignals(article);
    inspected += 1;
    if (articleMatches.length) {
      matchedArticles += 1;
      matches += articleMatches.length;
    }
  }
}

console.log(JSON.stringify({
  deactivatedCompletedItems: Number(deactivatedCompletedItems.count || 0),
  inspected,
  matchedArticles,
  matches,
}));
