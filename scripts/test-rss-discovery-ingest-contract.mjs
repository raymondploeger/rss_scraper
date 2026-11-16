import assert from "node:assert/strict";
import { classifyArticleForIngest } from "../backend/src/services/articleClassificationService.js";
import { ingestNormalizedArticle } from "../backend/src/services/rssService.js";

const feed = { id: "google-alerts-test", name: "banknotes", rssUrl: "https://www.google.com/alerts/feeds/test" };
let upsertCalls = 0;
const dependencies = {
  getSourceRelevanceAssessment: () => ({ accepted: true, reason: "not_applicable" }),
  enrichGoogleNewsThumbnailFromSourceUrl: async (article) => article,
  enrichDirectArticleThumbnail: async (_feed, article) => article,
  upsertArticle: async (article) => {
    upsertCalls += 1;
    return { created: true, article };
  },
};

function article(title, contentSnippet = "") {
  return {
    id: title,
    title,
    contentSnippet,
    source: "Google Alerts",
    ...classifyArticleForIngest({ title, contentSnippet, source: "Google Alerts", feedName: feed.name }),
  };
}

const rejected = await ingestNormalizedArticle(feed, article("Dollar near 19-month high, banknotes pictured"), dependencies);
assert.equal(rejected.accepted, false);
assert.equal(rejected.reason, "discovery-feed-quality:banknotes_missing_concrete_context");
assert.equal(upsertCalls, 0, "rejected discovery items must not reach create/upsert");

const banknote = await ingestNormalizedArticle(feed, article("Central bank unveils new banknote design with hologram security features"), dependencies);
assert.equal(banknote.accepted, true);
assert.equal(upsertCalls, 1);

const securityFeaturesFeed = { ...feed, name: "Security Features" };
const documentSecurity = await ingestNormalizedArticle(securityFeaturesFeed, {
  ...article("Bank of Ghana unveils Heritage Series Cedi banknotes with enhanced security features"),
  feedName: securityFeaturesFeed.name,
}, dependencies);
assert.equal(documentSecurity.accepted, true);
assert.equal(upsertCalls, 2, "valid document-security context must reach upsert");

const passportFeed = { ...feed, name: "passports" };
const forgedPassport = await ingestNormalizedArticle(passportFeed, {
  ...article("Sri Lankan Woman arrested with forged Indian Passport at border"),
  feedName: passportFeed.name,
}, dependencies);
assert.equal(forgedPassport.accepted, true);
assert.equal(upsertCalls, 3, "valid forged-passport context must reach upsert");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 9 })}\n`);
