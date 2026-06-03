import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, "../.env");

dotenv.config({ path: envFilePath });

const databaseUrl = process.env.DATABASE_URL || "";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL.");
  console.error("Set DATABASE_URL in the environment or add it to backend/.env before running this script.");
  process.exit(1);
}

const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const articleLimit = Math.max(500, Math.min(8000, Number(limitArg ? limitArg.split("=")[1] : 4000) || 4000));

const DOMAIN_CONTEXTS = {
  banknote_intelligence: {
    strong: [
      "banknote",
      "banknotes",
      "currency note",
      "note issuance",
      "commemorative note",
      "polymer note",
      "polymer banknote",
      "central bank",
      "security thread",
      "intaglio",
      "denomination",
      "new series",
      "counterfeit note",
      "counterfeit currency",
      "currency redesign",
      "banknote redesign",
    ],
    weak: ["currency", "cash circulation", "note", "banknote family"],
    excluded: ["digital identity", "eid", "passport", "passports", "biometric", "biometrics", "kyc", "wallet onboarding", "identity wallet"],
  },
  identity_documents: {
    strong: [
      "passport",
      "passports",
      "icao",
      "visa",
      "visas",
      "identity card",
      "id card",
      "residence permit",
      "border control",
      "travel document",
      "polycarbonate",
      "driver license",
      "driver's license",
    ],
    weak: ["issuance office", "document issuance", "immigration authority", "passport office"],
    excluded: ["banknote", "banknotes", "central bank", "currency redesign", "polymer note", "commemorative note"],
  },
  digital_identity_biometrics: {
    strong: [
      "biometric",
      "biometrics",
      "digital identity",
      "digital id",
      "eid",
      "e-id",
      "authentication",
      "kyc",
      "liveness",
      "wallet",
      "identity verification",
      "ai verification",
      "onboarding",
    ],
    weak: ["identity platform", "mobile id", "document verification", "verification platform"],
    excluded: ["commemorative banknote", "currency redesign", "central bank issuance", "banknote withdrawal", "demonetisation"],
  },
};

const SPECIALIST_SOURCE_INTERESTS = {
  banknote_intelligence: [
    "banknotenews",
    "banknotenews.com",
    "notafilia",
    "notafilia.pt",
    "mriguide",
    "mriguide.com",
    "currency-news",
    "currency-news.com",
    "reform.news",
    "central bank",
    "bank of england",
    "ecb",
  ],
  identity_documents: [
    "icao",
    "keesing",
    "biometric update",
    "regula",
    "thales",
    "veridos",
    "idemia",
  ],
  digital_identity_biometrics: ["biometric update", "digital identity", "authentication", "identity verification"],
};

const ID_DOCUMENT_SOURCE_AUTHORITY = {
  veryHigh: [
    "icao",
    "icao newsroom",
    "icao trip",
    "passport office",
    "ministry of interior",
    "immigration authority",
    "state department",
    "us state department",
    "passport agency",
    "passport service",
    "immigration service",
    "immigration department",
    "passport canada",
    "home office",
    "eu commission",
    "frontex",
    "interpol",
    "dmv",
    "driver license agency",
    "biometric update",
    "keesing",
    "regula",
    "hid",
    "thales",
    "entrust",
    "veridos",
    "bundesdruckerei",
    "idemia",
    "in groupe",
    "laxton",
    "security document world",
    "securitydocumentworld",
    "ovd kinegram",
    "de la rue",
    "giesecke+devrient",
    "giesecke devrient",
    "gi-de",
    "crane authentication",
    "ukvi biometric residence permits",
    "ukvi brp and brc guidance",
    "ukvi",
    "eu-lisa",
    "eulisa",
    "cbp newsroom",
    "mobile passport control",
  ],
  high: [
    "passport",
    "travel document",
    "identity card",
    "residence permit",
    "driver license",
    "polycarbonate",
    "secure document",
    "document security",
    "border control",
    "document verification",
    "ind.nl",
    "migrationsverket",
    "migration authority",
    "government permit issuer",
    "border agency",
    "border police",
    "customs and border protection",
  ],
  medium: ["reuters", "associated press", "ap news", "bbc", "press agency", "official news agency"],
  low: [
    "generic travel",
    "travel blog",
    "tourism blog",
    "adventure",
    "travel adventure",
    "sports",
    "lifestyle",
    "entertainment",
    "visa agency",
    "immigration law",
    "immigration lawyer",
    "local news",
    "politics",
    "celebrity",
  ],
  veryLow: [
    "youtube",
    "youtu.be",
    "tiktok",
    "instagram",
    "travel tips",
    "passport appointment",
    "passport photo",
    "vacation",
    "visa requirements",
    "visa requirement",
    "passport renewal",
    "seo passport",
    "law firm",
    "attorney",
    "marketing",
  ],
};

const IDENTITY_SUBGROUPS = {
  passports: {
    label: "Passports",
    strong: ["passport", "passports", "travel document"],
    weak: ["passport office"],
    focus: [
      "passport issuance",
      "passport design",
      "passport security",
      "passport modernization",
      "biometric passport",
      "passport personalization",
      "passport renewal",
      "passport procurement",
      "passport office",
      "e-passport",
      "epassport",
      "secure passport",
    ],
    bridge: ["icao", "mrz", "doc 9303", "travel document security", "document authentication"],
  },
  id_cards: {
    label: "ID Cards",
    strong: ["id card", "identity card", "national id"],
    weak: ["id issuance"],
    focus: [
      "identity card",
      "id card",
      "national id",
      "citizen card",
      "identity card program",
      "electronic identity card",
      "national identity card",
      "citizen identity card",
    ],
    bridge: ["card issuance", "card personalization", "polycarbonate id"],
  },
  residence_permits: {
    label: "Residence Permits",
    strong: ["residence permit", "residence permits"],
    weak: ["permit card"],
    focus: [
      "residence permit",
      "residence permit card",
      "residence card",
      "residency card",
      "immigration document",
      "resident card",
      "biometric residence permit",
      "permit issuance",
      "permit personalization",
      "foreign resident card",
      "residence document",
    ],
    bridge: ["immigration card", "stay permit", "resident permit", "permit renewal"],
  },
  drivers_licenses: {
    label: "Driver's Licenses",
    strong: ["driver license", "driver's license", "driving licence"],
    weak: ["license card"],
    focus: [
      "driver license",
      "driver's license",
      "driving licence",
      "mobile driving licence",
      "mobile driver license",
      "mdl",
      "license card",
      "dmv",
    ],
    bridge: ["state id card", "digital driver license"],
  },
  visas: {
    label: "Visas",
    strong: ["visa", "visas", "visa policy"],
    weak: ["travel authorization"],
    focus: [
      "visa issuance",
      "e-visa",
      "electronic visa",
      "visa modernization",
      "visa sticker",
      "visa policy",
      "visa waiver",
      "visa exemption",
      "travel authorization",
      "entry permit",
    ],
    bridge: ["consular services", "consular modernization", "visa center", "visa processing"],
  },
  laminate: {
    label: "Laminate",
    strong: ["laminate", "laminated document", "security laminate"],
    weak: ["laminated"],
    focus: ["laminate", "laminated document", "security laminate", "lamination", "overlay", "overlays", "passport laminate", "id laminate"],
    bridge: ["hologram", "security feature", "secure document material"],
  },
  polycarbonate: {
    label: "Polycarbonate",
    strong: ["polycarbonate", "pc datapage", "polycarbonate card"],
    weak: ["datapage", "card substrate"],
    focus: ["polycarbonate", "pc datapage", "polycarbonate card", "laser engraving", "secure card construction", "passport datapage", "card substrate"],
    bridge: ["secure document material", "card body"],
  },
  issuance: {
    label: "Issuance",
    strong: ["issuance", "passport issuance", "passport renewal", "document issuance"],
    weak: ["issued", "renewal"],
    focus: ["issuance", "passport issuance", "document issuance", "enrollment", "enrolment", "personalization", "card production", "production system", "secure issuance"],
    bridge: ["renewal system", "government issuance system"],
  },
  fraud: {
    label: "Fraud",
    strong: ["fraud", "fake passport", "forged passport", "forged document", "document fraud"],
    weak: ["counterfeit document"],
    focus: ["document fraud", "forgery", "forged passport", "forged document", "counterfeit document", "counterfeit id", "fake passport", "identity fraud", "fraudulent issuance"],
    bridge: ["document verification", "identity fraud ring", "counterfeit"],
  },
  icao: {
    label: "ICAO",
    strong: ["icao", "doc 9303", "mrz", "passport verification"],
    weak: ["travel document security"],
    focus: ["icao", "icao standards", "doc 9303", "mrtd", "emrtd", "mrz", "machine readable", "travel document standards", "icao compliance"],
    bridge: ["passport chip", "border interoperability", "document verification"],
  },
  border_control: {
    label: "Border Control",
    strong: ["border control", "border checks", "immigration control", "entry exit system"],
    weak: ["customs"],
    focus: [
      "border control",
      "ees",
      "etias",
      "abc gate",
      "abc gates",
      "egate",
      "e-gate",
      "e-gates",
      "automated border control",
      "immigration control",
      "passport control",
      "mobile passport control",
      "frontex",
      "cbp",
      "eu-lisa",
      "document verification",
      "document inspection",
    ],
    bridge: ["border verification", "travel document inspection", "border management system"],
  },
};

