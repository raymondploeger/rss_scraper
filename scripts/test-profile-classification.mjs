import assert from "node:assert/strict";
import { classifyArticleForIngest } from "../backend/src/services/articleClassificationService.js";
import { resolveFeedProfileAffinities } from "../backend/src/services/feedProfileAffinityService.js";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";
import { evaluateProfilePolicyEvidence } from "../frontend/public/profile-policies.js";

function assertIncludes(values, expected, label) {
  assert.ok(values.includes(expected), `${label}: expected ${expected}, got ${JSON.stringify(values)}`);
}

// Source affinities are candidate roles only. The classifier still requires
// article-level evidence before using one of these roles in a profile result.
const secunetAffinities = resolveFeedProfileAffinities({ name: "secunet Press" });
assertIncludes(secunetAffinities, "vendors", "secunet vendor affinity");
assertIncludes(secunetAffinities, "border_control", "secunet border affinity");
assertIncludes(secunetAffinities, "identity_verification", "secunet verification affinity");

const ofsAffinities = resolveFeedProfileAffinities({ name: "OFS Security Printing Insights" });
assertIncludes(ofsAffinities, "vendors", "OFS vendor affinity");
assertIncludes(ofsAffinities, "security_printer", "OFS printing affinity");
assertIncludes(ofsAffinities, "central_bank", "OFS central-bank affinity");

const identityWeekAffinities = resolveFeedProfileAffinities({ name: "Identity Week Press Releases" });
assertIncludes(identityWeekAffinities, "vendors", "Identity Week vendor affinity");
assertIncludes(identityWeekAffinities, "passport_authority", "Identity Week authority affinity");
assertIncludes(identityWeekAffinities, "identity_verification", "Identity Week verification affinity");

const juraAffinities = resolveFeedProfileAffinities({ name: "Jura Security Printing" });
assert.deepEqual(juraAffinities, ["vendors", "security_printer"]);

const topicAndGroupAffinities = resolveFeedProfileAffinities({
  name: "Test vendor feed",
  topic: "Shared Security Printing",
  sourceGroup: "Vendors",
});
assertIncludes(topicAndGroupAffinities, "vendors", "vendor group affinity");
assertIncludes(topicAndGroupAffinities, "security_printer", "topic affinity");

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

const frenchBorderArticle = classifyArticleForIngest({
  title: "La police aux frontières teste le système entrée/sortie",
  contentSnippet: "Le contrôle de documents accélère le traitement des voyageurs.",
  topic: "General",
  source: "official source",
});
assertIncludes(frenchBorderArticle.profileSignals, "border_control", "French border profile signal");

const spanishSecurePassportArticle = classifyArticleForIngest({
  title: "Nuevo pasaporte con tinta de seguridad y hologramas",
  contentSnippet: "El documento de viaje incorpora nuevas características de seguridad.",
  topic: "General",
  source: "Signe",
});
assertIncludes(spanishSecurePassportArticle.profileSignals, "passport_authority", "Spanish passport profile signal");
assertIncludes(spanishSecurePassportArticle.profileSignals, "security_printer", "Spanish security-printing profile signal");

const germanBanknoteArticle = classifyArticleForIngest({
  title: "Neue Banknoten mit Sicherheitsmerkmalen der Zentralbank",
  contentSnippet: "Der Sicherheitsdruck schützt die neuen Banknoten vor Fälschungen.",
  topic: "General",
  source: "official source",
});
assertIncludes(germanBanknoteArticle.profileSignals, "central_bank", "German banknote profile signal");
assertIncludes(germanBanknoteArticle.profileSignals, "security_printer", "German security-printing profile signal");

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

const aamvaDigitalTrustArticle = classifyArticleForIngest({
  title: "AAMVA Digital Trust Service Welcomes Kentucky",
  contentSnippet: "Kentucky joins the mobile driver license digital trust service.",
  topic: "Identity Documents",
  source: "AAMVA",
  feedName: "AAMVA News",
});
assertIncludes(aamvaDigitalTrustArticle.domains, "identity_documents", "AAMVA driver licence domain");
assertIncludes(aamvaDigitalTrustArticle.domains, "digital_identity_biometrics", "AAMVA digital trust domain");
assertIncludes(aamvaDigitalTrustArticle.profileSignals, "identity_verification", "AAMVA verification profile signal");

const europeanAgeVerificationArticle = classifyArticleForIngest({
  title: "Commission urges Member States to rollout EU age verification app",
  contentSnippet: "The service will work with European digital wallets.",
  topic: "Digital Identity & Biometrics",
  source: "European Commission",
  feedName: "European Commission Digital Identity News",
});
assertIncludes(europeanAgeVerificationArticle.domains, "digital_identity_biometrics", "EU age verification domain");
assertIncludes(europeanAgeVerificationArticle.profileSignals, "identity_verification", "EU age verification profile signal");

const bankOfCanadaArticle = classifyArticleForIngest({
  title: "Bank of Canada unveils new vertical $20 bank note",
  contentSnippet: "The note includes a new security feature.",
  topic: "Banknotes",
  source: "Bank of Canada",
  feedName: "Bank of Canada News",
});
assertIncludes(bankOfCanadaArticle.domains, "banknotes", "Bank of Canada banknote domain");
assertIncludes(bankOfCanadaArticle.profileSignals, "central_bank", "Bank of Canada profile signal");

const borderPolicy = evaluateProfilePolicyEvidence({
  title: "EU Entry/Exit System goes live at Zurich Airport",
  tags: ["border control", "travel documents"],
}, "border_control");
assert.equal(borderPolicy.passed, true);

