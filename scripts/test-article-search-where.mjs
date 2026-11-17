import assert from "node:assert/strict";
import { buildArticleWhere } from "../backend/src/database/articleRepository.js";

function matchesWhere(article, condition) {
  if (!condition) return true;
  if (condition.AND && !condition.AND.every((entry) => matchesWhere(article, entry))) return false;
  if (condition.OR && !condition.OR.some((entry) => matchesWhere(article, entry))) return false;

  return Object.entries(condition)
    .filter(([field]) => field !== "AND" && field !== "OR")
    .every(([field, value]) => {
      if (!value?.contains) return true;
      return String(article[field] || "").toLowerCase().includes(value.contains.toLowerCase());
    });
}

const nonAdjacentGhanaBanknotesArticle = {
  title: "Ghana: central bank unveils Heritage Series cedi banknotes",
};

const multiTokenWhere = buildArticleWhere({ search: "ghana banknotes" });
assert.equal(multiTokenWhere.AND.length, 2, "multi-token search must create one condition per token");
assert.equal(
  matchesWhere(nonAdjacentGhanaBanknotesArticle, multiTokenWhere),
  true,
  "multi-token search must require each token independently, so non-adjacent title terms match"
);
assert.equal(
  matchesWhere({ title: "Ghana central bank announcement" }, multiTokenWhere),
  false,
  "multi-token search must reject an article that contains only one token"
);

const multiTokenContainsValues = multiTokenWhere.AND.flatMap((condition) =>
  condition.OR.map((fieldCondition) => Object.values(fieldCondition)[0].contains)
);
assert.equal(
  multiTokenContainsValues.includes("ghana banknotes"),
  false,
  "multi-token search must not use the old literal-phrase condition"
);

const singleTokenWhere = buildArticleWhere({ search: "ghana" });
assert.equal(
  matchesWhere(nonAdjacentGhanaBanknotesArticle, singleTokenWhere),
  true,
  "single-token search must retain current matching behavior"
);

console.log("Article search where checks passed.");