const IDENTITY_SUBINTEREST_INTENTS = {
  passports: {
    strongPositive: [
      "biometric passport",
      "passport rollout",
      "passport issuance",
      "passport renewal",
      "passport security",
      "passport personalization",
      "passport production",
      "e-passport",
      "epassport",
      "travel document security",
      "passport fraud",
      "passport chip",
      "passport verification",
      "passport authority",
      "passport processing",
      "passport office",
      "passport system",
      "passport modernization",
      "passport printer",
      "passport design",
      "passport procurement",
      "icao compliance",
      "document authentication",
      "chip authentication",
      "pki",
      "enrollment",
      "issuance modernization",
      "secure passport",
      "border interoperability",
    ],
    weakPositive: ["passport", "travel document", "mrz", "icao"],
    hardNegative: [
      "visa-free",
      "tourism",
      "passport adventure",
      "passport paradise",
      "passport program",
      "travel rankings",
      "airport transit",
      "holiday travel",
      "tourist access",
      "cheap flights",
      "travel tips",
      "travel guide",
      "destination ranking",
      "vacation",
      "strongest passports",
      "most beautiful passports",
      "most powerful passport",
      "passport ranking",
      "sports passport story",
    ],
  },
  visas: {
    strongPositive: [
      "visa issuance",
      "e-visa",
      "electronic visa",
      "visa application",
      "visa sticker",
      "visa fraud",
      "consular services",
      "visa processing",
      "visa center",
      "travel authorization",
      "entry permit",
      "visa policy",
      "visa requirement",
      "visa exemption",
      "visa waiver",
    ],
    weakPositive: ["visa"],
    hardNegative: ["passport ranking", "tourism", "travel destination", "passport beauty", "travel lifestyle", "vacation", "airport hotel"],
  },
  residence_permits: {
    strongPositive: [
      "residence permit",
      "residence permit card",
      "residency card",
      "immigration permit",
      "temporary residence",
      "permanent residence",
      "residency renewal",
      "resident permit",
      "immigration card",
      "stay permit",
      "biometric permit",
      "biometric residence permit",
      "permit issuance",
      "permit personalization",
      "permit procurement",
      "foreign resident card",
      "secure permit document",
      "digital residence permit",
      "digital permit system",
      "permit verification",
      "permit authentication",
    ],
    weakPositive: ["immigration"],
    hardNegative: [
      "tourism",
      "visa-free",
      "passport ranking",
      "travel ranking",
      "migration opinion",
      "asylum politics",
      "nationality dispute",
      "citizenship debate",
      "expat blog",
      "relocation guide",
      "travel bureaucracy",
    ],
  },
  icao: {
    strongPositive: ["icao", "doc 9303", "mrz", "emrtd", "travel document standards", "machine readable", "border interoperability", "passport chip", "mrtd"],
    weakPositive: ["border control", "travel document"],
    hardNegative: ["tourism", "travel ranking", "vacation"],
  },
  border_control: {
    strongPositive: [
      "automated border control",
      "abc",
      "abc gate",
      "egate",
      "e-gate",
      "egates",
      "border control technology",
      "border inspection",
      "border verification",
      "document verification",
      "document authentication",
      "passport verification",
      "travel document verification",
      "border biometrics",
      "biometric corridor",
      "biometric matching",
      "facial recognition border systems",
      "mobile passport control",
      "mpc",
      "cbp",
      "frontex",
      "eu-lisa",
      "eulisa",
      "ees",
      "etias",
      "entry exit system",
      "document reader",
      "passport reader",
      "mrtd inspection",
      "identity verification",
      "border security technology",
      "border management system",
    ],
    weakPositive: ["border control", "immigration control", "passport control"],
    hardNegative: [
      "airport delays",
      "travel chaos",
      "holidaymakers",
      "customs wait times",
      "long queues",
      "travel tips",
      "airline advice",
      "airport incident",
      "tourist arrested",
      "tourist banned",
    ],
  },
};

