import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "South African Reserve Bank News",
  rssUrl: "https://www.resbank.co.za/bin/sarb/solr/publications/rss",
};

const accepted = getSourceRelevanceAssessment(feed, {
  title: "Cost of Cash Research Study",
  contentSnippet: "A study of the use, distribution and management of cash in South Africa.",
});
assert.equal(accepted.accepted, true);

const rejectedMonetaryPolicy = getSourceRelevanceAssessment(feed, {
  title: "Statement of the Monetary Policy Committee",
  contentSnippet: "The Monetary Policy Committee announced its latest interest rate decision.",
});
assert.equal(rejectedMonetaryPolicy.accepted, false);

const rejectedPrudential = getSourceRelevanceAssessment(feed, {
  title: "Notice of License Withdrawal - EG Life",
  contentSnippet: "The Prudential Authority gives notice about an insurance licence.",
});
assert.equal(rejectedPrudential.accepted, false);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 3 })}\n`);
