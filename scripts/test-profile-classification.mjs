import assert from "node:assert/strict";
import { classifyArticleForIngest } from "../backend/src/services/articleClassificationService.js";
import { evaluateProfilePolicyEvidence } from "../frontend/public/profile-policies.js";

function assertIncludes(values, expected, label) {
  assert.ok(values.includes(expected), `${label}: expected ${expected}, got ${JSON.stringify(values)}`);
}

const secunetBorderArticle = classifyArticleForIngest({
  title: "Czech Border Police: secunet technology significantly speeds up processes after EES introduction",
  contentSnippet: "The Entry/Exit System supports border checks and traveller processing.",
  topic: "Digital Identity & Biometrics",
  source: "secunet.com",
  feedName: "secunet Press",
});
assert.equal(secunetBorderArticle.topic, "Identity Documents");
assertIncludes(secunetBorderArticle.domains, "identity_documents", "secunet domain");
assertIncludes(secunetBorderArticle.profileSignals, "border_control", "secunet profile signal");

const germanBorderArticle = classifyArticleForIngest({
  title: "Grenzpolizei beschleunigt Prozesse nach Einführung des Einreise-Ausreise-Systems",
  contentSnippet: "Reisedokumentenkontrolle an der Grenze.",
  topic: "Digital Identity & Biometrics",
  source: "secunet.com",
  feedName: "secunet Press",
});
assert.equal(germanBorderArticle.topic, "Identity Documents");
assertIncludes(germanBorderArticle.profileSignals, "border_control", "German border profile signal");

const nonBorderDigitalIdentityArticle = classifyArticleForIngest({
  title: "Government-backed eID verification supports regulated onboarding",
  contentSnippet: "The publisher navigation also mentions immigration services.",
  topic: "Digital Identity & Biometrics",
  source: "identityweek.net",
  feedName: "Identity Week Press Releases",
});
assert.ok(!nonBorderDigitalIdentityArticle.profileSignals.includes("border_control"));

const ofsBanknotePortrait = classifyArticleForIngest({
  title: "Can AI persuasively enhance a banknote portrait?",
  contentSnippet: "The method explores 3D intaglio workflows within banknote design and production.",
  topic: "Digital Identity & Biometrics",
  source: "ofs.ch",
  feedName: "OFS Security Printing Insights",
});
assertIncludes(ofsBanknotePortrait.domains, "banknotes", "OFS banknote domain");
assert.equal(ofsBanknotePortrait.topic, "Banknotes");
assert.ok(!ofsBanknotePortrait.profileSignals.includes("border_control"));

const muehlbauerPostQuantum = classifyArticleForIngest({
  title: "SECURE POST-QUANTUM CRYPTOGRAPHY",
  contentSnippet: "A Passenger Terminal World article discusses seamless travel and cryptography.",
  topic: "Identity Documents",
  source: "muehlbauer.de",
  feedName: "Mühlbauer Press",
});
assert.ok(!muehlbauerPostQuantum.profileSignals.includes("border_control"));

const printingArticle = classifyArticleForIngest({
  title: "New holographic security feature for banknote substrates",
  contentSnippet: "The security printing material improves counterfeit deterrence.",
  topic: "Shared Security Printing",
  source: "security printer",
  feedName: "OFS Security Printing Insights",
});
assertIncludes(printingArticle.domains, "security_printing", "security printing domain");
assertIncludes(printingArticle.profileSignals, "security_printer", "security printer profile signal");

const borderPolicy = evaluateProfilePolicyEvidence({
  title: "EU Entry/Exit System goes live at Zurich Airport",
  tags: ["border control", "travel documents"],
}, "border_control");
assert.equal(borderPolicy.passed, true);

console.log("Profile classification regression checks passed.");
