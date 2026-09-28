import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "GovTech Singapore Digital Identity News",
  rssUrl: "https://www.tech.gov.sg/media/",
};

const accepted = getSourceRelevanceAssessment(feed, {
  title: "Singpass launches passkeys: a safer login method",
  contentSnippet: "Singapore's national digital identity platform adds phishing-resistant authentication.",
});
assert.equal(accepted.accepted, true);

const rejected = getSourceRelevanceAssessment(feed, {
  title: "Government technology scholarships announced",
  contentSnippet: "The programme supports technology talent development.",
});
assert.equal(rejected.accepted, false);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 2 })}\n`);
