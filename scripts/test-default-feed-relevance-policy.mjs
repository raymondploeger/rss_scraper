import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assessDefaultFeedRelevance,
  shouldApplyDefaultFeedRelevanceGate,
} from "../frontend/public/default-feed-relevance-policy.js";
import { filterDefaultFeedRelevanceBeforeGrouping } from "../frontend/public/default-feed-relevance-stream.js";

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
const entryExitSystemFeed = { name: "Entry Exit System", rssUrl: "https://www.google.com/alerts/feeds/test" };
const identityDocumentFeed = { name: "Identity Document", rssUrl: "https://www.google.com/alerts/feeds/test" };
const driverLicenceFeed = { name: "Google News - Driver Licence Issuance and Redesign", rssUrl: "https://news.google.com/rss/search?q=driver+licence" };

assert.equal(assessDefaultFeedRelevance(vandalismArticle).accepted, false, "identity-document confiscation is not a document-system story");
assert.equal(assessDefaultFeedRelevance(genericDigitalTrust).accepted, false, "stored digital-identity labels cannot approve generic trust/background-check content");
assert.equal(assessDefaultFeedRelevance(celebrityPassport).accepted, false, "celebrity passport coverage is not a document-system story");
assert.equal(assessDefaultFeedRelevance(banknoteIllustration).accepted, false, "stored banknote labels cannot approve an illustration/related-link story");
assert.equal(assessDefaultFeedRelevance({
  title: "Benin: young man arrested in Nikki with counterfeit banknotes - Bénin Web TV",
  contentSnippet: "Police seized counterfeit notes from an individual.",
}).accepted, false, "individual counterfeit arrests are not organised anti-counterfeit operations");
assert.equal(assessDefaultFeedRelevance({
  title: "Paper Currency Guide: US Banknotes & Values - US Coin Shows",
  contentSnippet: "A collector guide to note values.",
}).accepted, false, "collector banknote guides are not issuance events");
assert.equal(assessDefaultFeedRelevance({
  title: "Kirgistan – moneta kolekcjonerska",
  contentSnippet: "Collector coin listing.",
  domains: ["banknotes"],
}).accepted, false, "collector coins remain rejected");
assert.equal(assessDefaultFeedRelevance({
  title: "New look, same Cedi! Ghana's redesigned banknotes are here, but what's behind the ... - Instagram",
  contentSnippet: "Instagram presentation of the redesigned notes.",
}).accepted, false, "social banknote marketing is not source-of-record issuance");
assert.equal(assessDefaultFeedRelevance({
  title: "Brits utterly terrified as border issue threatens European travel and fears of £8K fines - The Mirror",
  contentSnippet: "Consumer travel fears about the new border rules.",
}, entryExitSystemFeed).accepted, false, "EES feed nomination cannot accept travel-consumer clickbait without an identity-system subject");
assert.equal(assessDefaultFeedRelevance({
  title: "Hasina's passport ploy puts BNP in a tight spot",
  contentSnippet: "Political dispute over a personal passport.",
  domains: ["identity_documents"],
  classifications: ["passports"],
}).accepted, false, "political personal passport coverage is not a document-system event");
assert.equal(assessDefaultFeedRelevance({
  title: "UK names people who must apply for new passports from the beginning",
  contentSnippet: "Consumer guidance for passport applicants.",
}).accepted, false, "consumer passport application guidance is not a system event");
assert.equal(assessDefaultFeedRelevance({
  title: "Mirra Andreeva has a plan for her potential new car despite not having a driving licence",
  contentSnippet: "The tennis star discussed a future car.",
}, driverLicenceFeed).accepted, false, "driver-licence feed nomination cannot accept incidental celebrity coverage");
assert.equal(assessDefaultFeedRelevance({
  title: "Coinone Warns of Identity Theft After Support Breach | The Defiant",
  contentSnippet: "The report incidentally lists identity-document issuance dates.",
}, identityDocumentFeed).accepted, false, "identity-document feed nomination cannot accept incidental breach coverage");

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
  title: "Central bank dismantles counterfeit banknote ring in national operation",
  contentSnippet: "The organised anti-counterfeit operation targets a distribution network.",
}).accepted, true, "organised counterfeit operations remain visible when the title and concrete event are present");
assert.equal(assessDefaultFeedRelevance({
  title: "State launches digital driver licence issuance system",
  contentSnippet: "The authority rolls out the new document platform under an interoperability standard.",
}, driverLicenceFeed).accepted, true, "concrete driver-licence issuance system rollouts remain visible");
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

