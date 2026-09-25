import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";
import { isLikelyGenericMetadataImage } from "../backend/src/services/thumbnailService.js";

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

assert.equal(
  isLikelyGenericMetadataImage(
    "https://www.ecb.europa.eu/press/tvservices/html/index/ECB%20press%20conference%20place%20holder%20new_2560x1440.jpg"
  ),
  true
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 3 })}\n`);
