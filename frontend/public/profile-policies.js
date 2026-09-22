export const PROFILE_POLICY_VERSION = 1;

const DEFINITIONS = {
  central_bank: {
    label: "Central Bank",
    domains: ["banknotes"],
    requiredEvidence: ["physical_banknote", "banknote_event"],
    preferredEvidence: ["central_bank_source", "issuance", "redesign", "withdrawal", "counterfeiting"],
    excludedEvidence: ["forex_market", "interest_rate_only", "collector_only", "cbdc_without_physical_banknote"],
  },
  passport_authority: {
    label: "Identity Document Authority",
    domains: ["identity_documents"],
    requiredEvidence: ["identity_document_type", "document_lifecycle_or_security"],
    preferredEvidence: ["official_authority", "issuance", "renewal", "fraud", "security_upgrade"],
    excludedEvidence: ["general_government_news", "travel_advice_only", "consumer_application_help_only"],
  },
  border_control: {
    label: "Border Control",
    domains: ["identity_documents"],
    requiredEvidence: ["border_operation_or_system", "travel_document_or_identity_check"],
    preferredEvidence: ["official_border_authority", "ees", "etias", "icao", "document_inspection"],
    excludedEvidence: ["travel_queue_only", "tourism_advice", "generic_migration_politics"],
  },
  security_printer: {
    label: "Security Printer",
    domains: ["banknotes", "identity_documents", "security_printing"],
    requiredEvidence: ["security_printing_technology_or_material"],
    preferredEvidence: ["production", "substrate", "ink", "holography", "personalization"],
    excludedEvidence: ["generic_printing", "office_printing", "unrelated_manufacturing"],
  },
  vendors: {
    label: "Vendors",
    domains: ["banknotes", "identity_documents", "digital_identity_biometrics", "security_printing"],
    requiredEvidence: ["industry_vendor", "professional_product_event"],
    preferredEvidence: ["product_launch", "contract", "partnership", "deployment", "research"],
    excludedEvidence: ["generic_corporate_news", "careers", "events_without_product_context"],
  },
  identity_verification: {
    label: "Identity Verification",
    domains: ["digital_identity_biometrics"],
    requiredEvidence: ["identity_verification_or_authentication"],
    preferredEvidence: ["biometrics", "authentication", "age_assurance", "standards", "fraud_prevention"],
    excludedEvidence: ["generic_identity_language", "brand_identity", "unrelated_ai"],
  },
  researcher: {
    label: "Industry Research",
    domains: ["banknotes", "identity_documents", "digital_identity_biometrics", "security_printing"],
    requiredEvidence: ["industry_domain", "professional_intelligence_event"],
    preferredEvidence: ["research", "policy", "market_change", "technology", "fraud"],
    excludedEvidence: ["consumer_only", "navigation_page", "generic_company_content"],
  },
};

function freezeDefinition(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeDefinition);
  return Object.freeze(value);
}

export const PROFILE_POLICY_DEFINITIONS = freezeDefinition(
  Object.fromEntries(Object.entries(DEFINITIONS).map(([id, definition]) => [
    id,
    {
      id,
      version: PROFILE_POLICY_VERSION,
      ...definition,
    },
  ]))
);

export function getProfilePolicyDefinition(profileId) {
  return PROFILE_POLICY_DEFINITIONS[String(profileId || "").trim()] || null;
}

const CONTENT_EVIDENCE_RULES = freezeDefinition({
  central_bank: {
    anchors: ["banknote", "bank note", "currency note", "counterfeit currency", "counterfeit deterrence"],
    events: ["unveil", "launch", "issue", "new ", "design", "withdraw", "counterfeit", "security", "polymer"],
  },
  passport_authority: {
    anchors: ["passport", "identity card", "id card", "driver license", "driver's license", "driving licence", "residence permit", "visa", "mobile driver license", "mobile driving licence", "mdl"],
    events: ["renew", "issu", "launch", "standard", "guideline", "security", "fraud", "digital", "biometric", "requirement", "trust service", "implementation", "joins"],
  },
  border_control: {
    anchors: ["border", "frontex", "customs", "migration"],
    events: ["crossing", "operation", "smuggling", "trafficking", "arrest", "seized", "surveillance", "coordination", "document inspection", "identity check"],
  },
  security_printer: {
    anchors: ["security print", "banknote", "passport", "identity document", "secure document"],
    events: ["substrate", "ink", "hologram", "holograph", "personalization", "personalisation", "production", "manufactur", "technology"],
  },
  vendors: {
    anchors: ["identity", "biometric", "authentication", "banknote", "passport", "security print", "credential"],
    events: ["launch", "contract", "partner", "deploy", "research", "platform", "solution", "product", "technology"],
  },
  identity_verification: {
    anchors: ["openid", "identity verification", "digital id", "digital identity", "authentication", "age assurance", "biometric", "credential"],
    events: ["standard", "specification", "act", "review", "consultation", "launch", "deploy", "fraud", "post-quantum", "recommendation"],
  },
  researcher: {
    anchors: ["banknote", "passport", "identity document", "digital identity", "biometric", "security print", "authentication"],
    events: ["research", "report", "study", "policy", "market", "technology", "fraud", "standard", "regulation"],
  },
});

function normalizeEvidenceText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getArticleContentText(article) {
  return normalizeEvidenceText([
    article?.title,
    article?.description,
    article?.summary,
    article?.content,
    article?.topic,
    ...(Array.isArray(article?.tags) ? article.tags : []),
  ].filter(Boolean).join(" "));
}

function matchingTerms(text, terms = []) {
  return terms.filter((term) => text.includes(normalizeEvidenceText(term)));
}

export function evaluateProfilePolicyEvidence(article, profileId) {
  const policy = getProfilePolicyDefinition(profileId);
  const rules = CONTENT_EVIDENCE_RULES[String(profileId || "").trim()];
  if (!policy || !rules) {
    return Object.freeze({ applies: false, passed: false, profileId: String(profileId || "") });
  }

  const contentText = getArticleContentText(article);
  const matchedAnchors = matchingTerms(contentText, rules.anchors);
  const matchedEvents = matchingTerms(contentText, rules.events);
  const passed = matchedAnchors.length > 0 && matchedEvents.length > 0;

  return Object.freeze({
    applies: true,
    passed,
    profileId: policy.id,
    policyVersion: policy.version,
    reason: passed ? "explicit_profile_policy_content_match" : "explicit_profile_policy_content_missing",
    matchedAnchors: Object.freeze(matchedAnchors.slice(0, 10)),
    matchedEvents: Object.freeze(matchedEvents.slice(0, 10)),
  });
}
