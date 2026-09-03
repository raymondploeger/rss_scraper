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
    minScore: 2,
    sourceTerms: ["banknotenews", "notafilia"],
    terms: [
      "banknote",
      "banknotes",
      "currency note",
      "currency notes",
      "central bank",
      "cash cycle",
      "cash management",
      "counterfeit currency",
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
    terms: [
      "border control",
      "border crossing",
      "border security",
      "frontier",
      "preclearance",
      "entry/exit",
      "entry-exit",
      "eta",
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
    terms: ["passport", "passports", "travel document", "travel documents"],
  },
  {
    id: "id_cards",
    topic: "Identity Documents",
    tags: ["id cards"],
    terms: ["id card", "id cards", "identity card", "identity cards", "national id"],
  },
  {
    id: "visas",
    topic: "Identity Documents",
    tags: ["visas"],
    terms: ["visa", "visas", "evisa", "e-visa", "residence permit", "residence permits"],
  },
  {
    id: "biometrics",
    topic: "Digital Identity & Biometrics",
    tags: ["biometrics", "biometric verification"],
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
    terms: [
      "digital identity",
      "mobile id",
      "eid",
      "digital id",
      "identity wallet",
      "digital wallet",
      "verifiable credential",
      "verifiable credentials",
      "cryptographic identity",
      "identity ecosystem",
      "identity system",
    ],
  },
  {
    id: "identity_verification",
    topic: "Digital Identity & Biometrics",
    tags: ["identity verification", "authentication"],
    terms: [
      "identity verification",
      "id verification",
      "document verification",
      "authentication",
      "identity proofing",
      "kyc",
      "onboarding",
      "fraud detection",
    ],
  },
  {
    id: "security_features",
    topic: "Shared Security Printing",
    tags: ["security features"],
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

  if (["identity_documents", "passports", "id_cards", "visas", "border_control"].some((id) => matchedIds.has(id))) {
    return "Identity Documents";
  }

  if (["digital_identity", "biometrics", "identity_verification"].some((id) => matchedIds.has(id))) {
    return "Digital Identity & Biometrics";
  }

  if (matchedIds.has("banknotes")) {
    return "Banknotes";
  }

  if (matchedIds.has("security_features")) {
    return "Shared Security Printing";
  }

  if (normalizedTopic && !GENERIC_SOURCE_TOPICS.has(normalizedTopic)) {
    return currentTopic;
  }

  const firstMatchedTopic = matchedRules.find((rule) => rule.topic)?.topic;
  return firstMatchedTopic || currentTopic || "General";
}

export function classifyArticleForIngest({ title = "", contentSnippet = "", topic = "", source = "", feedName = "", link = "", keywords = [] } = {}) {
  const text = normalize([
    title,
    contentSnippet,
    link,
    Array.isArray(keywords) ? keywords.join(" ") : "",
  ].join(" "));
  const sourceText = normalize([source, feedName].join(" "));
  const matchedRules = CLASSIFICATION_RULES
    .map((rule) => ({ rule, score: scoreRule(text, sourceText, rule) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.rule);

  const semanticTags = Array.from(new Set(matchedRules.flatMap((rule) => rule.tags)));

  return {
    topic: pickTopic(topic, matchedRules, sourceText),
    semanticTags,
    classifications: matchedRules.map((rule) => rule.id),
  };
}
