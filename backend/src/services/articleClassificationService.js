const GENERIC_SOURCE_TOPICS = new Set([
  "general",
  "other",
  "producers",
  "vendor",
  "vendors",
  "news",
  "industry",
]);

const CLASSIFICATION_RULES = [
  {
    id: "banknotes",
    topic: "Banknotes",
    tags: ["banknotes"],
    domains: ["banknotes"],
    profileSignals: ["central_bank"],
    minScore: 1,
    sourceTerms: ["banknotenews", "notafilia"],
    terms: [
      "banknote",
      "banknotes",
      "bank note",
      "bank notes",
      "currency note",
      "currency notes",
      "central bank",
      "cash cycle",
      "cash management",
      "counterfeit currency",
      "counterfeit deterrence",
      "new note",
      "polymer note",
      "commemorative note",
      "redenomination",
    ],
  },
  {
    id: "border_control",
    topic: "Identity Documents",
    tags: ["border control", "travel documents"],
    domains: ["identity_documents"],
    profileSignals: ["border_control"],
    profileSignalTitleTerms: [
      "border",
      "ees",
      "etias",
      "entry exit",
      "entry/exit",
      "entry-exit",
      "border police",
      "grenzpolizei",
      "grenzkontrolle",
      "grenzschutz",
      "document inspection",
    ],
    terms: [
      "border control",
      "border crossing",
      "border security",
      "frontier",
      "preclearance",
      "entry/exit",
      "entry-exit",
      "entry exit system",
      "ees",
      "etias",
      "border police",
      "grenzpolizei",
      "grenzkontrolle",
      "grenzschutz",
      "grenzübergang",
      "grenzuebergang",
      "einreise ausreise system",
      "einreise-ausreise-system",
      "reisedokumentenkontrolle",
      "document inspection",
      "traveller processing",
      "electronic travel authorisation",
      "electronic travel authorization",
      "travel authorisation",
      "travel authorization",
      "traveller",
      "traveler",
      "immigration",
      "asylum",
      "airport preclearance",
      "cross-border",
    ],
  },
  {
    id: "identity_documents",
    topic: "Identity Documents",
    tags: ["identity documents", "secure documents"],
    domains: ["identity_documents"],
    profileSignals: ["passport_authority"],
    terms: [
      "identity document",
      "identity documents",
      "secure document",
      "secure documents",
      "document security",
      "security document",
      "id document",
      "id documents",
      "e-passport",
      "epassport",
    ],
  },
  {
    id: "passports",
    topic: "Identity Documents",
    tags: ["passports"],
    domains: ["identity_documents"],
    profileSignals: ["passport_authority"],
    terms: ["passport", "passports", "travel document", "travel documents"],
  },
  {
    id: "id_cards",
    topic: "Identity Documents",
    tags: ["id cards"],
    domains: ["identity_documents"],
    profileSignals: ["passport_authority"],
    terms: [
      "id card",
      "id cards",
      "identity card",
      "identity cards",
      "national id",
      "driver license",
      "driver licenses",
      "driver's license",
      "driver’s license",
      "driving licence",
      "driving licences",
      "mobile driver license",
      "mobile driver's license",
      "mobile driving licence",
      "mdl",
    ],
  },
  {
    id: "visas",
    topic: "Identity Documents",
    tags: ["visas"],
    domains: ["identity_documents"],
    profileSignals: ["passport_authority"],
    terms: ["visa", "visas", "evisa", "e-visa", "residence permit", "residence permits"],
  },
  {
    id: "biometrics",
    topic: "Digital Identity & Biometrics",
    tags: ["biometrics", "biometric verification"],
    domains: ["digital_identity_biometrics"],
    profileSignals: ["identity_verification"],
    terms: [
      "biometric",
      "biometrics",
      "facial recognition",
      "face recognition",
      "fingerprint",
      "fingerprints",
      "iris recognition",
      "iris scan",
      "liveness",
    ],
  },
  {
    id: "digital_identity",
    topic: "Digital Identity & Biometrics",
    tags: ["digital identity"],
    domains: ["digital_identity_biometrics"],
    profileSignals: ["identity_verification"],
    terms: [
      "digital identity",
      "digital trust service",
      "mobile id",
      "eid",
      "digital id",
      "identity wallet",
      "digital wallet",
      "digital wallets",
      "verifiable credential",
      "verifiable credentials",
      "cryptographic identity",
      "identity ecosystem",
      "identity system",
      "age verification",
    ],
  },
  {
    id: "identity_verification",
    topic: "Digital Identity & Biometrics",
    tags: ["identity verification", "authentication"],
    domains: ["digital_identity_biometrics"],
    profileSignals: ["identity_verification"],
    terms: [
      "identity verification",
      "id verification",
      "document verification",
      "authentication",
      "identity proofing",
      "age verification",
      "kyc",
      "onboarding",
      "fraud detection",
    ],
  },
  {
    id: "security_features",
    topic: "Shared Security Printing",
    tags: ["security features"],
    domains: ["security_printing"],
    profileSignals: ["security_printer"],
    terms: [
      "security feature",
      "security features",
      "hologram",
      "holography",
      "optically variable",
      "ovd",
      "dovid",
      "security thread",
      "security ink",
      "intaglio",
      "micro-optics",
      "micro optics",
      "polycarbonate",
      "laminate",
      "substrate",
    ],
  },
];

