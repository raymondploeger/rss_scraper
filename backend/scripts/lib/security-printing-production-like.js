function normalizeKeyword(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textMatchesKeyword(text, keyword) {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return false;
  }

  const escapedKeyword = escapeRegExp(normalizedKeyword);
  const pattern = /^[a-z0-9\s-]+$/i.test(normalizedKeyword)
    ? new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, "i")
    : new RegExp(escapedKeyword, "i");
  return pattern.test(text);
}

function countMatches(text, keywords = []) {
  return keywords.filter((keyword) => textMatchesKeyword(text, keyword)).length;
}

function matchedKeywords(text, keywords = []) {
  return keywords.filter((keyword) => textMatchesKeyword(text, keyword));
}

function getHostname(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function inferTopicTypeFromTopic(topic) {
  const normalizedTopic = normalizeKeyword(topic);
  if (normalizedTopic === "banknotes" || normalizedTopic === "banknote") {
    return "banknote";
  }
  if (
    normalizedTopic === "identity documents"
    || normalizedTopic === "identity document"
    || normalizedTopic === "passports"
    || normalizedTopic === "passport"
    || normalizedTopic === "visas"
    || normalizedTopic === "visa"
    || normalizedTopic === "residence permits"
    || normalizedTopic === "residence permit"
    || normalizedTopic === "drivers licenses"
    || normalizedTopic === "driver's licenses"
    || normalizedTopic === "id cards"
  ) {
    return "identity_document";
  }
  if (normalizedTopic === "digital id" || normalizedTopic === "digital identity") {
    return "digital_identity";
  }
  return "";
}

function inferDomainFromTopic(topic) {
  const normalizedTopic = normalizeKeyword(topic);
  if (normalizedTopic === "banknotes" || normalizedTopic === "banknote") {
    return "banknote";
  }
  if (normalizedTopic === "digital id" || normalizedTopic === "digital identity") {
    return "digital_identity";
  }
  return "";
}

export const SECURITY_PRINTING_DOMAIN_CONTEXT = {
  strong: [
    "security printing",
    "security inks",
    "micro optics",
    "holography",
    "ovd",
    "intaglio",
    "anti-counterfeit",
    "secure documents",
    "personalization",
  ],
  weak: ["document security", "secure print", "specialty ink"],
  excluded: ["wallet onboarding", "digital identity platform"],
};

export const SECURITY_PRINTING_TOP_LEVEL_STRONG_SIGNALS = [
  "security feature",
  "security features",
  "security thread",
  "security threads",
  "banknote security",
  "banknote security feature",
  "banknote security features",
  "hologram",
  "holograms",
];

export const SECURITY_PRINTING_TOP_LEVEL_MEDIUM_SIGNALS = [
  "document security",
  "security foil",
  "holographic foil",
  "optical security feature",
  "optical security device",
];

export const SECURITY_PRINTING_TOP_LEVEL_SUPPORT_TERMS = [
  "banknote",
  "banknotes",
  "currency",
  "note",
  "passport",
  "passports",
  "id card",
  "identity card",
  "travel document",
  "secure document",
  "secure documents",
  "security document",
  "document protection",
  "document security",
  "credential",
  "credentials",
  "document authentication",
  "document printing",
  "security printing",
  "security printer",
  "printing works",
  "banknote printing",
  "residence permit",
  "visa sticker",
];

export const SECURITY_PRINTING_TOP_LEVEL_NEGATIVE_TECH_TERMS = [
  "windows security feature",
  "browser security feature",
  "cloud security feature",
  "app security feature",
  "software security feature",
  "phone security feature",
  "pc security feature",
  "cybersecurity feature",
  "microsoft",
  "apple",
  "android",
  "iphone",
  "browser update",
  "software update",
  "operating system",
];

export function buildSecurityPrintingContext(article) {
  const sourceText = [article.source, article.feedName].filter(Boolean).join(" ").toLowerCase();
  const domainText = [getHostname(article.link), getHostname(article.canonicalLink)].filter(Boolean).join(" ").toLowerCase();
  const normalizedTopic = normalizeKeyword(article.topic);
  const inferredTopicType = inferTopicTypeFromTopic(normalizedTopic);
  const inferredDomain = inferDomainFromTopic(normalizedTopic);

  return {
    titleText: [article.title].filter(Boolean).join(" ").toLowerCase(),
    tagText: [article.keywords].filter(Boolean).join(" ").toLowerCase(),
    metadataText: [article.topic, sourceText].filter(Boolean).join(" ").toLowerCase(),
    bodyText: [article.summary, article.summaryShort, article.contentSnippet].filter(Boolean).join(" ").toLowerCase(),
    sourceText,
    domainText,
    topic: normalizedTopic,
    topicType: String(article.topicType || inferredTopicType || ""),
    domain: String(article.domain || inferredDomain || ""),
  };
}

export function getLegacySecurityPrintingDomainProfile(context) {
  const strongTitleHits = countMatches(context.titleText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong);
  const strongTagHits = countMatches(context.tagText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong);
  const strongMetaHits = countMatches(context.metadataText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong);
  const strongBodyHits = countMatches(context.bodyText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong);
  const weakTitleHits = countMatches(context.titleText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak);
  const weakTagHits = countMatches(context.tagText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak);
  const weakMetaHits = countMatches(context.metadataText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak);
  const weakBodyHits = countMatches(context.bodyText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak);
  const excludedHits =
    countMatches(context.titleText, SECURITY_PRINTING_DOMAIN_CONTEXT.excluded) +
    countMatches(context.tagText, SECURITY_PRINTING_DOMAIN_CONTEXT.excluded) +
    countMatches(context.metadataText, SECURITY_PRINTING_DOMAIN_CONTEXT.excluded);

  let score =
    (strongTitleHits * 5) +
    (strongTagHits * 4) +
    (strongMetaHits * 3.5) +
    (strongBodyHits * 1.25) +
    (weakTitleHits * 2) +
    (weakTagHits * 1.5) +
    (weakMetaHits * 1.25) +
    (weakBodyHits * 0.35);

  if (context.domain === "banknote" || context.topicType === "identity_document") {
    score += 4;
  }

  const currentMatched = [
    ...matchedKeywords(context.titleText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong),
    ...matchedKeywords(context.tagText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong),
    ...matchedKeywords(context.metadataText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong),
    ...matchedKeywords(context.bodyText, SECURITY_PRINTING_DOMAIN_CONTEXT.strong),
    ...matchedKeywords(context.titleText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak),
    ...matchedKeywords(context.tagText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak),
    ...matchedKeywords(context.metadataText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak),
    ...matchedKeywords(context.bodyText, SECURITY_PRINTING_DOMAIN_CONTEXT.weak),
  ];

  return {
    score,
    excludedHits,
    currentMatched: Array.from(new Set(currentMatched)),
  };
}

export function getSecurityPrintingTopLevelAdjustment(context) {
  const haystack = [
    context.titleText,
    context.tagText,
    context.metadataText,
    context.bodyText,
    context.sourceText,
    context.domainText,
  ]
    .filter(Boolean)
    .join(" ");

  const matchedStrongSignals = matchedKeywords(haystack, SECURITY_PRINTING_TOP_LEVEL_STRONG_SIGNALS);
  const matchedMediumSignals = matchedKeywords(haystack, SECURITY_PRINTING_TOP_LEVEL_MEDIUM_SIGNALS);
  const matchedSupportTerms = matchedKeywords(haystack, SECURITY_PRINTING_TOP_LEVEL_SUPPORT_TERMS);
  const matchedNegativeTerms = matchedKeywords(haystack, SECURITY_PRINTING_TOP_LEVEL_NEGATIVE_TECH_TERMS);

  let bonus = 0;

  if (matchedStrongSignals.length && matchedSupportTerms.length) {
    bonus += 6 + (matchedStrongSignals.length * 4);
  }
  if (matchedMediumSignals.length && matchedSupportTerms.length) {
    bonus += 3 + (matchedMediumSignals.length * 3);
  }
  if ((matchedStrongSignals.length + matchedMediumSignals.length) >= 2 && matchedSupportTerms.length) {
    bonus += 5;
  }
  if (matchedSupportTerms.length >= 2 && (matchedStrongSignals.length || matchedMediumSignals.length)) {
    bonus += 4;
  }
  if (matchedNegativeTerms.length) {
    bonus -= matchedSupportTerms.length ? 6 : 14;
  }

  return {
    bonus,
    matchedStrongSignals,
    matchedMediumSignals,
    matchedSupportTerms,
    matchedNegativeTerms,
  };
}

export function getSecurityPrintingProductionLikeAssessment(article) {
  const context = buildSecurityPrintingContext(article);
  const legacy = getLegacySecurityPrintingDomainProfile(context);
  const adjustment =
    context.domain === "banknote" || context.topicType === "identity_document"
      ? getSecurityPrintingTopLevelAdjustment(context)
      : {
          bonus: 0,
          matchedStrongSignals: [],
          matchedMediumSignals: [],
          matchedSupportTerms: [],
          matchedNegativeTerms: [],
        };

  const productionScore = Math.round(legacy.score + adjustment.bonus);

  return {
    context,
    legacyScore: Math.round(legacy.score),
    productionScore,
    excludedHits: legacy.excludedHits,
    currentMatched: legacy.currentMatched,
    adjustment,
    productionMatched: Array.from(new Set([
      ...legacy.currentMatched,
      ...adjustment.matchedStrongSignals,
      ...adjustment.matchedMediumSignals,
    ])),
    includedLegacy: Math.round(legacy.score) >= 7,
    includedProduction: productionScore >= 7,
  };
}

export {
  countMatches,
  getHostname,
  matchedKeywords,
  normalizeKeyword,
  textMatchesKeyword,
};