const PROFILE_BY_INTEREST = {
  passports: {
    strongPositive: [
      "biometric passport",
      "e-passport",
      "epassport",
      "passport issuance",
      "passport renewal",
      "passport office",
      "passport personalization",
      "passport procurement",
      "icao doc 9303",
      "icao compliance",
      "passport verification",
      "passport rollout",
      "passport redesign",
      "chip authentication",
      "pki",
      "passport fraud",
      "passport production",
      "government issuance system",
      "document inspection",
      "border interoperability",
    ],
    mediumPositive: [
      "passport security",
      "travel document security",
      "secure passport",
      "mrtd",
      "emrtd",
      "mrz",
      "document authentication",
      "issuance modernization",
      "border control",
      "passport biometric",
      "passport regulation",
      "passport technology",
    ],
    weakPositive: ["passport", "travel document", "passport office", "state department"],
    strongNegative: [
      "passport adventure",
      "passport paradise",
      "passport program",
      "travel rankings",
      "strongest passports",
      "most beautiful passports",
      "most powerful passports",
      "tourism journalism",
      "vacation guide",
      "travel tips",
      "visa-free destinations",
      "airport delays",
      "airport queue",
      "holiday travel",
      "sports passport",
      "travel passport",
    ],
  },
  visas: {
    strongPositive: [
      "visa issuance",
      "e-visa",
      "electronic visa",
      "visa policy",
      "visa waiver",
      "visa exemption",
      "travel authorization",
      "consular digitization",
      "consular modernization",
      "visa center",
      "visa sticker",
      "entry permit",
      "mobility agreement",
      "visa diplomacy",
    ],
    mediumPositive: ["visa processing", "consular services", "transit system", "mobility policy", "visa regulation", "visa-free agreement"],
    weakPositive: ["visa", "visas", "consular"],
    strongNegative: ["travel blog", "vacation guide", "tour package", "cheap flights", "hotel deal", "travel agency", "destination ranking", "holiday ideas"],
  },
  residence_permits: {
    strongPositive: [
      "residence permit",
      "residence permit card",
      "residency card",
      "resident card",
      "biometric residence permit",
      "permit issuance",
      "permit personalization",
      "permit procurement",
      "foreign resident card",
      "secure permit document",
      "digital residence permit",
      "permit verification",
      "permit authentication",
      "permit renewal system",
      "immigration authority infrastructure",
      "permit fraud",
      "immigration card",
      "residence document",
    ],
    mediumPositive: [
      "immigration card system",
      "resident permit",
      "stay permit",
      "permit card security",
      "secure issuance",
      "document vendor",
      "card personalization",
      "permit renewal",
      "resident card",
      "document authentication",
    ],
    weakPositive: ["residence permit", "permit card", "immigration card"],
    strongNegative: [
      "expat blog",
      "relocation guide",
      "generic asylum news",
      "migration opinion",
      "citizenship lifestyle",
      "nationality dispute",
      "travel bureaucracy",
      "immigration politics",
      "generic immigration news",
      "travel story",
    ],
  },
  border_control: {
    strongPositive: [
      "automated border control",
      "abc",
      "abc gate",
      "abc gates",
      "egate",
      "e-gate",
      "e-gates",
      "egates",
      "border control technology",
      "border inspection",
      "border verification",
      "document authentication",
      "passport verification",
      "travel document verification",
      "ees",
      "etias",
      "entry exit system",
      "frontex",
      "cbp",
      "eu-lisa",
      "eulisa",
      "border biometrics",
      "biometric corridor",
      "biometric matching",
      "traveler verification",
      "document inspection",
      "facial recognition at borders",
      "facial recognition border systems",
      "border kiosk",
      "self-service border kiosk",
      "passport control automation",
      "mobile passport control",
      "mpc",
      "document reader",
      "passport reader",
      "mrtd inspection",
      "identity verification",
      "border security technology",
      "border management system",
      "seamless border crossing",
      "automated immigration control",
      "regula",
      "veridos",
      "idemia",
      "thales",
      "vision-box",
      "visionbox",
    ],
    mediumPositive: [
      "border control",
      "border verification",
      "border interoperability",
      "passport control",
      "document verification",
      "travel document inspection",
      "icao border interoperability",
      "secure traveler verification",
      "border security",
      "immigration control",
    ],
    weakPositive: ["border", "border check", "passport control"],
    strongNegative: [
      "airport queue",
      "airport delays",
      "airport delay",
      "airport chaos",
      "travel delays",
      "flight delays",
      "passenger incident",
      "baggage",
      "holiday travel",
      "holidaymakers",
      "tourism disruption",
      "customs waiting times",
      "long queue",
      "long queues",
      "airport congestion",
      "travel tips",
      "airline advice",
      "travel chaos",
      "tourist arrested",
      "airport incident",
    ],
  },
  icao: {
    strongPositive: ["icao", "doc 9303", "mrtd", "emrtd", "mrz", "machine readable", "icao compliance", "travel document standards"],
    mediumPositive: ["border interoperability", "passport chip", "document verification", "secure traveler verification"],
    weakPositive: ["travel document", "border control"],
    strongNegative: ["tourism", "vacation", "travel ranking", "cheap flights"],
  },
  issuance: {
    strongPositive: ["document issuance", "passport issuance", "identity card issuance", "permit issuance", "visa issuance", "secure issuance", "issuance modernization"],
    mediumPositive: ["renewal system", "production system", "enrollment", "personalization", "government issuance system"],
    weakPositive: ["issued", "issuance"],
    strongNegative: ["stock issuance", "bond issuance", "share issuance", "vacation", "travel tips"],
  },
  fraud: {
    strongPositive: ["document fraud", "fake passport", "forged passport", "forged id", "counterfeit id", "permit fraud", "fraudulent issuance"],
    mediumPositive: ["document verification", "identity fraud ring", "secure document fraud", "counterfeit document"],
    weakPositive: ["fraud", "forged document"],
    strongNegative: ["credit card fraud", "insurance fraud", "tax fraud", "romance scam", "cyber fraud software"],
  },
};

const CROSS_ANALYSIS = {
  passports: ["visas", "icao", "issuance"],
  id_cards: ["residence_permits", "polycarbonate", "issuance"],
  residence_permits: ["id_cards", "visas", "issuance"],
  drivers_licenses: ["id_cards", "issuance", "fraud"],
  visas: ["passports", "residence_permits", "border_control"],
  laminate: ["polycarbonate", "issuance", "fraud"],
  polycarbonate: ["laminate", "id_cards", "passports"],
  issuance: ["passports", "id_cards", "residence_permits"],
  fraud: ["passports", "residence_permits", "border_control"],
  icao: ["passports", "border_control", "visas"],
  border_control: ["visas", "icao", "fraud"],
};

const HIGHLIGHT_PAIRS = [
  ["passports", "visas", "Passport articles appearing in Visas"],
  ["visas", "border_control", "Visa articles appearing in Border Control"],
  ["id_cards", "residence_permits", "ID Cards appearing in Residence Permits"],
  ["residence_permits", "id_cards", "Residence Permit articles appearing in ID Cards"],
  ["icao", "border_control", "ICAO articles appearing in Border Control"],
];

function formatRows(rows = []) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.join(", ") : value == null ? "" : value,
      ])
    )
  );
}

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

