import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "European Central Bank Press Releases",
  rssUrl: "https://www.ecb.europa.eu/rss/press.html",
};

const accepted = getSourceRelevanceAssessment(feed, {
  title: "ECB reveals shortlisted designs for new banknotes",
  contentSnippet: "The new euro banknote series will include improved security features.",
});
assert.equal(accepted.accepted, true);

const rejected = getSourceRelevanceAssessment(feed, {
  title: "Monetary policy decisions",
  contentSnippet: "The Governing Council decided to keep interest rates unchanged.",
});
assert.equal(rejected.accepted, false);

const cashMonetaryPolicyBypass = getSourceRelevanceAssessment(feed, {
  title: "Monetary policy decision on cash",
  contentSnippet: "The Governing Council kept interest rates unchanged.",
});
assert.equal(cashMonetaryPolicyBypass.accepted, false);

const acceptedWithMonetaryPolicyContext = getSourceRelevanceAssessment(feed, {
  title: "ECB announces new euro banknote design",
  contentSnippet: "The announcement follows the latest monetary policy discussion.",
});
assert.equal(acceptedWithMonetaryPolicyContext.accepted, true);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 4 })}\n`);
