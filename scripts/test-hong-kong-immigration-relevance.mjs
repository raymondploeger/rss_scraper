import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "Hong Kong Immigration Department News",
  rssUrl: "https://www.immd.gov.hk/eng/press/press_releases.html",
};

assert.equal(
  getSourceRelevanceAssessment(feed, {
    title: "Immigration Department expands self-application services for Hong Kong identity cards and HKSAR passports",
    contentSnippet: "Residents can use the new digital application service for travel documents.",
  }).accepted,
  true,
);

assert.equal(
  getSourceRelevanceAssessment(feed, {
    title: "Immigration Department to introduce Seamless e-Channel service",
    contentSnippet: "The automated passenger clearance service is being expanded.",
  }).accepted,
  true,
);

assert.equal(
  getSourceRelevanceAssessment(feed, {
    title: "Twenty persons arrested during anti-illegal worker operation",
    contentSnippet: "The operation targeted employers and overstayers.",
  }).accepted,
  false,
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 3 })}\n`);
