import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "GOV.UK One Login Updates",
  rssUrl: "https://gds.blog.gov.uk/category/gov-uk-one-login/feed/",
};

assert.equal(
  getSourceRelevanceAssessment(feed, {
    title: "How GDS and DWP worked together to improve GOV.UK One Login",
    contentSnippet: "Making it easier to prove your identity online for government services.",
  }).accepted,
  true,
);

assert.equal(
  getSourceRelevanceAssessment(feed, {
    title: "Government Digital Service annual staff update",
    contentSnippet: "An update on internal ways of working.",
  }).accepted,
  false,
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 2 })}\n`);