const identityWeekFeed = {
  name: "Identity Week Press Releases",
  rssUrl: "https://identityweek.net/category/press-releases/feed/",
};
assert.equal(getSourceRelevanceAssessment(identityWeekFeed, {
  title: "Automated border control hardware base to grow almost 50% by 2035",
  contentSnippet: "Biometric enrolment pods and eGates support document checks at the border.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(identityWeekFeed, {
  title: "Bionomad: Live enrollments all show. Meet them on booth 626! #IDWA2026",
  contentSnippet: "Fingerprint, iris and face credentials are demonstrated at the show.",
}).accepted, false);
assert.equal(getSourceRelevanceAssessment(identityWeekFeed, {
  title: "California launches next phase of state cybersecurity plan as AI changes threat landscape",
  contentSnippet: "The strategy covers cyberattacks and incident response across government systems.",
}).accepted, false);

const biometricUpdateFeed = {
  name: "Biometric Update",
  rssUrl: "https://www.biometricupdate.com/feed",
};
assert.equal(getSourceRelevanceAssessment(biometricUpdateFeed, {
  title: "Indonesia seeks facial liveness technology for national digital ID",
  contentSnippet: "A market consultation focuses on biometric liveness detection.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(biometricUpdateFeed, {
  title: "Consumer trust in autonomous agents sinks following security incidents",
  contentSnippet: "A consumer survey considers AI agents and security guardrails.",
}).accepted, false);

const icaoDtcFeed = {
  name: "ICAO Digital Travel Credential",
  rssUrl: "https://news.google.com/rss/search?q=%22Digital%20Travel%20Credential%22",
};
assert.equal(getSourceRelevanceAssessment(icaoDtcFeed, {
  title: "Digital travel credentials to top 1.2B users by 2035",
  contentSnippet: "The ICAO DTC standard supports digital travel credentials.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(icaoDtcFeed, {
  title: "Major overhaul in air travel as airports adopt facial recognition",
  contentSnippet: "Airlines are changing check-in processes.",
}).accepted, false);
assert.equal(getSourceRelevanceAssessment(icaoDtcFeed, {
  title: "Digital travel credential pilot launches",
  contentSnippet: "The ICAO DTC pilot supports secure travel documents.",
  source: "bing.com",
}).accepted, false);
assert.equal(getSourceRelevanceAssessment(icaoDtcFeed, {
  title: "Digital travel credential pilot launches",
  contentSnippet: "The ICAO DTC pilot supports secure travel documents.",
  source: "Biometric Update",
}).accepted, true);

const ukviResidenceFeed = {
  name: "UKVI BRP and BRC Guidance",
  rssUrl: "https://www.gov.uk/search/news-and-communications?keywords=biometric+residence+permit",
};
assert.equal(getSourceRelevanceAssessment(ukviResidenceFeed, {
  title: "Visa holders should switch to an eVisa now",
  contentSnippet: "The eVisa replaces a biometric residence permit.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(ukviResidenceFeed, {
  title: "New measures to tackle student visa abuse",
  contentSnippet: "Government policy for higher education sponsors.",
}).accepted, false);

const frontexFeed = {
  name: "Frontex Newsroom",
  rssUrl: "https://www.frontex.europa.eu/media-centre/news/news-release/feed",
};
assert.equal(getSourceRelevanceAssessment(frontexFeed, {
  title: "Frontex supports border guards in detecting document fraud",
  contentSnippet: "The operation strengthens document inspection at external borders.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(frontexFeed, {
  title: "Multipurpose Maritime Exercise in the Western Black Sea",
  contentSnippet: "Coast guard partners took part in a maritime exercise.",
}).accepted, false);

const cbpFeed = {
  name: "CBP Newsroom",
  rssUrl: "https://www.cbp.gov/newsroom/media-releases/all",
};
assert.equal(getSourceRelevanceAssessment(cbpFeed, {
  title: "CBP processes 1 billion travelers with facial biometrics",
  contentSnippet: "The border agency verifies identity through facial biometrics.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(cbpFeed, {
  title: "Field Operations Academy seeks to maintain accreditation",
  contentSnippet: "The academy trains officers serving at ports of entry.",
}).accepted, false);

const aamvaFeed = {
  name: "AAMVA News",
  rssUrl: "https://www.aamva.org/publications-news/aamva-news",
};
assert.equal(getSourceRelevanceAssessment(aamvaFeed, {
  title: "AAMVA Digital Trust Service Welcomes Kentucky",
  contentSnippet: "Kentucky joins the mobile driver license digital trust service.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(aamvaFeed, {
  title: "New Episode of TaskForce 7 Podcast",
  contentSnippet: "AAMVA's identity management vice president hosts the latest podcast.",
}).accepted, false);

const irccFeed = {
  name: "IRCC Passport and Digital Identity News",
  rssUrl: "https://api.io.canada.ca/io-server/gc/news/en/v2",
};
assert.equal(getSourceRelevanceAssessment(irccFeed, {
  title: "Le renouvellement de passeport devient accessible en ligne",
  contentSnippet: "Le programme de passeport sécurisé simplifie les démarches.",
}).accepted, true);

const euLisaFeed = {
  name: "eu-LISA Updates",
  rssUrl: "https://www.eulisa.europa.eu/news-and-events",
};
assert.equal(getSourceRelevanceAssessment(euLisaFeed, {
  title: "eu-LISA advances Entry/Exit System interoperability",
  contentSnippet: "The EES supports biometric border management.",
}).accepted, true);
assert.equal(getSourceRelevanceAssessment(euLisaFeed, {
  title: "eu-LISA Industry Roundtable puts data management in focus",
  contentSnippet: "The Management Board discussed data management.",
}).accepted, false);

console.log("Profile classification regression checks passed.");