function countBoostKeywordMatches(text, keywords = []) {
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

function contextMatchesSpecialistSource(context, groupId) {
  return Array.isArray(SPECIALIST_SOURCE_INTERESTS[groupId]) && SPECIALIST_SOURCE_INTERESTS[groupId].some((specialistSource) =>
    context.sourceText.includes(specialistSource) || context.domainText.includes(specialistSource)
  );
}

function buildContext(article) {
  const sourceText = [article.source, article.feedName].filter(Boolean).join(" ").toLowerCase();
  const domainText = [getHostname(article.link), getHostname(article.canonicalLink)].filter(Boolean).join(" ").toLowerCase();
  return {
    titleText: [article.title].filter(Boolean).join(" ").toLowerCase(),
    tagText: [article.keywords].filter(Boolean).join(" ").toLowerCase(),
    metadataText: [article.topic, sourceText].filter(Boolean).join(" ").toLowerCase(),
    bodyText: [article.summary, article.summaryShort, article.contentSnippet].filter(Boolean).join(" ").toLowerCase(),
    sourceText,
    domainText,
    topic: normalizeKeyword(article.topic),
    signalIds: [],
    eventType: "",
  };
}

function getDomainContextProfile(context, groupId) {
  const config = DOMAIN_CONTEXTS[groupId];
  if (!config) {
    return { score: 0, excludedHits: 0 };
  }

  const strongKeywords = Array.isArray(config.strong) ? config.strong : [];
  const weakKeywords = Array.isArray(config.weak) ? config.weak : [];
  const excludedKeywords = Array.isArray(config.excluded) ? config.excluded : [];

  const strongTitleHits = countBoostKeywordMatches(context.titleText, strongKeywords);
  const strongTagHits = countBoostKeywordMatches(context.tagText, strongKeywords);
  const strongMetaHits = countBoostKeywordMatches(context.metadataText, strongKeywords);
  const strongBodyHits = countBoostKeywordMatches(context.bodyText, strongKeywords);
  const weakTitleHits = countBoostKeywordMatches(context.titleText, weakKeywords);
  const weakTagHits = countBoostKeywordMatches(context.tagText, weakKeywords);
  const weakMetaHits = countBoostKeywordMatches(context.metadataText, weakKeywords);
  const weakBodyHits = countBoostKeywordMatches(context.bodyText, weakKeywords);
  const excludedHits =
    countBoostKeywordMatches(context.titleText, excludedKeywords) +
    countBoostKeywordMatches(context.tagText, excludedKeywords) +
    countBoostKeywordMatches(context.metadataText, excludedKeywords);

  let score =
    (strongTitleHits * 5) +
    (strongTagHits * 4) +
    (strongMetaHits * 3.5) +
    (strongBodyHits * 1.25) +
    (weakTitleHits * 2) +
    (weakTagHits * 1.5) +
    (weakMetaHits * 1.25) +
    (weakBodyHits * 0.35);

  if (groupId === "digital_identity_biometrics" && context.topic === "digital id") {
    score += 10;
  }
  if (groupId === "identity_documents" && context.topic === "identity documents") {
    score += 10;
  }
  if (groupId === "banknote_intelligence" && (context.topic === "banknotes" || context.topic === "banknote")) {
    score += 12;
  }

  return { score, excludedHits };
}

function getApproximateDominantDomain(article) {
  const context = buildContext(article);
  const banknoteSignals = getDomainContextProfile(context, "banknote_intelligence");
  const identitySignals = getDomainContextProfile(context, "identity_documents");
  const digitalSignals = getDomainContextProfile(context, "digital_identity_biometrics");

  const banknoteScore =
    banknoteSignals.score
    + (context.topic === "banknotes" || context.topic === "banknote" ? 18 : 0)
    + (contextMatchesSpecialistSource(context, "banknote_intelligence") ? 28 : 0);
  const identityScore =
    identitySignals.score
    + (context.topic === "identity documents" ? 18 : 0)
    + (contextMatchesSpecialistSource(context, "identity_documents") ? 14 : 0);
  const digitalScore =
    digitalSignals.score
    + (context.topic === "digital id" ? 20 : 0)
    + (contextMatchesSpecialistSource(context, "digital_identity_biometrics") ? 14 : 0);

  const candidates = [
    { domain: "banknotes", score: banknoteScore },
    { domain: "identity_documents", score: identityScore },
    { domain: "digital_identity_biometrics", score: digitalScore },
  ].sort((left, right) => right.score - left.score);

  if (!candidates.length || candidates[0].score < 8) {
    return "other";
  }
  if ((candidates[0].score - candidates[1].score) < 2 && candidates[0].score < 14) {
    return "other";
  }
  return candidates[0].domain;
}

function getIdentityDocumentSourceAuthority(article) {
  const context = buildContext(article);
  const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
  const hasAny = (values = []) => values.some((value) => textMatchesKeyword(sourceFingerprint, value));

  let level = "medium";
  let multiplier = 1.0;
  let boost = 0;

  if (hasAny(ID_DOCUMENT_SOURCE_AUTHORITY.veryHigh)) {
    level = "very_high";
    multiplier = 2.2;
    boost = 120;
  } else if (hasAny(ID_DOCUMENT_SOURCE_AUTHORITY.high)) {
    level = "high";
    multiplier = 1.6;
    boost = 60;
  } else if (hasAny(ID_DOCUMENT_SOURCE_AUTHORITY.veryLow)) {
    level = "very_low";
    multiplier = 0.2;
    boost = -80;
  } else if (hasAny(ID_DOCUMENT_SOURCE_AUTHORITY.low)) {
    level = "low";
    multiplier = 0.5;
    boost = -35;
  } else if (hasAny(ID_DOCUMENT_SOURCE_AUTHORITY.medium)) {
    level = "medium";
    multiplier = 1.1;
    boost = 12;
  }

  return { level, multiplier, boost };
}

function weightedHits(context, terms = []) {
  return (countBoostKeywordMatches(context.titleText, terms) * 5) +
    (countBoostKeywordMatches(context.tagText, terms) * 2.5) +
    (countBoostKeywordMatches(context.metadataText, terms) * 2.5) +
    countBoostKeywordMatches(context.bodyText, terms);
}

function getIdentityDocumentInterestSignals(article) {
  const context = buildContext(article);
  const primaryContextTerms = [
    "passport rollout",
    "new passport",
    "biometric passport",
    "electronic passport",
    "emrtd",
    "mrtd",
    "icao",
    "identity card",
    "id card",
    "residence permit",
    "driver license",
    "driving licence",
    "visa document",
    "secure document",
    "document security",
    "polycarbonate",
    "laminate",
    "personalization",
    "chip document",
    "border control",
    "document verification",
    "document fraud",
    "fake passport",
    "forged document",
    "counterfeit id",
  ];
  const passportTerms = [
    "passport",
    "passports",
    "biometric passport",
    "electronic passport",
    "emrtd",
    "mrtd",
    "travel document",
    "passport issuance",
    "passport personalization",
    "passport procurement",
    "passport verification",
    "icao compliance",
    "document authentication",
    "chip authentication",
    "pki",
    "enrollment",
    "secure passport",
    "border interoperability",
  ];
  const idCardTerms = ["identity card", "id card", "national id", "electronic identity card", "polycarbonate id", "card issuance", "card design"];
  const residencePermitTerms = [
    "residence permit",
    "residence permits",
    "permit card",
    "immigration document issuance",
    "permit redesign",
    "biometric permit",
    "permit issuance",
    "permit personalization",
    "permit procurement",
    "foreign resident card",
    "secure permit document",
    "digital permit system",
    "permit verification",
    "permit authentication",
  ];
  const driverLicenseTerms = ["driver license", "driver's license", "driving licence", "license card", "dmv", "mobile driving licence", "mobile driver license", "mdl"];
  const polycarbonateTerms = ["polycarbonate", "pc datapage", "polycarbonate card", "passport datapage", "secure document material", "laser engraving"];
  const fraudTerms = ["document fraud", "fake passport", "forged passport", "forged document", "counterfeit id", "fraudulent issuance", "identity fraud"];
  const icaoTerms = ["icao", "doc 9303", "mrz", "mrtd", "emrtd", "travel document standards", "compliance"];
  const borderTerms = [
    "border control",
    "border verification",
    "passport control",
    "document checks",
    "travel document inspection",
    "e-gates",
    "egate",
    "automated border control",
    "ees",
    "etias",
    "cbp",
    "frontex",
    "eu-lisa",
  ];
  const visaTerms = ["visa", "visas", "visa document", "visa sticker", "evisa", "electronic visa", "visa issuance", "visa security", "travel authorization"];
  const issuanceTerms = ["document issuance", "passport issuance", "identity card issuance", "residence permit issuance", "visa issuance", "secure issuance", "enrollment", "personalization"];
  const laminateTerms = ["laminate", "laminated document", "security laminate", "passport laminate", "id laminate", "overlay", "overlays"];
  const personalizationTerms = ["personalization", "passport personalization", "card personalization", "secure personalization", "document personalization"];
  const noisyTerms = [
    "passport appointment",
    "passport photo",
    "travel tips",
    "vacation",
    "visa requirements",
    "celebrity passport",
    "political passport",
    "passport renewal seo",
    "generic immigration advice",
    "youtube",
    "tiktok",
    "instagram",
    "travel blog",
    "visa agency",
    "immigration lawyer",
    "law firm",
    "child support passport revocation",
    "visa-free travel",
    "strongest passports",
    "most beautiful passports",
    "most powerful passports",
    "tourism journalism",
    "destination content",
    "generic asylum news",
    "migration opinion",
    "nationality dispute",
  ];

  return {
    primaryContextHits: weightedHits(context, primaryContextTerms),
    passportHits: weightedHits(context, passportTerms),
    idCardHits: weightedHits(context, idCardTerms),
    residencePermitHits: weightedHits(context, residencePermitTerms),
    driverLicenseHits: weightedHits(context, driverLicenseTerms),
    polycarbonateHits: weightedHits(context, polycarbonateTerms),
    fraudHits: weightedHits(context, fraudTerms),
    icaoHits: weightedHits(context, icaoTerms),
    borderHits: weightedHits(context, borderTerms),
    visaHits: weightedHits(context, visaTerms),
    issuanceHits: weightedHits(context, issuanceTerms),
    laminateHits: weightedHits(context, laminateTerms),
    personalizationHits: weightedHits(context, personalizationTerms),
    noisyHits: weightedHits(context, noisyTerms),
  };
}

function calculateIntentScore(articleText, intentProfile) {
  const normalizedText = String(articleText || "").toLowerCase();
  const strongPositive = Array.isArray(intentProfile?.strongPositive) ? intentProfile.strongPositive : [];
  const weakPositive = Array.isArray(intentProfile?.weakPositive) ? intentProfile.weakPositive : [];
  const hardNegative = Array.isArray(intentProfile?.hardNegative) ? intentProfile.hardNegative : [];

  const matchedStrong = strongPositive.filter((term) => textMatchesKeyword(normalizedText, term));
  const matchedWeak = weakPositive.filter((term) => textMatchesKeyword(normalizedText, term));
  const matchedNegative = hardNegative.filter((term) => textMatchesKeyword(normalizedText, term));

  let score = (matchedStrong.length * 15) + (matchedWeak.length * 4) - (matchedNegative.length * 20);
  if (matchedNegative.length >= 2) {
    score -= 500;
  }

  return {
    score,
    matchedStrong,
    matchedWeak,
    matchedNegative,
  };
}

function calculateProfileScore(context, article, profileId) {
  const profile = PROFILE_BY_INTEREST[profileId];
  if (!profile) {
    return { score: 0, matchedStrong: [], matchedMedium: [], matchedWeak: [], matchedNegative: [] };
  }

  const scoreMatches = (terms = [], weights) => {
    const matched = terms.filter((term) =>
      textMatchesKeyword(context.titleText, term) ||
      textMatchesKeyword(context.tagText, term) ||
      textMatchesKeyword(context.metadataText, term) ||
      textMatchesKeyword(context.bodyText, term)
    );
    const titleHits = matched.filter((term) => textMatchesKeyword(context.titleText, term)).length;
    const tagHits = matched.filter((term) => textMatchesKeyword(context.tagText, term)).length;
    const metaHits = matched.filter((term) => textMatchesKeyword(context.metadataText, term)).length;
    const bodyHits = matched.filter((term) => textMatchesKeyword(context.bodyText, term)).length;
    const score =
      (titleHits * weights.title) +
      (tagHits * weights.tag) +
      (metaHits * weights.meta) +
      (bodyHits * weights.body);
    return { matched, score };
  };

  const strong = scoreMatches(profile.strongPositive, { title: 16, tag: 9, meta: 8, body: 6 });
  const medium = scoreMatches(profile.mediumPositive, { title: 10, tag: 6, meta: 5, body: 3 });
  const weak = scoreMatches(profile.weakPositive, { title: 4, tag: 2, meta: 2, body: 1 });
  const negative = scoreMatches(profile.strongNegative, { title: 18, tag: 10, meta: 8, body: 6 });

  const authority = getIdentityDocumentSourceAuthority(article);
  let score = strong.score + medium.score + weak.score - negative.score;
  score += Math.max(0, authority.boost * 0.35);

  return {
    score,
    matchedStrong: strong.matched,
    matchedMedium: medium.matched,
    matchedWeak: weak.matched,
    matchedNegative: negative.matched,
  };
}

function getIdentityRecencyAdjustment(article) {
  const publishedAt = article.pubDate ? new Date(article.pubDate).getTime() : NaN;
  if (!Number.isFinite(publishedAt)) {
    return { ageDays: Number.POSITIVE_INFINITY, boost: -45 };
  }

  const ageDays = Math.max(0, (Date.now() - publishedAt) / (24 * 60 * 60 * 1000));
  let boost = 0;

  if (ageDays <= 30) {
    boost = 125;
  } else if (ageDays <= 90) {
    boost = 70;
  } else if (ageDays <= 180) {
    boost = 30;
  } else if (ageDays > 365 * 5) {
    boost = -260;
  } else if (ageDays > 365 * 3) {
    boost = -180;
  } else if (ageDays > 365) {
    boost = -90;
  }

  return { ageDays, boost };
}

function computeSubinterestCore(article) {
  const context = buildContext(article);
  const signals = getIdentityDocumentInterestSignals(article);
  const intentText = [context.titleText, context.tagText, context.metadataText, context.bodyText].filter(Boolean).join(" ");
  const intentByInterest = {
    passports: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.passports),
    visas: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.visas),
    residence_permits: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.residence_permits),
    icao: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.icao),
    border_control: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.border_control),
  };
  const profileByInterest = {
    passports: calculateProfileScore(context, article, "passports"),
    visas: calculateProfileScore(context, article, "visas"),
    residence_permits: calculateProfileScore(context, article, "residence_permits"),
    border_control: calculateProfileScore(context, article, "border_control"),
    icao: calculateProfileScore(context, article, "icao"),
    issuance: calculateProfileScore(context, article, "issuance"),
    fraud: calculateProfileScore(context, article, "fraud"),
  };

  const scoreByInterest = {
    passports:
      (signals.passportHits * 0.7) +
      (signals.icaoHits * 0.45) +
      (signals.issuanceHits * 0.45) +
      (signals.personalizationHits * 0.45) -
      (signals.driverLicenseHits * 1.05) -
      (signals.noisyHits * 0.9) -
      (signals.visaHits * 0.2) +
      ((profileByInterest.passports?.score || 0) * 1.1) +
      (intentByInterest.passports.score || 0),
    id_cards:
      (signals.idCardHits * 1.55) +
      (signals.polycarbonateHits * 0.5) +
      (signals.issuanceHits * 0.4) -
      (signals.driverLicenseHits * 0.75) -
      (signals.passportHits * 0.45) -
      (signals.noisyHits * 0.4),
    residence_permits:
      (signals.residencePermitHits * 1.95) +
      (signals.issuanceHits * 0.45) +
      (signals.personalizationHits * 0.2) +
      (signals.borderHits * 0.15) -
      (signals.driverLicenseHits * 1.0) -
      (signals.passportHits * 0.45) -
      (signals.visaHits * 0.25) -
      (signals.noisyHits * 0.55) +
      ((profileByInterest.residence_permits?.score || 0) * 1.15) +
      (intentByInterest.residence_permits.score || 0),
    drivers_licenses:
      (signals.driverLicenseHits * 1.8) +
      (signals.issuanceHits * 0.4) -
      (signals.passportHits * 0.35),
    visas:
      (signals.visaHits * 1.6) +
      (signals.issuanceHits * 0.55) +
      (signals.borderHits * 0.25) -
      (signals.driverLicenseHits * 1.2) -
      (signals.passportHits * 0.6) -
      (signals.noisyHits * 0.75) +
      ((profileByInterest.visas?.score || 0) * 0.9) +
      (intentByInterest.visas.score || 0),
    polycarbonate:
      (signals.polycarbonateHits * 1.85) +
      (signals.idCardHits * 0.3) +
      (signals.passportHits * 0.2) -
      (signals.driverLicenseHits * 0.8),
    fraud:
      (signals.fraudHits * 1.8) +
      (signals.primaryContextHits * 0.2) -
      (signals.driverLicenseHits * 0.95) -
      (signals.noisyHits * 0.45) +
      ((profileByInterest.fraud?.score || 0) * 1.0),
    icao:
      (signals.icaoHits * 2.0) +
      (signals.passportHits * 0.2) +
      (signals.borderHits * 0.5) -
      (signals.driverLicenseHits * 1.05) -
      (signals.noisyHits * 0.85) +
      ((profileByInterest.icao?.score || 0) * 1.05) +
      (intentByInterest.icao.score || 0),
    border_control:
      (signals.borderHits * 1.85) +
      (signals.icaoHits * 0.35) +
      (signals.passportHits * 0.2) -
      (signals.noisyHits * 0.6) +
      ((profileByInterest.border_control?.score || 0) * 1.2) +
      (intentByInterest.border_control.score || 0),
    issuance:
      (signals.issuanceHits * 1.75) +
      (signals.passportHits * 0.2) +
      (signals.idCardHits * 0.2) +
      (signals.visaHits * 0.2) -
      (signals.driverLicenseHits * 0.8) -
      (signals.noisyHits * 0.35) +
      ((profileByInterest.issuance?.score || 0) * 1.0),
    laminate:
      (signals.laminateHits * 1.8) +
      (signals.polycarbonateHits * 0.35) +
      (signals.passportHits * 0.2) +
      (signals.idCardHits * 0.2) -
      (signals.driverLicenseHits * 0.8) -
      (signals.noisyHits * 0.35),
  };

  return { signals, intentByInterest, profileByInterest, scoreByInterest };
}

