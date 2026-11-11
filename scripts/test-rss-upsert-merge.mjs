import assert from "node:assert/strict";
import { mergeArticleClassificationArrays } from "../backend/src/services/articleUpsertMergeService.js";

const existing = {
  keywords: ["banknotes"],
  domains: ["banknotes"],
  profileSignals: ["central_bank"],
  classifications: ["banknotes"],
};

const clearedKeywords = mergeArticleClassificationArrays(existing, { keywords: [] });
assert.equal(clearedKeywords.changed, true);
assert.deepEqual(clearedKeywords.values.keywords, []);
assert.deepEqual(clearedKeywords.values.domains, existing.domains);

const absentKeywords = mergeArticleClassificationArrays(existing, {});
assert.equal(absentKeywords.changed, false);
assert.deepEqual(absentKeywords.values.keywords, existing.keywords);

const nonArrayKeywords = mergeArticleClassificationArrays(existing, { keywords: "banknotes" });
assert.equal(nonArrayKeywords.changed, false);
assert.deepEqual(nonArrayKeywords.values.keywords, existing.keywords);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 7 })}\n`);
