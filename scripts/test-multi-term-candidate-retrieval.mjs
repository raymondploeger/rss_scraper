import assert from "node:assert/strict";
import { buildArticleWhere } from "../backend/src/database/articleRepository.js";

const where = buildArticleWhere({
  topic: "Banknotes",
  searchTerms: ["banknote issuance", "currency redesign"],
  excludeDuplicates: true,
});

assert.equal(where.topic, undefined, "a topic baseline must join the search union instead of narrowing every search term");
assert.equal(where.isDuplicate, false);
assert.equal(where.AND.length, 1);
const union = where.AND[0];
assert.equal(union.OR.length, 3, "the topic baseline and two complete search phrases must share one OR union");
assert.deepEqual(union.OR[0], { topic: "Banknotes" });
assert.equal(union.OR[1].AND.length, 2, "each multi-word search phrase must retain AND token semantics");
assert.equal(union.OR[2].AND.length, 2, "each multi-word search phrase must retain AND token semantics");
const singleTermWhere = buildArticleWhere({ searchTerms: ["banknote"], excludeDuplicates: true });
const tokenFields = singleTermWhere.AND[0].OR[0].AND[0].OR;
assert.equal(tokenFields.length, 7, "one multi-term query must retain the existing searchable fields");
assert.deepEqual(tokenFields[0], { title: { contains: "banknote", mode: "insensitive" } });

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 8 })}\n`);
