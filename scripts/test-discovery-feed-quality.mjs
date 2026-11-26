import assert from "node:assert/strict";
import { classifyArticleForIngest } from "../backend/src/services/articleClassificationService.js";
import { assessDiscoveryFeedQuality } from "../backend/src/services/discoveryFeedQualityService.js";

function classify(feedName, title, contentSnippet = "") {
  return {
    title,
    contentSnippet,
    source: "Google Alerts",
    feedName,
    ...classifyArticleForIngest({ title, contentSnippet, source: "Google Alerts", feedName }),
  };
}

function assess(feedName, title, contentSnippet = "") {
  return assessDiscoveryFeedQuality(
    { name: feedName, rssUrl: "https://www.google.com/alerts/feeds/test" },
    classify(feedName, title, contentSnippet),
  );
}

for (const title of [
  "Hulpdiensten naar ongeval ... Drimble",
  "Brandweer met hoge urgentie naar Veenhuizen",
]) {
  const article = classify("OVD", title);
  assert.deepEqual(article.classifications, [], `${title}: no classifier label`);
  assert.deepEqual(article.domains, [], `${title}: no classifier domain`);
  const result = assess("OVD", title);
  assert.equal(result.accepted, false, title);
  assert.equal(result.reason, "ovd_missing_document_security_context");
}
assert.equal(assess("OVD", "New OVD for passport document security", "Holographic anti-counterfeit device.").accepted, true);
assert.equal(assess("OVD", "OVD 112 incident response update").accepted, false, "operational OVD noise must not pass");

for (const title of [
  "24 Ellesmere Rd House for Rent with security screens",
  "Google DeepMind Uses AI to Verify Security of Signal Messaging",
  "NSFW AI Chatbots: Security Features and Data Policies",
  "Advantech announces Security Compliance Support",
  "AMD launches tamper-resistant Versal chips",
  "NordVPN launches a new feature",
]) {
  assert.equal(assess("Security Features", title).accepted, false, title);
}
assert.equal(assess("Security Features", "Bank of Ghana unveils Heritage Series Cedi banknotes with enhanced security features").accepted, true);
assert.equal(
  assess("Security Features", "Bank of Ghana unveils Heritage Series Cedi banknotes", "Enhanced anti-counterfeit security features." ).accepted,
  true,
  "historical Security Features decisions must use local text rather than stored classifications"
);
assert.equal(
  assess("Security Features", "Cybersecurity provider launches phishing-resistant authentication for digital identity verification", "The platform verifies a user's identity with passkeys and multi-factor authentication.").accepted,
  true,
  "identity-authentication cybersecurity with concrete verification evidence must pass"
);
assert.equal(
  assess("Security Features", "State unveils redesigned driver licences", "The new driver licences add laser engraving and tactile features to deter counterfeiting.").accepted,
  true,
  "driver-licence lifecycle and security evidence must co-occur"
);
assert.equal(
  assess("Security Features", "ESET Mobile Security adds a new feature", "Cybersecurity protection for Android devices.").accepted,
  false,
  "generic mobile cybersecurity must not pass"
);
assert.equal(
  assess("Security Features", "Counterfeit goods seized at market", "Officials are investigating the case.").accepted,
  false,
  "generic counterfeit context must not pass"
);
assert.equal(
  assess("Security Features", "Police seize counterfeit passports at border").accepted,
  false,
  "a counterfeit-document seizure without lifecycle and concrete security evidence must not pass"
);
assert.equal(
  assess("Security Features", "Counterfeit banknotes seized at market").accepted,
  false,
  "a counterfeit-banknote seizure without feature, design, issuance, or production context must not pass"
);
assert.equal(
  assess("Security Features", "Banknotes and the future of cash").accepted,
  false,
  "banknote commentary must not pass as a concrete security feature event"
);
assert.equal(
  assess("Security Features", "University celebrates graduates", "Photos show students holding degree certificates.").accepted,
  false,
  "degree certificates and photos alone must not pass"
);

for (const title of [
  "Dollar near 19-month high as markets react, banknotes pictured",
  "From Costa Rica to the Maldives: 5 banknotes that are works of art",
  "Keynes quote on X mentions banknotes",
]) {
  assert.equal(assess("banknotes", title).accepted, false, title);
}
assert.equal(assess("banknotes", "Central bank unveils new banknote design with hologram security features").accepted, true);
assert.equal(assess("banknotes", "CBC invites public to take part in ECB survey on future euro banknotes").accepted, true);
assert.equal(assess("banknotes", "BSP eyes self-reliant banknote production").accepted, true);
assert.equal(assess("banknotes", "NRB starts circulating new 500 banknotes after 5 years").accepted, true);

assert.equal(assess("passports", "Singapore barred Alice Huang after a dispute where her passport was mentioned").accepted, false);
assert.equal(assess("passports", "Sri Lankan Woman arrested with forged Indian Passport at border").accepted, true);
assert.equal(assess("passports", "Illegal Alien Charged with False Use of a Passport").accepted, true);
assert.equal(assess("passports", "AI Passport project to be reviewed").accepted, true);
assert.equal(assess("passports", "Maritime logistics passport booking platform expands").accepted, false);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 29 })}\n`);
