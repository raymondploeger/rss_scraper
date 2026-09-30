function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIdentityWeekArticle(article = {}) {
  try {
    return new URL(String(article.link || article.canonicalLink || "")).hostname
      .toLowerCase()
      .endsWith("identityweek.net");
  } catch {
    return false;
  }
}

const EVENT_PROMOTION_TERMS = [
  "speaker line up",
  "call for speakers",
  "join the",
  "conference",
  "keynote",
  "exhibitor",
  "sponsor",
  "stand ",
];

const IDENTITY_VERIFICATION_FOCUS_TERMS = [
  "identity verification",
  "document verification",
  "biometric verification",
  "authentication",
  "identity token",
  "identity assertion",
  "age verification",
  "age assurance",
  "identity fraud",
  "identity proofing",
  "liveness",
  "kyc",
  "onboarding",
  "biometric",
  "biometrics",
];

export function evaluateIdentityWeekIdentityVerificationQualityDecision({
  article = {},
  active = false,
} = {}) {
  if (!active || !isIdentityWeekArticle(article)) {
    return { applies: false, passed: true, reason: "identity_week_quality_not_applicable" };
  }

  const title = normalizeText(article.title);
  const content = normalizeText([
    article.title,
    article.summary,
    article.summaryShort,
    article.contentSnippet,
    article.description,
  ].filter(Boolean).join(" "));
  const matchedEventPromotionTerms = EVENT_PROMOTION_TERMS.filter((term) => title.includes(term));
  const matchedVerificationFocusTerms = IDENTITY_VERIFICATION_FOCUS_TERMS.filter((term) => content.includes(term));
  const genericCorporateInterview = title.includes("jp morgan") || title.includes("speaks out");

  if (matchedEventPromotionTerms.length || genericCorporateInterview) {
    return {
      applies: true,
      passed: false,
      reason: "identity_week_event_or_generic_corporate_noise",
      matchedEventPromotionTerms,
      matchedVerificationFocusTerms,
    };
  }

  if (!matchedVerificationFocusTerms.length) {
    return {
      applies: true,
      passed: false,
      reason: "identity_week_missing_verification_focus",
      matchedEventPromotionTerms,
      matchedVerificationFocusTerms,
    };
  }

  return {
    applies: true,
    passed: true,
    reason: "identity_week_verification_focus",
    matchedEventPromotionTerms,
    matchedVerificationFocusTerms,
  };
}
