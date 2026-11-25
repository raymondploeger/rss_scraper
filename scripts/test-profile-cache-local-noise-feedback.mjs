import assert from "node:assert/strict";
import { filterProfileCachePageForLocalFeedback } from "../frontend/public/profile-cache-local-feedback.js";

const hiddenArticleIds = new Set(["article-a"]);
const pagesByScope = {
  "30": [
    { id: "article-a", title: "Hidden cached article" },
    { id: "article-b", title: "Visible cached article" },
  ],
  extended: [
    { id: "article-a", title: "Hidden cached article" },
    { id: "article-b", title: "Visible cached article" },
  ],
};

for (const [scope, cards] of Object.entries(pagesByScope)) {
  const visibleCards = filterProfileCachePageForLocalFeedback(cards, {
    isHiddenExactArticle: (article) => hiddenArticleIds.has(article.id),
    isBlockedByFeedbackRule: () => false,
  });

  assert.deepEqual(
    visibleCards.map((article) => article.id),
    ["article-b"],
    `the ${scope} cache page excludes local exact-noise feedback without changing its remaining order`
  );
}

const ruleFiltered = filterProfileCachePageForLocalFeedback([
  { id: "article-b" },
  { id: "article-c" },
], {
  isHiddenExactArticle: () => false,
  isBlockedByFeedbackRule: (article) => article.id === "article-c",
});
assert.deepEqual(ruleFiltered.map((article) => article.id), ["article-b"], "cache pages retain the existing local feedback-rule behavior");

console.log(JSON.stringify({ status: "passed", checks: 3 }));