function normalize(value) {
  return String(value || "").toLowerCase();
}

function matchesTerm(text, term) {
  const normalizedTerm = normalize(term).trim();
  if (!normalizedTerm) {
    return false;
  }

  if (/^[a-z0-9\s-]+$/i.test(normalizedTerm)) {
    return new RegExp(`(^|[^a-z0-9])${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(text);
  }

  return text.includes(normalizedTerm);
}

function scoreRule(text, sourceText, rule) {
  const contentScore = rule.terms.reduce((score, term) => score + (matchesTerm(text, term) ? 1 : 0), 0);
  const sourceScore = (rule.sourceTerms || []).reduce(
    (score, term) => score + (matchesTerm(sourceText, term) ? 1 : 0),
    0
  );
  const score = contentScore + sourceScore;
  const minScore = sourceScore > 0 ? 1 : Number(rule.minScore || 1);
  return score >= minScore ? score : 0;
}

function pickTopic(currentTopic, matchedRules, sourceText) {
  const normalizedTopic = normalize(currentTopic).trim();
  const matchedIds = new Set(matchedRules.map((rule) => rule.id));
  const banknoteSource = ["banknotenews", "notafilia"].some((term) => matchesTerm(sourceText, term));

  if (matchedIds.has("banknotes") && (banknoteSource || normalizedTopic === "banknotes")) {
    return "Banknotes";
  }

  // Rules are ordered by their matched evidence score. Prefer that strongest
  // classification for the card's single headline topic; the full multi-label
  // domain set remains available for profile matching and explanation.
  const strongestMatchedTopic = matchedRules.find((rule) => rule.topic)?.topic;
  if (strongestMatchedTopic) {
    return strongestMatchedTopic;
  }

  if (normalizedTopic && !GENERIC_SOURCE_TOPICS.has(normalizedTopic)) {
    return currentTopic;
  }

  return currentTopic || "General";
}

export function classifyArticleForIngest({ title = "", contentSnippet = "", topic = "", source = "", feedName = "", link = "" } = {}) {
  const titleText = normalize(title);
  const text = normalize([
    title,
    contentSnippet,
    link,
  ].join(" "));
  const sourceText = normalize([source, feedName].join(" "));
  const matchedRules = CLASSIFICATION_RULES
    .map((rule) => ({ rule, score: scoreRule(text, sourceText, rule) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.rule);

  const semanticTags = Array.from(new Set(matchedRules.flatMap((rule) => rule.tags)));
  const domains = Array.from(new Set(matchedRules.flatMap((rule) => rule.domains || [])));
  const profileSignals = Array.from(new Set(matchedRules.flatMap((rule) => {
    if (Array.isArray(rule.profileSignalTitleTerms) && rule.profileSignalTitleTerms.length) {
      return rule.profileSignalTitleTerms.some((term) => matchesTerm(titleText, term))
        ? rule.profileSignals || []
        : (rule.profileSignals || []).filter((profileId) => profileId !== "border_control");
    }
    return rule.profileSignals || [];
  })));

  return {
    topic: pickTopic(topic, matchedRules, sourceText),
    semanticTags,
    domains,
    profileSignals,
    classifications: matchedRules.map((rule) => rule.id),
  };
}
