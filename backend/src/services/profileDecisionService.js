import { resolveFeedProfileAffinities } from "./feedProfileAffinityService.js";

// One backend-owned contract for profile eligibility.  A feed can be relevant
// to several profiles, but an article must also carry a stored classifier
// signal for that specific profile.
export const PROFILE_MODEL = Object.freeze({
  central_bank: { domains: ["banknotes"] },
  passport_authority: { domains: ["identity_documents"] },
  border_control: { domains: ["identity_documents"] },
  security_printer: { domains: ["banknotes", "identity_documents", "security_printing"] },
  identity_verification: { domains: ["digital_identity_biometrics"] },
  vendors: { domains: ["banknotes", "identity_documents", "digital_identity_biometrics", "security_printing"] },
  researcher: { domains: ["banknotes", "identity_documents", "digital_identity_biometrics", "security_printing"] },
});

const VENDOR_NOISE_PATTERNS = [
  /\b(?:career|careers|vacanc(?:y|ies)|job|jobs)\b/i,
  /\b(?:contact us|privacy policy|cookie policy|login|sign up)\b/i,
  /\b(?:tutorial|how to|step-by-step|setup guide|developer guide|api tutorial|sdk integration)\b/i,
  /\b(?:linkedin|banknote catalog|collector banknote|auction|for sale)\b/i,
];

function list(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

export function getArticleProfileDecision(article = {}, feed = {}, profileId = "") {
  const profile = PROFILE_MODEL[profileId];
  if (!profile) return { profileId, matched: false, reason: "unsupported_profile" };
  const affinities = resolveFeedProfileAffinities(feed);
  if (!affinities.includes(profileId)) {
    return { profileId, matched: false, reason: "source_not_affiliated" };
  }
  const signals = list(article.profileSignals);
  const domains = list(article.domains);
  const classifications = list(article.classifications);
  const text = [article.title, article.contentSnippet, article.summary, article.source].filter(Boolean).join(" ");
  if (profileId === "vendors") {
    if (VENDOR_NOISE_PATTERNS.some((pattern) => pattern.test(text))) {
      return { profileId, matched: false, reason: "vendor_quality_filter_rejected" };
    }
    if (!domains.some((domain) => profile.domains.includes(domain)) || !classifications.length) {
      return { profileId, matched: false, reason: "article_industry_evidence_missing" };
    }
    return { profileId, matched: true, reason: "source_affinity_and_industry_evidence" };
  }
  if (profileId === "researcher") {
    if (!domains.some((domain) => profile.domains.includes(domain)) || !classifications.length) {
      return { profileId, matched: false, reason: "article_industry_evidence_missing" };
    }
    return { profileId, matched: true, reason: "source_affinity_and_industry_evidence" };
  }
  if (!signals.includes(profileId)) {
    return { profileId, matched: false, reason: "article_signal_missing" };
  }
  if (!domains.some((domain) => profile.domains.includes(domain))) {
    return { profileId, matched: false, reason: "profile_domain_missing" };
  }
  return { profileId, matched: true, reason: "source_affinity_and_article_evidence" };
}

export function getArticleProfileDecisions(article = {}, feed = {}) {
  return Object.keys(PROFILE_MODEL).map((profileId) => getArticleProfileDecision(article, feed, profileId));
}
