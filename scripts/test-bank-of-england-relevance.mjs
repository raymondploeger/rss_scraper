import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "Bank of England News",
  rssUrl: "https://www.bankofengland.co.uk/rss/news",
};

const accepted = getSourceRelevanceAssessment(feed, {
  title: "Wildlife to feature on next series of banknotes",
  contentSnippet: "The Bank of England announced the next banknote design theme.",
});
assert.equal(accepted.accepted, true);

const rejected = getSourceRelevanceAssessment(feed, {
  title: "Monetary Policy Report",
  contentSnippet: "The Monetary Policy Committee sets the interest rate outlook.",
});
assert.equal(rejected.accepted, false);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 2 })}\n`);
