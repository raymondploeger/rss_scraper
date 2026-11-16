import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assessDefaultFeedRelevance,
  shouldApplyDefaultFeedRelevanceGate,
} from "../frontend/public/default-feed-relevance-policy.js";

const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");

const vandalismArticle = {
  title: "British man suspected of vandalising Jesus statue in Vilnius - LRT",
  contentSnippet: "Police took his identity document during the investigation.",
  domains: ["identity_documents"],
  classifications: ["identity_document"],
};
const genericDigitalTrust = {
  title: "Manufacturer builds digital trust into its global supply chain",
  contentSnippet: "The compliance programme includes background checks for new employees.",
  domains: ["digital_identity"],
  classifications: ["identity_verification"],
};
const celebrityPassport = {
  title: "Celebrity shares passport photo ahead of summer holiday",
  contentSnippet: "Fans react to the travel post on social media.",
};
const banknoteIllustration = {
  title: "Markets retreat after policy uncertainty",
  contentSnippet: "Banknotes pictured in an illustration alongside the story.",
  domains: ["banknotes"],
};

assert.equal(assessDefaultFeedRelevance(vandalismArticle).accepted, false, "identity-document confiscation is not a document-system story");
assert.equal(assessDefaultFeedRelevance(genericDigitalTrust).accepted, false, "stored digital-identity labels cannot approve generic trust/background-check content");
assert.equal(assessDefaultFeedRelevance(celebrityPassport).accepted, false, "celebrity passport coverage is not a document-system story");
assert.equal(assessDefaultFeedRelevance(banknoteIllustration).accepted, false, "stored banknote labels cannot approve an illustration/related-link story");

assert.equal(assessDefaultFeedRelevance({
  title: "Kinegram releases mobile identity verification for secure onboarding",
  contentSnippet: "The product release deploys document verification for issuers.",
}).accepted, true, "Kinegram mobile identity-verification release remains visible");
assert.equal(assessDefaultFeedRelevance({
  title: "DIGITAL SEAL App Update: Mobile Identity Verification by kinegram.digital",
  contentSnippet: "The updated mobile identity-verification app supports secure document onboarding.",
}).accepted, true, "the observed Kinegram app update remains visible");
assert.equal(assessDefaultFeedRelevance({
  title: "Bank of Ghana issues Heritage Series cedi banknotes",
  contentSnippet: "The new series enters circulation with upgraded security features.",
}).accepted, true, "Bank of Ghana Heritage Series issuance remains visible");
assert.equal(assessDefaultFeedRelevance({
  title: "Government rolls out eID wallet under new interoperability standard",
  contentSnippet: "The national digital identity system enters deployment.",
}).accepted, true, "digital identity rollout/standards announcement remains visible");
assert.equal(assessDefaultFeedRelevance({
  title: "EU–UK Border Breakthrough Could Transform Channel Tunnel Travel as Brussels Tests Drive-Through Biometrics - EU Today",
  contentSnippet: "EU–UK Border Breakthrough Could Transform Channel Tunnel Travel as Brussels Tests Drive-Through Biometrics EU Today",
  domains: ["digital_identity_biometrics"],
  classifications: ["biometrics"],
}).accepted, true, "observed border-biometric system reporting remains visible");
assert.equal(assessDefaultFeedRelevance({
  title: "City park opens new playground",
  contentSnippet: "Families attended the opening.",
}).accepted, true, "family-neutral articles are not subject to a global allowlist");

assert.equal(shouldApplyDefaultFeedRelevanceGate({ hasProfile: false, hasExplicitFeedOrSource: false }), true);
assert.equal(shouldApplyDefaultFeedRelevanceGate({ hasProfile: true, hasExplicitFeedOrSource: false }), false, "profiles remain unchanged");
assert.equal(shouldApplyDefaultFeedRelevanceGate({ hasProfile: false, hasExplicitFeedOrSource: true }), false, "selected feeds and sources remain unchanged");
assert.match(appSource, /shouldApplyDefaultFeedRelevanceGate\(/, "app applies the default-stream scope gate");
assert.match(appSource, /assessDefaultFeedRelevance\(article\)/, "app invokes the shared default relevance policy");
assert.match(
  appSource,
  /const discoveryQuality[\s\S]*?if \(!discoveryQuality\.accepted\)[\s\S]*?const defaultFeedRelevance[\s\S]*?getDefaultFeedRelevanceAssessment/,
  "default relevance runs after discovery quality"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 16 })}\n`);
