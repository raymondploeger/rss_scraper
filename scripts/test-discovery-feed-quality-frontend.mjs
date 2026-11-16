import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assessDiscoveryFeedQuality,
  shouldApplyDiscoveryFeedQualityGate,
} from "../frontend/public/discovery-feed-quality-policy.js";

const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");
const feed = { name: "Security Features", rssUrl: "https://www.google.com/alerts/feeds/test" };
const historicalNoise = {
  title: "ESET Mobile Security adds a new feature",
  contentSnippet: "Cybersecurity protection for Android devices.",
  domains: ["security_printing"],
  classifications: ["security_features"],
};
const ghana = {
  title: "Bank of Ghana unveils Heritage Series Cedi banknotes",
  contentSnippet: "The new notes add anti-counterfeit security features.",
};
const forgedPassport = {
  title: "Traveller arrested with forged passport at border",
  contentSnippet: "Border officers found a false travel document.",
};

assert.equal(assessDiscoveryFeedQuality(feed, historicalNoise).accepted, false, "stored historical labels cannot rescue cybersecurity noise");
assert.equal(assessDiscoveryFeedQuality(feed, ghana).accepted, true);
assert.equal(assessDiscoveryFeedQuality({ ...feed, name: "passports" }, forgedPassport).accepted, true);
const banknoteFeed = { ...feed, name: "banknotes" };
assert.equal(assessDiscoveryFeedQuality(banknoteFeed, {
  title: "Cape Verde President wins second term - Reuters",
  contentSnippet: "Bank of Ghana unveils new Heritage Series banknotes. Illustration shows dollar banknotes.",
}).accepted, false, "Reuters related-links noise must not be visible");
assert.equal(assessDiscoveryFeedQuality(banknoteFeed, {
  title: "Dollar climbs as markets react, banknotes pictured",
  contentSnippet: "The economy remains volatile.",
}).accepted, false, "economic illustration noise must not be visible");
assert.equal(assessDiscoveryFeedQuality(banknoteFeed, {
  title: "Five banknotes that are works of art",
  contentSnippet: "A collector's social-media collection.",
}).accepted, false, "collection/social noise must not be visible");
assert.equal(shouldApplyDiscoveryFeedQualityGate({ hasProfile: false, hasExplicitFeedOrSource: false }), true);
assert.equal(shouldApplyDiscoveryFeedQualityGate({ hasProfile: true, hasExplicitFeedOrSource: false }), false, "profiles retain their current semantics");
assert.equal(shouldApplyDiscoveryFeedQualityGate({ hasProfile: false, hasExplicitFeedOrSource: true }), false, "selected feeds retain their current semantics");
assert.match(appSource, /shouldApplyDiscoveryFeedQualityGate\(/, "default frontend flow must invoke the shared scope gate");
assert.match(appSource, /assessDiscoveryFeedQuality\(/, "default frontend flow must invoke the shared quality policy");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 11 })}\n`);
