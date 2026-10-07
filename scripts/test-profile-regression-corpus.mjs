import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyArticleForIngest } from "../backend/src/services/articleClassificationService.js";
import { evaluateProfilePolicyEvidence } from "../frontend/public/profile-policies.js";

const corpusUrl = new URL("../tests/fixtures/profile-regression-corpus.json", import.meta.url);
const corpus = JSON.parse(fs.readFileSync(corpusUrl, "utf8"));
const cases = Array.isArray(corpus.cases) ? corpus.cases : [];

function assertContainsAll(actual, expected, label) {
  expected.forEach((value) => {
    assert.ok(actual.includes(value), `${label}: expected ${value}, got ${JSON.stringify(actual)}`);
  });
}

function assertContainsNone(actual, excluded, label) {
  excluded.forEach((value) => {
    assert.ok(!actual.includes(value), `${label}: did not expect ${value}, got ${JSON.stringify(actual)}`);
  });
}

assert.equal(corpus.version, 1);
assert.ok(cases.length >= 7, "The profile regression corpus needs representative real articles");
assert.equal(new Set(cases.map((entry) => entry.id)).size, cases.length, "Regression case ids must be unique");

const coveredFeeds = new Set();
cases.forEach((entry) => {
  const article = entry.article || {};
  const expected = entry.expected || {};
  const classification = classifyArticleForIngest(article);
  coveredFeeds.add(article.feedName);

  assertContainsAll(classification.domains, expected.domainsInclude || [], `${entry.id} domains`);
  assertContainsAll(classification.classifications, expected.classificationsInclude || [], `${entry.id} classifications`);
  assertContainsNone(classification.classifications, expected.classificationsExclude || [], `${entry.id} classifications`);
  assertContainsAll(classification.profileSignals, expected.profileSignalsInclude || [], `${entry.id} profile signals`);
  assertContainsNone(classification.profileSignals, expected.profileSignalsExclude || [], `${entry.id} profile signals`);

  Object.entries(expected.profilePolicy || {}).forEach(([profileId, shouldPass]) => {
    // Ingestion calls this field contentSnippet; the stored API article exposes
    // the same text as description.  Evaluate the policy against that stored
    // shape so the corpus covers the actual frontend contract.
    const result = evaluateProfilePolicyEvidence({
      ...article,
      description: article.description || article.contentSnippet || "",
    }, profileId);
    assert.equal(result.passed, shouldPass, `${entry.id} ${profileId} policy result`);
  });
});

[
  "secunet Press",
  "OFS Security Printing Insights",
  "Identity Week Press Releases",
  "AAMVA News",
  "European Commission Digital Identity News",
  "Bank of Canada News",
  "Mühlbauer Press",
].forEach((feedName) => assert.ok(coveredFeeds.has(feedName), `Missing feed coverage for ${feedName}`));

process.stdout.write(`${JSON.stringify({
  corpusVersion: corpus.version,
  cases: cases.length,
  feeds: Array.from(coveredFeeds).sort(),
  status: "passed",
}, null, 2)}\n`);
