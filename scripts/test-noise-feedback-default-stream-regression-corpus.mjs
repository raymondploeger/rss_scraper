import assert from "node:assert/strict";
import fs from "node:fs";
import { assessDefaultFeedRelevance } from "../frontend/public/default-feed-relevance-policy.js";

const corpus = JSON.parse(fs.readFileSync(
  new URL("../tests/fixtures/noise-feedback-default-stream-regression-corpus.json", import.meta.url),
  "utf8"
));

assert.equal(corpus.profileContext, "balanced", "review corpus is limited to the balanced default stream");
assert.deepEqual(corpus.interestIds, [], "review corpus has no selected interests");

for (const reviewedCase of corpus.cases) {
  assert.equal(reviewedCase.expectedAction, "exclude", `${reviewedCase.article.id} is an exclusion regression`);
  const assessment = assessDefaultFeedRelevance(reviewedCase.article, reviewedCase.feed);
  assert.equal(
    assessment.accepted,
    false,
    `${reviewedCase.article.id}: ${reviewedCase.feedbackReason} (got ${assessment.reason})`
  );
}

process.stdout.write(`${JSON.stringify({ status: "passed", cases: corpus.cases.length })}\n`);
