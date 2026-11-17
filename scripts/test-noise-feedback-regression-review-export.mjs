import assert from "node:assert/strict";
import fs from "node:fs";
import { buildNoiseFeedbackRegressionReviewExport } from "../frontend/public/noise-feedback-regression-review-export.js";

const records = [
  {
    articleId: "article-b",
    articleTitle: "Second candidate",
    articleSource: "Source B",
    articleFeedName: "Feed B",
    articleUrl: "https://example.test/b",
    reason: "wrong_topic",
    profileContext: "identity",
    interestIds: ["identity_documents"],
    createdAt: "2026-11-17T10:00:00.000Z",
    clientId: "must-not-export",
    terms: ["local", "rule"],
    type: "topic_pattern",
  },
  {
    articleId: "article-a",
    articleTitle: "First candidate",
    articleSource: "Source A",
    articleFeedName: "Feed A",
    articleUrl: "https://example.test/a",
    reason: "noisy_source",
    profileContext: "identity",
    interestIds: ["identity_documents", "biometrics"],
    createdAt: "2026-11-17T10:00:00.000Z",
    localRule: { source: "must-not-export" },
  },
];

const reviewExport = buildNoiseFeedbackRegressionReviewExport(records);

assert.deepEqual(reviewExport, {
  schema: "rss-monitoring-dashboard.noise-feedback-regression-review",
  version: 1,
  candidates: [
    {
      articleId: "article-a",
      title: "First candidate",
      source: "Source A",
      feedName: "Feed A",
      url: "https://example.test/a",
      reason: "noisy_source",
      profileContext: "identity",
      interestIds: ["identity_documents", "biometrics"],
      createdAt: "2026-11-17T10:00:00.000Z",
      expectedAction: "exclude",
    },
    {
      articleId: "article-b",
      title: "Second candidate",
      source: "Source B",
      feedName: "Feed B",
      url: "https://example.test/b",
      reason: "wrong_topic",
      profileContext: "identity",
      interestIds: ["identity_documents"],
      createdAt: "2026-11-17T10:00:00.000Z",
      expectedAction: "exclude",
    },
  ],
}, "the review export has a stable schema, only review fields, exclude intent, and deterministic ordering");

assert.equal("clientId" in reviewExport.candidates[0], false, "client identifiers are never exported");
assert.equal("localRule" in reviewExport.candidates[0], false, "local rule internals are never exported");
assert.equal("terms" in reviewExport.candidates[1], false, "local rule terms are never exported");

const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");
const submitNoiseFeedbackSource = appSource.match(/async function submitNoiseFeedback\(article, reason\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.doesNotMatch(submitNoiseFeedbackSource, /addNoiseFeedbackRule\(/, "a single submission must not create a generalized local rule");
assert.match(appSource, /function syncNoisySourceRules\(\)/, "repeated noisy-source reports retain their existing threshold workflow");

process.stdout.write(JSON.stringify({ status: "passed", checks: 6 }, null, 2) + "\n");