function computeIdentityInterestAssessment(article, subgroupId) {
  const subgroup = IDENTITY_SUBGROUPS[subgroupId];
  const context = buildContext(article);
  const domainContext = getDomainContextProfile(context, "identity_documents");
  const authority = getIdentityDocumentSourceAuthority(article);
  const recency = getIdentityRecencyAdjustment(article);
  const core = computeSubinterestCore(article);
  const contextHaystack = `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`;
  const strongMatches = matchedKeywords(contextHaystack, subgroup.strong);
  const weakMatches = matchedKeywords(contextHaystack, subgroup.weak);
  const focusMatches = matchedKeywords(contextHaystack, subgroup.focus);
  const bridgeMatches = matchedKeywords(contextHaystack, subgroup.bridge);

  const currentCoreScore = Number(core.scoreByInterest[subgroupId] || 0);
  const strongestOther = Object.entries(core.scoreByInterest)
    .filter(([interestId]) => interestId !== subgroupId)
    .sort((left, right) => right[1] - left[1])[0] || ["", 0];
  const mismatchPenalty = Math.max(0, Number(strongestOther[1]) - currentCoreScore);

  let score = domainContext.score * 0.65;
  score += (countBoostKeywordMatches(context.titleText, subgroup.strong) * 5.5) +
    (countBoostKeywordMatches(context.tagText, subgroup.strong) * 4.5) +
    (countBoostKeywordMatches(context.metadataText, subgroup.strong) * 3.5) +
    (countBoostKeywordMatches(context.bodyText, subgroup.strong) * 1.5);
  score += (countBoostKeywordMatches(context.titleText, subgroup.weak) * 1.5) +
    (countBoostKeywordMatches(context.tagText, subgroup.weak) * 1.5) +
    (countBoostKeywordMatches(context.metadataText, subgroup.weak) * 1.0) +
    (countBoostKeywordMatches(context.bodyText, subgroup.weak) * 0.35);

  if (contextMatchesSpecialistSource(context, "identity_documents")) {
    score += 10;
  }

  score += Math.min(80, Math.round(core.signals.primaryContextHits * 0.9));
  score += authority.boost;
  score += recency.boost;
  score -= Math.min(90, Math.round(core.signals.noisyHits * 0.8));
  score += Math.max(-120, Math.round(currentCoreScore));
  score -= Math.min(110, Math.round(mismatchPenalty));

  if (subgroupId === "passports") {
    score += Math.min(90, Math.round((core.signals.passportHits * 0.7) + ((core.intentByInterest.passports?.score || 0) * 1.1)));
    score -= Math.min(160, Math.round(core.signals.driverLicenseHits * 0.9));
    score -= Math.min(80, Math.round(core.signals.visaHits * 0.35));
  } else if (subgroupId === "id_cards") {
    score += Math.min(90, Math.round(core.signals.idCardHits * 1.25));
    score -= Math.min(45, Math.round(core.signals.passportHits * 0.35));
  } else if (subgroupId === "residence_permits") {
    score += Math.min(110, Math.round((core.signals.residencePermitHits * 1.35) + ((core.intentByInterest.residence_permits?.score || 0) * 0.9)));
    score -= Math.min(180, Math.round(core.signals.driverLicenseHits * 1.0));
    score -= Math.min(60, Math.round(core.signals.visaHits * 0.3));
  } else if (subgroupId === "drivers_licenses") {
    score += Math.min(90, Math.round(core.signals.driverLicenseHits * 1.35));
  } else if (subgroupId === "polycarbonate") {
    score += Math.min(100, Math.round(core.signals.polycarbonateHits * 1.5));
  } else if (subgroupId === "fraud") {
    score += Math.min(100, Math.round(core.signals.fraudHits * 1.45));
  } else if (subgroupId === "icao") {
    score += Math.min(120, Math.round((core.signals.icaoHits * 1.5) + ((core.intentByInterest.icao?.score || 0) * 0.9)));
  } else if (subgroupId === "border_control") {
    score += Math.min(220, Math.round((core.signals.borderHits * 0.7) + ((core.profileByInterest.border_control?.score || 0) * 1.2)));
  } else if (subgroupId === "visas") {
    score += Math.min(120, Math.round((core.signals.visaHits * 1.45) + ((core.intentByInterest.visas?.score || 0) * 1.0)));
    score -= Math.min(200, Math.round(core.signals.driverLicenseHits * 1.1));
    score -= Math.min(90, Math.round(core.signals.passportHits * 0.45));
  } else if (subgroupId === "issuance") {
    score += Math.min(95, Math.round(core.signals.issuanceHits * 1.45));
  } else if (subgroupId === "laminate") {
    score += Math.min(95, Math.round(core.signals.laminateHits * 1.5));
  }

  score -= domainContext.excludedHits * 10;
  score = Math.max(0, Math.round(score));

  const intent = core.intentByInterest[subgroupId] || { matchedStrong: [], matchedWeak: [], matchedNegative: [] };
  const profile = core.profileByInterest[subgroupId] || { matchedStrong: [], matchedMedium: [], matchedWeak: [], matchedNegative: [] };

  const directMatch =
    strongMatches.length > 0 ||
    intent.matchedStrong.length > 0 ||
    profile.matchedStrong.length > 0 ||
    (weakMatches.length > 0 && score >= 18);
  const hybridMatch =
    !directMatch &&
    score >= 18 &&
    domainContext.score >= 7 &&
    (weakMatches.length > 0 || focusMatches.length > 0 || bridgeMatches.length > 0 || intent.matchedWeak.length > 0 || profile.matchedMedium.length > 0);
  const included = score >= 18 && (directMatch || hybridMatch);

  return {
    subgroupId,
    label: subgroup.label,
    score,
    included,
    directMatch,
    hybridMatch,
    domainScore: domainContext.score,
    coreScore: Math.round(currentCoreScore),
    mismatchPenalty: Math.round(mismatchPenalty),
    strongMatches,
    weakMatches,
    focusMatches,
    bridgeMatches,
    intent,
    profile,
  };
}

