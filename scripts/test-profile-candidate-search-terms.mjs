import assert from "node:assert/strict";
import { appendProfileCandidateSearchTerms } from "../frontend/public/profile-candidate-query-params.js";
import { parseArticleQueryValues } from "../backend/src/controllers/articleController.js";

const params = appendProfileCandidateSearchTerms(
  new URLSearchParams({ completeCandidates: "true", topic: "Banknotes" }),
  ["currency, redesign", "banknote issuance", "currency, redesign"]
);
assert.deepEqual(
  params.getAll("searchTerms"),
  ["currency, redesign", "banknote issuance"],
  "profile search phrases must retain commas and be deduplicated without a lossy delimiter"
);
assert.deepEqual(
  parseArticleQueryValues(params.getAll("searchTerms")),
  ["currency, redesign", "banknote issuance"],
  "the API parser must preserve each repeated URL parameter as one complete phrase"
);
assert.deepEqual(parseArticleQueryValues("banknote issuance"), ["banknote issuance"]);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 3 })}\n`);
