import { listArticles } from "../src/database/articleRepository.js";
import { matchAndStoreArticleWishlistSignals } from "../src/services/wishlistMatchingService.js";

const PAGE_SIZE = 100;
let offset = 0;
let inspected = 0;
let matchedArticles = 0;
let matches = 0;

while (true) {
  const articles = await listArticles({}, { limit: PAGE_SIZE, offset });
  if (!articles.length) break;
  for (const article of articles) {
    const articleMatches = await matchAndStoreArticleWishlistSignals(article);
    inspected += 1;
    if (articleMatches.length) {
      matchedArticles += 1;
      matches += articleMatches.length;
    }
  }
  offset += articles.length;
  if (articles.length < PAGE_SIZE) break;
}

console.log(JSON.stringify({ inspected, matchedArticles, matches }));