function chooseTopRows(rows, limit = 20) {
  return rows
    .slice()
    .sort((left, right) => {
      if (Number(right.directMatch) !== Number(left.directMatch)) {
        return Number(right.directMatch) - Number(left.directMatch);
      }
      if ((right.focusMatches?.length || 0) !== (left.focusMatches?.length || 0)) {
        return (right.focusMatches?.length || 0) - (left.focusMatches?.length || 0);
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return new Date(right.pubDate).getTime() - new Date(left.pubDate).getTime();
    })
    .slice(0, limit);
}

function determineFalsePositive(subgroupId, record, allAssessments) {
  if (!record.included) {
    return { likelyFalsePositive: false, reason: "" };
  }

  const competitors = Object.entries(allAssessments)
    .filter(([otherId, other]) => otherId !== subgroupId && other.included)
    .map(([otherId, other]) => ({ subgroupId: otherId, assessment: other }))
    .sort((left, right) => right.assessment.score - left.assessment.score);

  const strongestOther = competitors[0];
  const ownEvidenceScore =
    (record.focusMatches.length * 4) +
    (record.strongMatches.length * 3) +
    (record.intent.matchedStrong.length * 3) +
    (record.profile.matchedStrong.length * 3) +
    (record.bridgeMatches.length * 2) +
    record.weakMatches.length;
  const otherEvidenceScore = strongestOther
    ? (strongestOther.assessment.focusMatches.length * 4) +
      (strongestOther.assessment.strongMatches.length * 3) +
      (strongestOther.assessment.intent.matchedStrong.length * 3) +
      (strongestOther.assessment.profile.matchedStrong.length * 3) +
      (strongestOther.assessment.bridgeMatches.length * 2) +
      strongestOther.assessment.weakMatches.length
    : 0;

  if (!record.directMatch && ownEvidenceScore <= 1) {
    return { likelyFalsePositive: true, reason: "weak_identity_document_evidence" };
  }
  if (
    strongestOther &&
    strongestOther.assessment.score >= record.score + 30 &&
    otherEvidenceScore >= ownEvidenceScore + 3
  ) {
    return { likelyFalsePositive: true, reason: `looks_more_like_${strongestOther.subgroupId}` };
  }
  if (subgroupId === "visas" && record.focusMatches.length === 0 && record.intent.matchedStrong.length === 0 && record.bridgeMatches.includes("travel authorization")) {
    return { likelyFalsePositive: true, reason: "travel_authorization_only" };
  }
  if (subgroupId === "fraud" && record.strongMatches.length === 0 && record.intent?.matchedStrong?.length === 0 && record.profile?.matchedStrong?.length === 0) {
    return { likelyFalsePositive: true, reason: "generic_fraud_only" };
  }
  return { likelyFalsePositive: false, reason: "" };
}

async function loadArticles(client) {
  const result = await client.query(
    `
      SELECT
        id,
        title,
        link,
        "canonicalLink",
        source,
        "feedName",
        topic,
        summary,
        "summaryShort",
        "contentSnippet",
        coalesce(array_to_string(keywords, ' '), '') as keywords,
        "pubDate",
        "createdAt"
      FROM articles
      ORDER BY "createdAt" DESC
      LIMIT $1
    `,
    [articleLimit]
  );

  return result.rows;
}

function summarizeDomains(rows = []) {
  const counts = new Map();
  rows.forEach((row) => {
    const domain = getHostname(row.link) || getHostname(row.canonicalLink) || row.source || "unknown";
    counts.set(domain, (counts.get(domain) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([domain, count]) => `${domain} (${count})`)
    .join(", ");
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "identity-subgroup-diagnostics",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadArticles(client);
    const candidateArticles = articles.filter((article) => getApproximateDominantDomain(article) === "identity_documents");

    const subgroupResults = new Map();
    Object.keys(IDENTITY_SUBGROUPS).forEach((subgroupId) => subgroupResults.set(subgroupId, []));
    const overlapHighlights = new Map(HIGHLIGHT_PAIRS.map(([left, right, label]) => [label, []]));
    const fraudSpread = [];

    candidateArticles.forEach((article) => {
      const assessments = Object.fromEntries(
        Object.keys(IDENTITY_SUBGROUPS).map((subgroupId) => [subgroupId, computeIdentityInterestAssessment(article, subgroupId)])
      );

      Object.entries(assessments).forEach(([subgroupId, assessment]) => {
        if (!assessment.included) {
          return;
        }

        const overlaps = Object.entries(assessments)
          .filter(([otherId, otherAssessment]) => otherId !== subgroupId && otherAssessment.included)
          .map(([otherId]) => otherId);
        const falsePositive = determineFalsePositive(subgroupId, assessment, assessments);
        subgroupResults.get(subgroupId).push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          pubDate: article.pubDate,
          link: article.link || "",
          score: assessment.score,
          domainScore: assessment.domainScore,
          matchType: assessment.directMatch ? "direct" : assessment.hybridMatch ? "hybrid" : "other",
          directMatch: assessment.directMatch,
          hybridMatch: assessment.hybridMatch,
          strongMatches: assessment.strongMatches,
          weakMatches: assessment.weakMatches,
          focusMatches: assessment.focusMatches,
          bridgeMatches: assessment.bridgeMatches,
          intentStrong: assessment.intent.matchedStrong,
          intentWeak: assessment.intent.matchedWeak,
          profileStrong: assessment.profile.matchedStrong,
          profileMedium: assessment.profile.matchedMedium,
          overlaps,
          likelyFalsePositive: falsePositive.likelyFalsePositive,
          falsePositiveReason: falsePositive.reason,
          allAssessments: assessments,
        });
      });

      HIGHLIGHT_PAIRS.forEach(([leftId, rightId, label]) => {
        if (assessments[leftId]?.included && assessments[rightId]?.included) {
          overlapHighlights.get(label).push({
            title: article.title || "",
            source: article.source || article.feedName || "",
            link: article.link || "",
            [leftId]: assessments[leftId].score,
            [rightId]: assessments[rightId].score,
            leftEvidence: [
              ...assessments[leftId].strongMatches,
              ...assessments[leftId].focusMatches,
              ...assessments[leftId].intent.matchedStrong,
            ].slice(0, 5),
            rightEvidence: [
              ...assessments[rightId].strongMatches,
              ...assessments[rightId].focusMatches,
              ...assessments[rightId].intent.matchedStrong,
            ].slice(0, 5),
          });
        }
      });

      const fraudAssessment = assessments.fraud;
      if (fraudAssessment.included) {
        fraudSpread.push({
          title: article.title || "",
          source: article.source || article.feedName || "",
          overlaps: Object.entries(assessments)
            .filter(([otherId, other]) => otherId !== "fraud" && other.included)
            .map(([otherId]) => otherId),
          score: fraudAssessment.score,
          evidence: [
            ...fraudAssessment.strongMatches,
            ...fraudAssessment.focusMatches,
            ...fraudAssessment.profile.matchedStrong,
          ].slice(0, 6),
        });
      }
    });

    await client.query("COMMIT");

    console.log("\n=== Identity Documents Subgroup Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      identity_candidate_pool: candidateArticles.length,
      subgroup_scope: Object.values(IDENTITY_SUBGROUPS).map((subgroup) => subgroup.label).join(", "),
    }]));

    const summaryRows = Object.entries(IDENTITY_SUBGROUPS).map(([subgroupId, subgroup]) => {
      const rows = subgroupResults.get(subgroupId) || [];
      const directCount = rows.filter((row) => row.directMatch).length;
      const hybridCount = rows.filter((row) => row.hybridMatch).length;
      const overlapCount = rows.filter((row) => row.overlaps.length > 0).length;
      const falsePositiveCount = rows.filter((row) => row.likelyFalsePositive).length;

      return {
        subgroup: subgroup.label,
        subgroup_id: subgroupId,
        total_count: rows.length,
        direct_match_count: directCount,
        hybrid_match_count: hybridCount,
        overlap_count: overlapCount,
        likely_false_positives: falsePositiveCount,
      };
    });

    console.log("\n=== Summary ===");
    console.table(formatRows(summaryRows));

    Object.entries(IDENTITY_SUBGROUPS).forEach(([subgroupId, subgroup]) => {
      const rows = subgroupResults.get(subgroupId) || [];
      const topRows = chooseTopRows(rows);

      console.log(`\n=== ${subgroup.label} ===`);
      console.table(formatRows(topRows.map((row) => ({
        title: row.title,
        source: row.source,
        match_type: row.matchType,
        score: row.score,
        overlap_with: row.overlaps,
        likely_false_positive: row.likelyFalsePositive,
        false_positive_reason: row.falsePositiveReason,
        match_reasons: [
          ...row.strongMatches,
          ...row.focusMatches,
          ...row.intentStrong,
          ...row.profileStrong,
          ...row.bridgeMatches,
        ].slice(0, 8),
      }))));
    });

    console.log("\n=== Highlighted Overlaps ===");
    HIGHLIGHT_PAIRS.forEach(([leftId, rightId, label]) => {
      const rows = overlapHighlights.get(label) || [];
      console.log(`\n--- ${label} ---`);
      console.table(formatRows(rows.slice(0, 20)));
    });

    console.log("\n--- Fraud articles appearing everywhere ---");
    console.table(formatRows(
      fraudSpread
        .filter((row) => row.overlaps.length >= 3)
        .slice(0, 20)
    ));

    const worstPrecision = summaryRows
      .slice()
      .sort((left, right) => {
        const leftRatio = left.total_count ? left.likely_false_positives / left.total_count : 0;
        const rightRatio = right.total_count ? right.likely_false_positives / right.total_count : 0;
        return rightRatio - leftRatio;
      })[0];
    const highestOverlap = summaryRows
      .slice()
      .sort((left, right) => {
        const leftRatio = left.total_count ? left.overlap_count / left.total_count : 0;
        const rightRatio = right.total_count ? right.overlap_count / right.total_count : 0;
        return rightRatio - leftRatio;
      })[0];
    const optimizeFirst = summaryRows
      .slice()
      .sort((left, right) => {
        const leftScore = (left.total_count ? left.likely_false_positives / left.total_count : 0) + (left.total_count ? left.overlap_count / left.total_count : 0);
        const rightScore = (right.total_count ? right.likely_false_positives / right.total_count : 0) + (right.total_count ? right.overlap_count / right.total_count : 0);
        return rightScore - leftScore;
      })[0];

    console.log("\n=== Diagnostic Conclusions ===");
    console.table(formatRows([{
      worst_precision_subgroup: worstPrecision?.subgroup || "",
      worst_precision_ratio: worstPrecision?.total_count ? (worstPrecision.likely_false_positives / worstPrecision.total_count).toFixed(2) : "0.00",
      highest_overlap_subgroup: highestOverlap?.subgroup || "",
      highest_overlap_ratio: highestOverlap?.total_count ? (highestOverlap.overlap_count / highestOverlap.total_count).toFixed(2) : "0.00",
      optimize_first: optimizeFirst?.subgroup || "",
      optimize_first_reason: optimizeFirst
        ? `high false-positive and overlap pressure; top domains: ${summarizeDomains(subgroupResults.get(optimizeFirst.subgroup_id) || [])}`
        : "",
    }]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors during diagnostics.
    }
    console.error("Failed to run identity subgroup diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
