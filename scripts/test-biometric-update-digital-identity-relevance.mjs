import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "Biometric Update Digital Identity",
  rssUrl: "https://www.biometricupdate.com/tag/digital-identity/feed",
};

assert.equal(
  getSourceRelevanceAssessment(feed, {
    title: "The EUDI Wallet: Building trust, unlocking growth in Europe",
    contentSnippet: "Digital identity wallets let people verify credentials with selective disclosure.",
  }).accepted,
  true,
);

assert.equal(
  getSourceRelevanceAssessment(feed, {
    title: "Data centre capacity expands across Europe",
    contentSnippet: "Infrastructure investment continues to grow.",
  }).accepted,
  false,
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 2 })}\n`);