const collectorCoin = {
  id: "collector-coin",
  feedId: "banknotes-feed",
  title: "Kirgistan – moneta kolekcjonerska",
  contentSnippet: "Collector coin listing.",
  domains: ["banknotes"],
};
const kinegram = {
  id: "kinegram",
  feedId: "identity-feed",
  title: "Kinegram releases mobile identity verification for secure onboarding",
  contentSnippet: "The product release deploys document verification for issuers.",
};
const euUkBorderBiometric = {
  id: "eu-uk-biometric",
  feedId: "biometrics-feed",
  title: "EU–UK Border Breakthrough Could Transform Channel Tunnel Travel as Brussels Tests Drive-Through Biometrics - EU Today",
  contentSnippet: "EU–UK Border Breakthrough Could Transform Channel Tunnel Travel as Brussels Tests Drive-Through Biometrics EU Today",
  domains: ["digital_identity_biometrics"],
  classifications: ["biometrics"],
};
let normalDefaultAssessmentCalls = 0;
const normalDefaultStream = filterDefaultFeedRelevanceBeforeGrouping(
  [collectorCoin, kinegram, euUkBorderBiometric],
  {
    hasProfile: false,
    hasExplicitFeedOrSource: false,
    resolveFeed: (article) => ({ id: article.feedId, name: article.feedId }),
    assess: (article, feed) => {
      normalDefaultAssessmentCalls += 1;
      return assessDefaultFeedRelevance(article, feed);
    },
  }
);
assert.deepEqual(
  normalDefaultStream.map((article) => article.id),
  ["kinegram", "eu-uk-biometric"],
  "the normal no-profile stream removes the rejected collector article before grouping while retaining observed accepted cards"
);
assert.equal(normalDefaultAssessmentCalls, 3, "the normal default stream assesses each candidate exactly once before grouping");
assert.deepEqual(
  filterDefaultFeedRelevanceBeforeGrouping([collectorCoin], {
    hasProfile: true,
    hasExplicitFeedOrSource: false,
  }).map((article) => article.id),
  ["collector-coin"],
  "profile streams retain their relevance-policy bypass"
);
assert.deepEqual(
  filterDefaultFeedRelevanceBeforeGrouping([collectorCoin], {
    hasProfile: false,
    hasExplicitFeedOrSource: true,
  }).map((article) => article.id),
  ["collector-coin"],
  "explicit feed streams retain their relevance-policy bypass"
);
assert.match(
  appSource,
  /filterDefaultFeedRelevanceForCurrentStream\([\s\S]*?getVisibleArticles\([\s\S]*?\)[\s\S]*?prepareDateFirstGroupedArticles\(visibleArticles\)/,
  "the normal global stream applies default relevance before grouping"
);
assert.match(
  appSource,
  /defaultFeedRelevantBackendArticles[\s\S]*?sortArticlesForCurrentDashboardMode\(defaultFeedRelevantBackendArticles\)[\s\S]*?prepareDateFirstGroupedArticles\(filteredRawArticles\)/,
  "the backend candidate path applies default relevance before grouping"
);
const defaultStreamScopeSource = appSource.match(
  /function filterDefaultFeedRelevanceForCurrentStream\([\s\S]*?\n}\n\nfunction articleMatchesFilters/
)?.[0] || "";
assert.doesNotMatch(
  defaultStreamScopeSource,
  /state\.dashboardMode !== "normal"/,
  "an internal non-normal dashboard mode alone does not bypass default-stream relevance"
);
assert.match(
  defaultStreamScopeSource,
  /state\.dashboardMode === "usa" \|\| state\.dashboardMode === "canada"/,
  "only explicit DMV dashboard modes bypass default-stream relevance"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 32 })}\n`);
