const PLACEHOLDER_IMAGE = "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image";
const THEME_STORAGE_KEY = "rss-monitor-theme";
const FEED_PANEL_COLLAPSED_STORAGE_KEY = "feedPanelCollapsed";
const ALERT_SNAPSHOT_STORAGE_KEY = "prevSnapshot";
const ALERT_DEDUPE_STORAGE_KEY = "recentAlertKeys";
const ALERT_ARTICLE_FILTER_STORAGE_KEY = "activeAlertArticleFilter";
const ACTIVITY_LOG_STORAGE_KEY = "dashboardActivityLog";
const ALERT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const ACTIVITY_LOG_TTL_MS = 24 * 60 * 60 * 1000;
const POLLING_INTERVAL_MS = 60 * 60 * 1000;
const AUTO_REFRESH_MODE_STORAGE_KEY = "dashboardAutoRefreshMode";
const AUTO_REFRESH_MODE =
  typeof localStorage !== "undefined" &&
  localStorage.getItem(AUTO_REFRESH_MODE_STORAGE_KEY) === "off"
    ? "off"
    : "hourly";
const REFRESH_INTERACTION_PAUSE_MS = 6000;
const REFRESH_SCROLL_PAUSE_MS = 5000;
const ARTICLE_PAGE_SIZE = 400;
const NOTIFICATION_TIMEOUT_MS = 7000;
const DEBUG_INTELLIGENCE = false;
const DEBUG_FEED_FILTER = false;
const DEBUG_PERFORMANCE = false;
const DEBUG_PERSONAL_DASHBOARD =
  typeof localStorage !== "undefined" &&
  localStorage.getItem("DEBUG_PERSONAL_DASHBOARD") === "true";
const HARD_SUBINTEREST_MISMATCH_THRESHOLD = 12;
const MAX_ARTICLES_IN_MEMORY = 1500;
const MAX_VISIBLE_SOURCES_IN_LIST = 100;
const MAX_RSS_FEEDS = 300;
const MAX_RSS_FEEDS_MESSAGE = `Maximum of ${MAX_RSS_FEEDS} RSS feeds reached`;
const FEED_FORM_HELPER_TEXT = `Monitor up to ${MAX_RSS_FEEDS} RSS feeds and websites.`;

function debugIntelligenceLog(label, payload) {
  if (DEBUG_INTELLIGENCE) {
    console.info(label, payload);
  }
}

function debugFeedFilterLog(label, payload) {
  if (DEBUG_FEED_FILTER) {
    console.info(label, payload);
  }
}

function debugFeedFilterWarn(label, payload) {
  if (DEBUG_FEED_FILTER) {
    console.warn(label, payload);
  }
}

function debugPerformanceLog(label, payload) {
  if (DEBUG_PERFORMANCE) {
    console.info(label, payload);
  }
}

function debugPersonalDashboardLog(label, payload) {
  if (DEBUG_PERSONAL_DASHBOARD) {
    console.info(label, payload);
  }
}

function normalizeFeedSourceTypeValue(value) {
  const normalizedValue = String(value || "rss").trim().toLowerCase();
  if (normalizedValue === "rss feed") {
    return "rss";
  }
  if (normalizedValue === "website" || normalizedValue === "site") {
    return "website";
  }
  if (normalizedValue === "link-only" || normalizedValue === "link only") {
    return "link-only";
  }
  return normalizedValue || "rss";
}
const APP_BUILD = "pagination-feed-debug-v1";
const SHOW_FEED_INSIGHTS = false;
const SHOW_RECENT_ALERTS = false;
const SHOW_ACTIVITY_LOG = false;
const DASHBOARD_ALERT_LIMIT = 8;
const ACTIVITY_LOG_LIMIT = 24;
const LOW_VALUE_ARTICLE_THRESHOLD = 5;
const SUMMARY_METRICS = [
  { label: "Active feeds", key: "activeFeeds" },
  { label: "Tracked topics", key: "topics" },
  { label: "Articles today", key: "articlesToday" },
  { label: "Latest articles", key: "totalArticles" },
];
const DEFAULT_SOURCE_GROUPS = ["USA", "Canada", "Google Alerts", "Other"];
const TAG_FILTER_MIN_COUNT = 0;
const ARTICLE_RENDER_PAGE_SIZE = 30;
const TAG_LIST_STORAGE_KEY = "dashboardTagList";
const KEYWORD_FILTER_STORAGE_KEY = "dashboardKeywordFilters";
const PERSONAL_DASHBOARD_INTERESTS_STORAGE_KEY = "personalDashboardInterests";
const PERSONAL_DASHBOARD_MODE_STORAGE_KEY = "personalDashboardMode";
const DEFAULT_PERSONAL_DASHBOARD_SORT = "newest";
const NOISE_KEYWORDS_EXPANDED_STORAGE_KEY = "noiseKeywordsExpanded";
const PERSONAL_DASHBOARD_MODES = {
  strict: 1.8,
  balanced: 1.0,
  broad: 0.5,
};
const PERSONAL_DASHBOARD_GENERIC_INTEREST_IDS = new Set(["rollout", "release", "issuance", "redesign"]);
const DIGITAL_SUBGROUP_BASELINE_MINIMUM_SCORE = 18;
const DIGITAL_SUBGROUP_HYBRID_FILTERS = {
  digital_identity: {
    minimumDomainScore: 10,
    minimumInterestScore: 20,
    related: ["identity verification", "mobile id", "electronic identity", "eid", "eudi wallet", "identity wallet"],
  },
  biometrics: {
    minimumDomainScore: 10,
    minimumInterestScore: 20,
    related: ["face verification", "face authentication", "liveness", "presentation attack", "fingerprint", "iris"],
  },
  eid: {
    minimumDomainScore: 12,
    minimumInterestScore: 22,
    related: ["eudi wallet", "electronic identification", "identity wallet", "digital credential", "eidas", "trust service"],
    preferred: [
      "eid",
      "e-id",
      "electronic identity",
      "national identity system",
      "digital identity card",
      "citizen identity",
      "national digital identity",
      "eidas",
      "eidas 2",
      "aadhaar",
      "mitid",
      "austria id",
      "bundid",
      "vneid",
      "gov.uk one login",
      "national identity framework",
      "sovereign identity",
      "sovereign identity program",
      "sovereign identity programmes",
    ],
    cross: [
      "digital wallet",
      "identity wallet",
      "mobile wallet",
      "wallet ecosystem",
      "wallet interoperability",
      "wallet credential",
      "verifiable credential wallet",
      "wallet rollout",
      "wallet procurement",
      "wallet adoption",
      "wallet framework",
    ],
    minimumPreferredHits: 1,
    minimumNetEvidence: 1,
  },
  digital_wallet: {
    minimumDomainScore: 12,
    minimumInterestScore: 22,
    related: ["eudi wallet", "identity wallet", "wallet issuer", "wallet framework", "verifiable credential", "mdoc"],
    preferred: [
      "digital wallet",
      "identity wallet",
      "eudi wallet",
      "mobile wallet",
      "wallet ecosystem",
      "wallet interoperability",
      "wallet credential",
      "verifiable credential wallet",
      "wallet rollout",
      "wallet procurement",
      "wallet adoption",
      "wallet implementation",
      "wallet deployment",
    ],
    cross: [
      "national identity system",
      "digital identity card",
      "citizen identity",
      "national digital identity",
      "electronic identity",
      "eidas",
      "eidas 2",
      "aadhaar",
      "mitid",
      "austria id",
      "bundid",
      "vneid",
      "gov.uk one login",
      "national identity framework",
      "sovereign identity",
    ],
    minimumPreferredHits: 1,
    minimumNetEvidence: 1,
  },
  kyc: {
    minimumDomainScore: 12,
    minimumInterestScore: 24,
    related: [
      "aml",
      "aml/kyc",
      "customer due diligence",
      "cdd",
      "regulated onboarding",
      "banking verification",
      "fintech compliance",
      "sanctions screening",
      "financial crime",
      "regulatory compliance",
      "banking compliance",
    ],
    preferred: [
      "kyc",
      "know your customer",
      "aml",
      "anti-money laundering",
      "aml/kyc",
      "customer due diligence",
      "cdd",
      "sanctions screening",
      "financial crime",
      "regulatory compliance",
      "banking compliance",
      "fintech compliance",
      "regulated onboarding",
    ],
    cross: [
      "idv",
      "identity verification",
      "document verification",
      "identity proofing",
      "remote identity proofing",
      "proof of identity",
      "document and face verification",
      "face verification",
    ],
    minimumPreferredHits: 1,
    minimumNetEvidence: 1,
  },
  onboarding: {
    minimumDomainScore: 12,
    minimumInterestScore: 22,
    related: ["remote onboarding", "customer onboarding", "account opening", "identity proofing", "kyc onboarding"],
  },
  liveness: {
    minimumDomainScore: 12,
    minimumInterestScore: 22,
    related: ["presentation attack", "anti-spoofing", "anti spoofing", "spoof detection", "face verification"],
  },
  artificial_intelligence: {
    minimumDomainScore: 10,
    minimumInterestScore: 20,
    related: ["machine learning", "generative ai", "ai-powered", "ai powered", "deepfake", "synthetic identity"],
  },
  identity_verification: {
    minimumDomainScore: 11,
    minimumInterestScore: 20,
    related: ["document verification", "id verification", "identity proofing", "proof of identity", "idv"],
  },
  authentication: {
    minimumDomainScore: 11,
    minimumInterestScore: 20,
    related: ["passkey", "fido", "login", "multi-factor", "multi factor", "mfa", "access management"],
  },
};
const SPECIALIST_SOURCE_INTERESTS = {
  banknotes: [
    "banknotenews",
    "banknotenews.com",
    "notafilia",
    "notafilia.pt",
    "mriguide",
    "mriguide.com",
    "currency-news",
    "currency-news.com",
    "reform.news",
    "de la rue",
    "de-la-rue",
    "giesecke+devrient",
    "giesecke devrient",
    "gi-de",
    "crane currency",
    "cranecurrency",
    "koenig & bauer",
    "koenig-bauer",
    "oberthur",
    "louisenthal",
    "security document world",
    "securitydocumentworld",
  ],
  identity_documents: [
    "icao",
    "keesing",
    "biometric update",
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
    "ovd kinegram",
    "de la rue",
    "giesecke+devrient",
    "crane authentication",
    "passport office",
    "state department",
    "immigration authority",
    "ministry of interior",
    "secure document",
    "dmv",
    "driver license agency",
  ],
  digital_identity_biometrics: ["biometric update", "digital identity", "authentication", "identity verification"],
  security_printing: ["security printing", "security printer", "secure documents", "holography"],
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
    "crane currency",
    "ukvi biometric residence permits",
    "ukvi brp and brc guidance",
    "ukvi",
    "home office",
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
  medium: [
    "reuters",
    "associated press",
    "ap news",
    "bbc",
    "press agency",
    "official news agency",
  ],
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
const IDENTITY_PROFILE_SOURCE_PRIORITY = {
  icao: {
    strong: ["icao newsroom", "icao trip", "icao.int"],
    medium: ["biometric update", "keesing", "security document world", "securitydocumentworld"],
  },
  residence_permits: {
    strong: [
      "ukvi biometric residence permits",
      "ukvi brp and brc guidance",
      "gov.uk/biometric-residence-permits",
      "gov.uk/government/publications/biometric-residence-permits-guidance",
      "ind.nl",
      "migrationsverket.se",
      "migrationsverket residence permit cards",
      "dutch ind residence updates",
      "gov.uk",
      "homeoffice.gov.uk",
      "valtioneuvosto.fi",
      "island.is",
      "mzv.gov.cz",
    ],
    medium: [
      "ukvi",
      "home office",
      "ind.nl",
      "ind residence",
      "migrationsverket",
      "gov.uk",
      "homeoffice.gov.uk",
      "valtioneuvosto.fi",
      "island.is",
      "mzv.gov.cz",
      "interior ministry",
      "migration agency",
      "migration authority",
      "immigration authority",
      "immigration service",
      "immigration department",
      "government permit issuer",
    ],
  },
  border_control: {
    strong: [
      "eu-lisa",
      "eulisa",
      "cbp newsroom",
      "cbp",
      "mobile passport control",
      "frontex",
      "veridos",
      "regula",
      "biometric update",
      "security document world",
      "keesing",
      "icao",
      "vision-box",
      "visionbox",
      "idemia",
      "thales",
      "passenger terminal today",
      "international airport review",
      "sita",
    ],
    medium: [
      "border police",
      "border agency",
      "customs and border protection",
      "government border agency",
      "government border authority",
      "passport control authority",
      "border management agency",
      "amadeus",
      "document reader",
      "passport reader",
    ],
  },
};
const IDENTITY_PROFILE_SOFT_NOISE_TERMS = {
  passports: [
    "travel rankings",
    "passport rankings",
    "most powerful passport",
    "visa-free destinations",
    "best destinations",
    "vacation",
    "holiday",
    "tourism",
    "travel guide",
    "passport to paradise",
    "passport to leadership",
    "travel passport",
  ],
  residence_permits: [
    "golden visa guide",
    "digital nomad visa guide",
    "investor visa guide",
    "golden visa",
    "investor visa",
    "digital nomad visa",
    "student visa guide",
    "work visa guide",
    "tourist visa",
    "travel visa",
    "visa requirements",
    "immigration advice",
    "how to move to",
    "expat guide",
    "generic visa guide",
    "seo visa",
    "travel guide",
    "tourism",
    "vacation",
    "holiday",
    "visa agency",
    "immigration lawyer",
  ],
  border_control: [
    "holiday",
    "vacation",
    "tourism",
    "tourist",
    "travel tips",
    "travel guide",
    "best destinations",
    "airport delays",
    "airport delay",
    "missed flight",
    "long queues",
    "long queue",
    "holidaymakers",
    "cruise passengers",
    "ferry passengers",
    "travel chaos",
    "airline boss",
    "arrive three hours before flight",
    "customs wait times",
    "customs wait time",
    "tourist arrested",
    "tourist banned",
    "traveler damages gate",
    "traveller damages gate",
    "traveler incident",
    "traveller incident",
    "passenger incident",
    "airport incident",
    "airport disturbance",
    "immigration gate vandalism",
  ],
};
const IDENTITY_PROFILE_STRONG_CONTEXT_TERMS = {
  passports: [
    "icao",
    "doc 9303",
    "passport issuance",
    "passport verification",
    "passport fraud",
    "biometric passport",
    "passport chip",
    "secure document",
    "document security",
  ],
  residence_permits: [
    "residence permit card",
    "residence card",
    "biometric residence card",
    "biometric residence permit",
    "brp",
    "brc",
    "permit card",
    "epermit",
    "electronic residence permit",
    "foreign resident card",
    "permanent residence permit card",
    "temporary residence permit card",
    "renew residence permit card",
    "collect residence permit card",
    "issue residence permit card",
    "residence permit renewal",
    "residence permit issuance",
    "permit personalization",
    "permit document",
    "secure residence document",
    "immigration card",
    "residence document",
    "permit issuance",
    "permit verification",
    "document verification",
  ],
  icao: [
    "icao",
    "doc 9303",
    "pkd",
    "digital travel credential",
    "dtc",
    "mrz",
    "mrtd",
    "emrtd",
    "chip authentication",
    "active authentication",
    "lds",
  ],
  border_control: [
    "ees",
    "etias",
    "egate",
    "e-gate",
    "automated border control",
    "mobile passport control",
    "cbp",
    "frontex",
    "eu-lisa",
    "eulisa",
    "document inspection",
    "document verification",
    "border biometrics",
    "facial recognition",
  ],
};
const IDENTITY_WEBSITE_NAV_TITLE_TERMS = [
  "home",
  "projects",
  "downloads",
  "download",
  "support",
  "careers",
  "career",
  "jobs",
  "vacancies",
  "contact",
  "contact us",
  "about us",
  "imprint",
  "privacy",
  "privacy policy",
  "cookie policy",
  "terms",
  "legal",
  "sitemap",
  "search",
  "login",
  "register",
];
const IDENTITY_WEBSITE_NAV_URL_SEGMENTS = [
  "/careers/",
  "/jobs/",
  "/support/",
  "/download/",
  "/downloads/",
  "/contact/",
  "/privacy/",
  "/imprint/",
  "/legal/",
  "/terms/",
  "/login/",
  "/sitemap/",
];
const IDENTITY_WEBSITE_MARKETING_TITLE_TERMS = [
  "solutions",
  "products",
  "portfolio",
  "capabilities",
  "services",
  "offerings",
  "identity management",
  "physical documents",
  "document readers",
];
const IDENTITY_WEBSITE_MARKETING_URL_SEGMENTS = [
  "/product/",
  "/solutions/",
  "/solution/",
  "/products/",
  "/platform/",
  "/portfolio/",
  "/capabilities/",
  "/services/",
  "/offerings/",
  "/identity-management/",
  "/physical-documents/",
  "/document-readers/",
];
const BORDER_CONTROL_NEWS_URL_SEGMENTS = [
  "/news/",
  "/media/",
  "/press/",
  "/press-release/",
  "/announcement/",
  "/blog/",
];
const BORDER_CONTROL_NEWS_SIGNAL_TERMS = [
  "launch",
  "launched",
  "launching",
  "rollout",
  "rolled out",
  "rolling out",
  "deployment",
  "deployed",
  "deploying",
  "implementation",
  "implemented",
  "implementing",
  "contract",
  "award",
  "awarded",
  "procurement",
  "partnership",
  "agreement",
  "collaboration",
  "pilot",
  "trial",
  "expansion",
  "expands",
  "expanded",
  "upgrade",
  "upgraded",
  "modernization",
  "announce",
  "announced",
  "announcing",
  "opens",
  "opening",
  "opened",
  "operational",
  "production",
  "installed",
  "commissioned",
  "announcement",
  "press release",
  "news release",
  "media release",
];
const BORDER_CONTROL_NEWS_CONTEXT_TERMS = [
  "egate deployment",
  "abc deployment",
  "automated border control",
  "mobile passport control",
  "mpc rollout",
  "ees rollout",
  "etias rollout",
  "frontex update",
  "cbp announcement",
  "eu-lisa implementation",
  "document verification deployment",
  "passport inspection deployment",
  "border biometrics deployment",
  "border management system",
  "document inspection",
  "passport verification",
];
const BORDER_CONTROL_PRODUCT_PAGE_TERMS = [
  "document readers",
  "document reader",
  "manual devices",
  "verification devices",
  "identity verification devices",
  "biometric verification software",
  "identity management",
  "self-kiosks",
  "solutions",
  "products",
  "portfolio",
  "services",
  "capabilities",
  "offerings",
  "product family",
  "platform",
  "border management solutions",
];
const BORDER_CONTROL_VENDOR_SOURCE_TERMS = [
  "regula",
  "veridos",
  "idemia",
  "thales",
  "vision-box",
  "visionbox",
];
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
    hardNegative: [
      "passport ranking",
      "tourism",
      "travel destination",
      "passport beauty",
      "travel lifestyle",
      "vacation",
      "airport hotel",
    ],
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
    strongPositive: [
      "icao",
      "doc 9303",
      "mrz",
      "emrtd",
      "travel document standards",
      "machine readable",
      "border interoperability",
      "passport chip",
      "mrtd",
    ],
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
      "seamless border crossing",
      "self-service border kiosk",
      "automated immigration control",
      "regula",
      "veridos",
      "idemia",
      "thales",
      "vision-box",
      "visionbox",
    ],
    weakPositive: [
      "border control",
      "passport control",
      "immigration control",
      "document inspection",
      "border security",
    ],
    hardNegative: [
      "airport delays",
      "airport delay",
      "flight delays",
      "travel chaos",
      "holidaymakers",
      "tourism disruption",
      "customs waiting times",
      "customs wait times",
      "customs wait time",
      "longest queues",
      "long queue",
      "long queues",
      "airport congestion",
      "travel tips",
      "airline advice",
      "arrive early",
      "busiest travel days",
      "tourism forecasts",
      "tourist arrested",
      "tourist banned",
      "traveler damages gate",
      "traveller damages gate",
      "traveler incident",
      "traveller incident",
      "passenger incident",
      "airport incident",
      "airport disturbance",
      "immigration gate vandalism",
    ],
  },
};
const IDENTITY_INTELLIGENCE_PROFILES = {
  id_cards: {
    strongPositive: [
      "identity card",
      "id card",
      "national id",
      "electronic identity card",
      "hybrid id documents",
      "national identity guard",
      "identity document protection",
      "physical identity documents",
      "national id documents",
      "polycarbonate id",
      "czech id",
    ],
    mediumPositive: [
      "identity documents",
      "id documents",
      "secure id documents",
      "physical document",
      "id protection",
      "document protection",
      "security feature",
      "security features",
      "hologram",
      "holograms",
      "ovd",
      "micro optics",
      "anti-counterfeiting",
      "anti-counterfeiting protection",
    ],
    weakPositive: [
      "card issuance",
      "card design",
      "identity card design",
      "optical security features",
    ],
    strongNegative: [
      "digital identity wallet",
      "identity wallet",
      "wallet ecosystem",
      "digital identity conference",
      "authentication platform",
      "kyc platform",
      "biometric onboarding",
      "passport office",
      "travel tips",
    ],
    requiredContextGroups: [
      ["identity card", "id card", "national id", "identity documents", "id documents", "national id documents", "physical identity documents", "czech id", "national identity guard"],
      ["protection", "security feature", "security features", "hologram", "holography", "ovd", "micro optics", "polycarbonate", "anti-counterfeiting", "document protection", "physical document"],
    ],
    authorityBoostSources: [
      "keesing",
      "biometric update",
      "regula",
      "hid",
      "entrust",
      "veridos",
      "bundesdruckerei",
      "idemia",
      "in groupe",
      "thales",
      "laxton",
      "security document world",
      "ovd kinegram",
      "de la rue",
      "giesecke+devrient",
      "iq structures",
      "iqstructures.com",
    ],
  },
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
    requiredContextGroups: [
      ["passport", "travel document"],
      ["epassport", "e-passport", "issuance", "renewal", "office", "security", "verification", "personalization", "chip", "pki", "border", "icao", "fraud", "production", "biometric"],
    ],
    authorityBoostSources: [
      "icao",
      "keesing",
      "biometric update",
      "regula",
      "hid",
      "entrust",
      "veridos",
      "idemia",
      "bundesdruckerei",
      "in groupe",
      "thales",
      "laxton",
      "security document world",
      "ovd kinegram",
      "de la rue",
      "giesecke+devrient",
      "interpol",
      "frontex",
      "eu commission",
      "us state department",
      "passport office",
      "immigration authority",
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
    mediumPositive: [
      "visa processing",
      "consular services",
      "transit system",
      "mobility policy",
      "visa regulation",
      "visa-free agreement",
    ],
    weakPositive: ["visa", "visas", "consular"],
    strongNegative: [
      "travel blog",
      "vacation guide",
      "tour package",
      "cheap flights",
      "hotel deal",
      "travel agency",
      "destination ranking",
      "holiday ideas",
    ],
    requiredContextGroups: [["visa", "consular", "authorization"], ["policy", "issuance", "processing", "agreement", "regulation", "security"]],
    authorityBoostSources: ["keesing", "biometric update", "regula", "security document world", "state department"],
  },
  residence_permits: {
    strongPositive: [
      "residence permit",
      "residence permit card",
      "residency card",
      "resident card",
      "biometric residence permit",
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
    requiredContextGroups: [["permit", "resident", "residence"], ["issuance", "renewal", "card", "biometric", "security", "personalization", "verification", "authority", "fraud", "document"]],
    authorityBoostSources: [
      "keesing",
      "biometric update",
      "regula",
      "hid",
      "thales",
      "veridos",
      "bundesdruckerei",
      "in groupe",
      "security document world",
      "immigration authority",
      "eu commission",
      "interpol",
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
      "immigration enforcement technology",
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
      "ryanair",
      "travel delays",
      "flight delays",
      "passenger complaint",
      "passenger incident",
      "baggage",
      "holiday travel",
      "holidaymakers",
      "tourism frustration",
      "tourism disruption",
      "flight disruption",
      "airport operational chaos",
      "customs waiting times",
      "customs wait times",
      "customs wait time",
      "longest queues",
      "long queue",
      "long queues",
      "airport congestion",
      "travel tips",
      "airline advice",
      "arrive early",
      "busiest travel days",
      "tourism forecasts",
      "travel chaos",
      "tourist arrested",
      "tourist banned",
      "traveler damages gate",
      "traveller damages gate",
      "traveler incident",
      "traveller incident",
      "airport incident",
      "airport disturbance",
      "immigration gate vandalism",
    ],
    requiredContextGroups: [["border", "passport control", "immigration"], ["biometric", "verification", "document", "egate", "ees", "etias", "frontex", "cbp", "facial recognition", "inspection", "automation"]],
    authorityBoostSources: [
      "icao",
      "frontex",
      "cbp",
      "eu-lisa",
      "eulisa",
      "biometric update",
      "keesing",
      "regula",
      "thales",
      "veridos",
      "idemia",
      "security document world",
      "vision-box",
      "visionbox",
      "passenger terminal today",
      "international airport review",
      "sita",
    ],
  },
  icao: {
    strongPositive: ["icao", "doc 9303", "mrtd", "emrtd", "mrz", "machine readable", "icao compliance", "travel document standards"],
    mediumPositive: ["border interoperability", "passport chip", "document verification", "secure traveler verification"],
    weakPositive: ["travel document", "border control"],
    strongNegative: ["tourism", "vacation", "travel ranking", "cheap flights"],
    requiredContextGroups: [["icao", "doc 9303", "mrtd", "emrtd", "mrz"], ["compliance", "standards", "verification", "interoperability", "chip"]],
    authorityBoostSources: ["icao", "keesing", "biometric update", "regula", "security document world"],
  },
  issuance: {
    strongPositive: ["document issuance", "passport issuance", "identity card issuance", "permit issuance", "visa issuance", "secure issuance", "issuance modernization"],
    mediumPositive: ["renewal system", "production system", "enrollment", "personalization", "government issuance system"],
    weakPositive: ["issued", "issuance"],
    strongNegative: ["stock issuance", "bond issuance", "share issuance", "vacation", "travel tips"],
    requiredContextGroups: [["issuance", "issued", "renewal"], ["passport", "identity card", "visa", "permit", "document", "government"]],
    authorityBoostSources: ["keesing", "regula", "hid", "veridos", "bundesdruckerei", "security document world"],
  },
  fraud: {
    strongPositive: ["document fraud", "fake passport", "forged passport", "forged id", "counterfeit id", "permit fraud", "fraudulent issuance"],
    mediumPositive: ["document verification", "identity fraud ring", "secure document fraud", "counterfeit document"],
    weakPositive: ["fraud", "forged document"],
    strongNegative: ["credit card fraud", "insurance fraud", "tax fraud", "romance scam", "cyber fraud software"],
    requiredContextGroups: [["fraud", "forged", "counterfeit", "fake"], ["passport", "document", "id", "permit", "issuance", "verification"]],
    authorityBoostSources: ["regula", "keesing", "biometric update", "security document world", "hid", "thales"],
  },
};
const IDENTITY_DOCUMENT_SECURITY_INDUSTRY_SOURCES = [
  "thales",
  "idemia",
  "veridos",
  "entrust",
  "hid",
  "regula",
  "bundesdruckerei",
  "in groupe",
  "ovd kinegram",
  "keesing",
  "security document world",
  "biometric update",
  "crane authentication",
  "giesecke+devrient",
  "g+d",
  "laxton",
];
const IDENTITY_DOCUMENT_NEGATIVE_SOURCE_TERMS = [
  "travel blog",
  "tourism blog",
  "vacation blog",
  "adventure",
  "sports",
  "lifestyle",
  "entertainment",
];
const IDENTITY_DOCUMENT_HARD_CONTEXT_GATES = {
  passports: {
    severePenalty: 420,
    requiredTerms: [
      "passport",
      "epassport",
      "e-passport",
      "travel document",
      "machine readable travel document",
      "mrtd",
      "emrtd",
    ],
    documentSecurityTerms: [
      "issuance",
      "renewal",
      "application",
      "enrollment",
      "enrolment",
      "biometric",
      "chip",
      "rfid",
      "nfc",
      "icao",
      "doc 9303",
      "verification",
      "authentication",
      "fraud",
      "counterfeit",
      "inspection",
      "border control",
      "identity verification",
      "secure document",
      "passport office",
      "consular service",
      "passport authority",
    ],
    securityProductionTerms: [
      "polycarbonate",
      "laminate",
      "security feature",
      "security features",
      "security printing",
      "hologram",
      "holography",
      "ovd",
      "kinegram",
      "micro optic",
      "micro-optic",
      "micro optics",
      "micro-optics",
      "intaglio",
      "guilloche",
      "laser engraving",
      "laser personalization",
      "laser personalisation",
      "optically variable",
      "optically variable device",
      "colour shift",
      "color shift",
      "substrate",
      "document security",
      "passport production",
      "passport manufacturing",
      "booklet production",
      "personalization centre",
      "personalization center",
      "issuance system",
      "identity infrastructure",
    ],
  },
  residence_permits: {
    severePenalty: 380,
    permitTerms: [
      "residence permit",
      "residence permit card",
      "residence card",
      "resident card",
      "biometric residence permit",
      "foreign resident card",
      "residence document",
      "immigration document",
    ],
    issuanceTerms: [
      "permit issuance",
      "permit renewal",
      "permit production",
      "permit personalisation",
      "permit personalization",
      "permit verification",
      "resident document",
      "immigration card",
    ],
    securityTerms: [
      "polycarbonate",
      "security printing",
      "security feature",
      "hologram",
      "kinegram",
      "ovd",
      "laser engraving",
      "document security",
    ],
  },
  icao: {
    severePenalty: 420,
    requiredTerms: [
      "icao",
      "doc 9303",
      "mrtd",
      "emrtd",
      "epassport",
      "e-passport",
      "pkd",
      "lds",
      "pace",
      "bac",
      "sac",
      "active authentication",
      "chip authentication",
      "digital travel credential",
      "dtc",
      "traveller identification programme",
      "mrz",
    ],
  },
  border_control: {
    severePenalty: 360,
    requiredTerms: [
      "border control",
      "egate",
      "e-gate",
      "abc gate",
      "automated border control",
      "passport control",
      "immigration control",
      "entry exit system",
      "entry/exit system",
      "ees",
      "etias",
      "cbp",
      "frontex",
      "document inspection",
      "border inspection",
      "mobile passport control",
      "mpc",
      "biometric border",
      "facial recognition",
    ],
  },
};
const IDENTITY_REQUIRED_CONTEXT_COMBOS = {
  icao: [
    ["icao", "passport"],
    ["icao", "travel document"],
    ["icao", "mrtd"],
    ["icao", "emrtd"],
    ["icao", "doc 9303"],
    ["icao", "mrz"],
    ["icao", "pkd"],
    ["icao", "dtc"],
    ["icao", "digital travel credential"],
    ["icao", "border interoperability"],
    ["mrz", "passport"],
    ["mrz", "travel document"],
    ["doc 9303"],
    ["mrtd"],
    ["emrtd"],
    ["digital travel credential"],
    ["passport chip", "standard"],
    ["lds", "passport"],
    ["pki", "passport"],
    ["chip authentication", "passport"],
  ],
  border_control: [
    ["border", "biometric"],
    ["border", "egate"],
    ["border", "e-gate"],
    ["border", "automated"],
    ["border", "document verification"],
    ["border", "passport verification"],
    ["border", "facial recognition"],
    ["border", "ees"],
    ["border", "etias"],
    ["border", "frontex"],
    ["border", "cbp"],
    ["border", "traveler verification"],
    ["passport control", "egate"],
    ["passport control", "e-gate"],
    ["passport control", "biometric"],
    ["passport control", "automated"],
    ["passport control", "mobile passport control"],
    ["entry/exit system"],
    ["entry exit system"],
    ["automated border control"],
    ["abc gates"],
    ["abc gate"],
    ["biometric corridor"],
    ["document inspection system"],
    ["border kiosk"],
  ],
  residence_permits: [
    ["residence permit"],
    ["residence card"],
    ["resident card"],
    ["biometric residence permit"],
    ["permit card"],
    ["immigration card"],
    ["foreign resident card"],
    ["residence document"],
    ["permit issuance"],
    ["permit renewal"],
    ["permit verification"],
    ["permit authentication"],
    ["digital residence permit"],
    ["secure residence permit"],
    ["residence permit fraud"],
    ["long-term residence permit"],
    ["long term residence permit"],
    ["temporary residence permit"],
    ["permanent residence permit"],
  ],
};
const IDENTITY_REQUIRED_CONTEXT_STRICT_PENALTIES = {
  icao: 800,
  border_control: 600,
  residence_permits: 700,
};
const IDENTITY_BORDER_CONTROL_TRAVEL_NOISE_TERMS = [
  "airport queue",
  "airport queues",
  "airport delay",
  "airport delays",
  "missed flight",
  "ryanair",
  "passengers waited",
  "travel advice",
  "customs wait times",
  "customs wait time",
  "holiday delays",
  "passenger complaints",
  "passenger incident",
  "airport chaos",
  "airport incident",
  "family stranded",
  "flight took off without them",
  "airport operational chaos",
  "travel disruption",
  "flight disruption",
  "long queue",
  "long queues",
  "holidaymakers",
  "tourist arrested",
  "tourist banned",
  "traveler damages gate",
  "traveller damages gate",
  "traveler incident",
  "traveller incident",
  "airport disturbance",
  "immigration gate vandalism",
];
const IDENTITY_BORDER_CONTROL_TECH_TERMS = [
  "biometric",
  "egate",
  "e-gate",
  "automated",
  "document verification",
  "passport verification",
  "facial recognition",
  "ees",
  "etias",
  "frontex",
  "cbp",
  "traveler verification",
  "mobile passport control",
  "document inspection",
  "border kiosk",
  "abc gates",
  "abc gate",
];
const BORDER_CONTROL_GUIDANCE_NOISE_TERMS = [
  "esta",
  "visa waiver program",
  "travel authorization",
  "visa requirements",
  "entry requirements",
  "tourist travel guidance",
  "travel advice",
  "travel guidance",
];
const BORDER_CONTROL_OPERATIONAL_PRIORITY_TERMS = [
  "egate deployment",
  "egates",
  "automated border control",
  "mobile passport control",
  "mpc",
  "ees",
  "etias",
  "frontex",
  "cbp",
  "eu-lisa",
  "eulisa",
  "document verification",
  "document inspection",
  "passport verification",
  "border biometrics",
  "biometric border system",
  "border management system",
  "airport modernization",
  "airport border-control modernization",
  "entry exit system",
];
const RESIDENCE_PERMIT_CARD_PRIORITY_TERMS = [
  "residence permit card",
  "residence card",
  "biometric residence permit",
  "biometric residence card",
  "brp",
  "brc",
  "permit card",
  "epermit",
  "electronic residence permit",
  "foreign resident card",
  "permanent residence permit card",
  "temporary residence permit card",
  "renew residence permit card",
  "collect residence permit card",
  "issue residence permit card",
  "residence permit renewal",
  "residence permit issuance",
  "permit personalization",
  "permit personalisation",
  "permit document",
  "secure residence document",
];
const RESIDENCE_PERMIT_OFFICIAL_SOURCE_TERMS = [
  "ind.nl",
  "migrationsverket.se",
  "migrationsverket",
  "gov.uk",
  "homeoffice.gov.uk",
  "home office",
  "valtioneuvosto.fi",
  "island.is",
  "mzv.gov.cz",
  "immigration authority",
  "migration authority",
  "migration agency",
  "interior ministry",
  "immigration service",
  "immigration department",
  "government permit issuer",
];
const RESIDENCE_PERMIT_GUIDE_NOISE_TERMS = [
  "golden visa",
  "investor visa",
  "digital nomad visa",
  "student visa guide",
  "work visa guide",
  "tourist visa",
  "travel visa",
  "visa requirements",
  "immigration advice",
  "how to move to",
  "expat guide",
  "relocation guide",
];
const IDENTITY_PASSPORT_LIGHT_NOISE_TERMS = [
  "passport fair",
  "passport fairs",
  "travel lifestyle",
  "most beautiful passports",
  "passport rankings",
  "travel freedom rankings",
  "strongest passports",
  "most powerful passports",
];
const IDENTITY_PASSPORT_ANCHOR_TERMS = [
  "biometric",
  "rollout",
  "issuance",
  "personalization",
  "security",
  "verification",
  "icao",
  "epassport",
  "e-passport",
  "chip",
  "fraud",
];
const IDENTITY_VISA_SPAM_TERMS = [
  "vacation guide",
  "travel blog",
  "cheap flights",
  "tourist attractions",
  "hotel deals",
  "backpacking guide",
  "tour package",
  "holiday ideas",
];
const BANKNOTE_SOURCE_AUTHORITY = {
  veryHigh: [
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
    "national bank",
    "reserve bank",
    "monetary authority",
    "imf",
    "currency bulletin",
    "currency publication",
    "issuer bank",
    "issuing authority",
    "bank of england",
    "ecb",
    "bceao",
    "rbi",
    "keesing",
    "de la rue",
    "de-la-rue",
    "giesecke+devrient",
    "giesecke devrient",
    "gi-de",
    "crane currency",
    "cranecurrency",
    "orell fussli",
    "orell fuessli",
    "koenig & bauer",
    "koenig-bauer",
    "oberthur",
    "sicpa",
    "louisenthal",
    "security document world",
    "securitydocumentworld",
  ],
  high: [
    "currency",
    "cash",
    "banknote",
    "anti-counterfeit currency",
    "security printing",
    "security printer",
    "banknote printer",
    "cash cycle",
    "currency technology",
  ],
  low: [
    "generic security",
    "techcrunch",
    "wired",
    "the verge",
    "mainstream tech",
    "bloomberg",
    "generic finance",
  ],
  veryLow: [
    "biometric update",
    "gizmodo",
    "phonearena",
    "mashable",
    "techradar",
    "youtube",
    "x.com",
    "twitter",
    "reddit",
    "facebook",
    "instagram",
    "tiktok",
    "pinterest",
    "alamy",
    "freepik",
    "ebay",
    "marketplace",
    "collector sale",
    "collector sales",
    "vpn",
    "antivirus",
    "iphone security",
    "shopping",
    "product page",
    "cybersecurity",
    "cyber security",
    "ai security",
    "identity verification",
    "digital identity",
    "kyc",
    "onboarding",
    "liveness",
    "authentication",
  ],
};
const PERSONAL_DASHBOARD_DOMAIN_CONTEXTS = {
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
    weak: ["issuance office", "document issuance", "immigration authority", "passport office", "id documents", "identity documents"],
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
  security_printing: {
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
  },
};
const SECURITY_PRINTING_TOP_LEVEL_STRONG_SIGNALS = [
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
const SECURITY_PRINTING_TOP_LEVEL_MEDIUM_SIGNALS = [
  "document security",
  "security foil",
  "holographic foil",
  "optical security feature",
  "optical security device",
];
const SECURITY_PRINTING_TOP_LEVEL_SUPPORT_TERMS = [
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
const SECURITY_PRINTING_TOP_LEVEL_NEGATIVE_TECH_TERMS = [
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
const STRONG_BANKNOTE_DOMAIN_SIGNAL_TERMS = [
  "banknote",
  "banknotes",
  "currency",
  "ariary",
  "central bank",
  "security thread",
  "substrate",
  "banknote security",
  "security feature",
  "note issuance",
  "denomination",
  "anti-counterfeit banknote",
  "polymer banknote",
];
const STRONG_BANKNOTE_CORE_TERMS = [
  "banknote",
  "banknotes",
  "banknote security",
  "anti-counterfeit banknote",
  "polymer banknote",
];
const CONCRETE_IDENTITY_DOCUMENT_ANCHOR_TERMS = [
  "passport",
  "passports",
  "id card",
  "id cards",
  "identity card",
  "identity cards",
  "residence permit",
  "residence permits",
  "driver license",
  "driver licenses",
  "driver's license",
  "travel document",
  "travel documents",
];
const PERSONAL_DASHBOARD_MAIN_DOMAIN_GROUP_IDS = new Set([
  "banknote_intelligence",
  "identity_documents",
  "digital_identity_biometrics",
]);
const PERSONAL_DASHBOARD_SHARED_GROUP_ID = "security_printing";
const PERSONAL_DASHBOARD_GROUPS = [
  {
    id: "banknote_intelligence",
    label: "Banknote Intelligence",
    interests: [
      { id: "banknotes", label: "Banknotes", strong: ["banknote", "banknotes", "currency note", "commemorative note", "note issuance"], weak: ["cash", "payment"], topicSignals: ["banknotes"], tagSignals: ["banknotes"], eventTypes: ["banknote_withdrawal", "new_banknote_series", "banknote_redesign", "commemorative_issue"] },
      { id: "polymer", label: "Polymer", strong: ["polymer note", "polymer banknote", "polymer substrate"], weak: ["polymer"], eventTypes: ["polymer_migration", "banknote_redesign"] },
      { id: "substrate", label: "Substrate", strong: ["substrate", "polymer substrate", "paper substrate"], weak: ["substrate migration"], eventTypes: ["polymer_migration", "security_feature_update"] },
      { id: "security_features", label: "Security features", strong: ["security feature", "security features", "security thread", "watermark", "hologram"], weak: ["uv feature"], signalIds: ["security-features", "counterfeit"] },
      { id: "security_printing", label: "Security printing", strong: ["security printing", "security printer", "banknote printing"], weak: ["secure print"], eventTypes: ["banknote_production", "security_feature_update"] },
      { id: "redesign", label: "Redesign", strong: ["redesign", "new design", "new family", "new portrait", "new artwork"], weak: ["design refresh"], signalIds: ["redesign"] },
      { id: "rollout", label: "Rollout", strong: ["new banknote launch", "banknote rollout", "circulation rollout", "new series launch"], weak: ["rollout", "launch", "introduction"], signalIds: ["rollout", "new-releases"] },
      { id: "release", label: "Release", strong: ["release", "issued", "issue", "commemorative note issue", "new banknote released"], weak: ["launch"], signalIds: ["new-releases", "commemorative"] },
      { id: "withdrawal", label: "Withdrawal", strong: ["withdrawn from circulation", "withdrawal", "demonetisation", "demonetization", "legal tender deadline"], weak: ["withdrawn", "retired"], eventTypes: ["banknote_withdrawal", "demonetisation"], signalIds: ["withdrawal"] },
      { id: "counterfeit", label: "Counterfeit", strong: ["counterfeit", "counterfeit notes", "counterfeit banknote", "fake note", "forged banknote"], weak: ["forged note"], eventTypes: ["counterfeit_banknotes", "central_bank_warning"], signalIds: ["counterfeit"] },
      { id: "central_bank", label: "Central bank", strong: ["central bank", "national bank", "reserve bank", "issuer bank", "bank of england", "ecb", "rbi"], weak: ["bank notice"], eventTypes: ["central_bank_warning", "banknote_withdrawal", "new_banknote_series"] },
    ],
  },
  {
    id: "identity_documents",
    label: "Identity Documents",
    interests: [
      { id: "passports", label: "Passports", strong: ["passport", "passports", "travel document"], weak: ["passport office"], topicSignals: ["passport"], eventTypes: ["passport_issuance", "passport_renewal", "passport_revocation", "passport_fraud"] },
      { id: "id_cards", label: "ID cards", strong: ["id card", "identity card", "national id", "hybrid id documents", "national identity guard"], weak: ["id issuance", "identity documents", "id documents", "identity document protection", "id protection"], topicSignals: ["id card"] },
      { id: "residence_permits", label: "Residence permits", strong: ["residence permit", "residence permits"], weak: ["permit card"] },
      { id: "drivers_licenses", label: "Driver's licenses", strong: ["driver license", "driver's license", "driving licence"], weak: ["license card"] },
      { id: "visas", label: "Visas", strong: ["visa", "visas", "visa policy"], weak: ["travel authorization"], eventTypes: ["visa_policy", "etias_event"] },
      { id: "laminate", label: "Laminate", strong: ["laminate", "laminated document", "security laminate"], weak: ["laminated"] },
      { id: "polycarbonate", label: "Polycarbonate", strong: ["polycarbonate", "pc datapage", "polycarbonate card"], weak: ["datapage", "card substrate"] },
      { id: "issuance", label: "Issuance", strong: ["issuance", "passport issuance", "passport renewal", "document issuance"], weak: ["issued", "renewal"], signalIds: ["regulations", "delay"] },
      { id: "fraud", label: "Fraud", strong: ["fraud", "fake passport", "forged passport", "forged document", "document fraud"], weak: ["counterfeit document"], signalIds: ["fraud", "criminal-misuse", "identity-theft"] },
      { id: "icao", label: "ICAO", strong: ["icao", "doc 9303", "mrz", "passport verification"], weak: ["travel document security"], signalIds: ["technology"] },
      { id: "border_control", label: "Border control", strong: ["border control", "border checks", "immigration control", "entry exit system"], weak: ["customs"], signalIds: ["border-control", "delay", "rollout"] },
    ],
  },
  {
    id: "digital_identity_biometrics",
    label: "Digital Identity & Biometrics",
    interests: [
      { id: "digital_identity", label: "Digital identity", strong: ["digital identity", "digital id", "mobile id"], weak: ["identity platform"] },
      { id: "biometrics", label: "Biometrics", strong: ["biometric", "biometrics", "face match", "fingerprint"], weak: ["biometric check"], signalIds: ["biometric"] },
      { id: "eid", label: "eID", strong: ["eid", "e-id", "electronic identity"], weak: ["electronic id"] },
      { id: "digital_wallet", label: "Digital wallet", strong: ["digital wallet", "identity wallet", "wallet framework"], weak: ["wallet"] },
      {
        id: "kyc",
        label: "KYC",
        strong: [
          "kyc",
          "know your customer",
          "aml",
          "anti-money laundering",
          "aml/kyc",
          "customer due diligence",
          "cdd",
          "sanctions screening",
          "financial crime",
          "regulatory compliance",
          "banking compliance",
          "fintech compliance",
        ],
        weak: ["due diligence"],
      },
      { id: "onboarding", label: "Onboarding", strong: ["onboarding", "remote onboarding", "digital onboarding"], weak: ["identity onboarding"] },
      { id: "liveness", label: "Liveness", strong: ["liveness", "liveness detection", "presentation attack"], weak: ["face match"] },
      { id: "artificial_intelligence", label: "Artificial intelligence", strong: ["artificial intelligence", "ai identity", "ai-assisted identity"], weak: ["machine learning", "ai"] },
      { id: "identity_verification", label: "Identity verification", strong: ["identity verification", "document verification", "id verification"], weak: ["verification platform"] },
      { id: "authentication", label: "Authentication", strong: ["authentication", "login verification", "multi-factor authentication"], weak: ["authenticator"] },
    ],
  },
  {
    id: "security_printing",
    label: "Shared Security Printing",
    interests: [
      { id: "security_printing_core", label: "Security printing", strong: ["security printing", "secure printing", "security printer"], weak: ["document printing"] },
      { id: "security_inks", label: "Security inks", strong: ["security ink", "security inks", "optically variable ink"], weak: ["specialty ink"] },
      { id: "micro_optics", label: "Micro optics", strong: ["micro optics", "micro-optics", "micro optical"], weak: ["optical security"] },
      { id: "holography", label: "Holography", strong: ["holography", "holographic", "hologram"], weak: ["diffractive"] },
      { id: "ovd", label: "OVD", strong: ["ovd", "optically variable device"], weak: ["optically variable"] },
      { id: "intaglio", label: "Intaglio", strong: ["intaglio", "engraved printing"], weak: ["engraved"] },
      { id: "anti_counterfeit", label: "Anti-counterfeit", strong: ["anti-counterfeit", "anti counterfeit", "counterfeit prevention"], weak: ["authentication feature"] },
      { id: "personalization", label: "Personalization", strong: ["personalization", "secure personalization", "card personalization"], weak: ["document personalization"] },
      { id: "secure_documents", label: "Secure documents", strong: ["secure documents", "document security", "secure document"], weak: ["travel document security"] },
    ],
  },
];
const PERSONAL_DASHBOARD_INTEREST_MAP = new Map(
  PERSONAL_DASHBOARD_GROUPS.flatMap((group) =>
    group.interests.map((interest) => [interest.id, { ...interest, groupId: group.id }])
  )
);
const DEFAULT_TAGS = [
  "identity",
  "identity verification",
  "id document",
  "passport",
  "id card",
  "visa",
  "epassport",
  "driver license",
  "banknotes",
  "coins",
  "currency",
  "security",
  "fraud",
  "counterfeit",
  "cyber security",
  "identity theft",
  "biometrics",
  "authentication",
  "artificial intelligence",
  "regulation",
  "travel",
  "privacy",
  "immigration",
  "travel document",
  "document security",
  "border control",
  "forgery",
  "verification",
  "central bank",
  "monetary policy",
  "sanctions",
  "border security",
  "digital identity",
];
const TAG_ALIASES = {
  passports: "passport",
  numismatics: "coins",
  commemorative: "commemorative coins",
};
let activeTags = [];
let activeTagSet = new Set();
let activeTagsLoaded = false;
const DEFAULT_KEYWORD_EXCLUDES = [
  "honda",
  "nissan",
  "toyota",
  "car",
  "cars",
  "suv",
  "vehicle",
  "vehicles",
  "engine",
  "specs",
  "crossover",
  "automotive",
  "auto",
  "review",
  "pricing",
  "horsepower",
];
const DEFAULT_KEYWORD_INCLUDES = [
  "visa",
  "immigration",
  "border",
  "document",
  "identity",
  "verification",
  "travel document",
];
const DRIVER_LICENSE_FALSE_POSITIVE_TERMS = [
  "driver license",
  "drivers license",
  "driver's license",
];
const MUSIC_FALSE_POSITIVE_KEYWORDS = [
  "olivia rodrigo",
  "song",
  "songs",
  "music",
  "lyrics",
  "lyric",
  "album",
  "single",
  "spotify",
  "apple music",
  "youtube music",
  "billboard",
  "chart",
  "charts",
  "streaming",
  "pop star",
  "singer",
  "artist",
  "concert",
  "track",
];
const COIN_FALSE_POSITIVE_TERMS = ["coin", "coins"];
const GAMING_COIN_FALSE_POSITIVE_KEYWORDS = [
  "game",
  "games",
  "gaming",
  "in-game",
  "ingame",
  "virtual currency",
  "virtual coins",
  "coin pack",
  "coins pack",
  "reward",
  "rewards",
  "battle pass",
  "loot",
  "skins",
  "token",
  "tokens",
  "xp",
  "level up",
  "mobile game",
  "steam",
  "xbox",
  "playstation",
  "nintendo",
  "fortnite",
  "roblox",
  "minecraft",
  "app store",
  "google play",
];
const COIN_CONTEXT_KEYWORDS = [
  "mint",
  "commemorative",
  "circulation",
  "collector",
  "collectible",
  "numismatic",
  "numismatics",
  "euro coin",
  "coin design",
  "central bank",
  "issue",
  "issued",
  "mintage",
  "obverse",
  "reverse",
  "bullion",
];
const TOPIC_KEYWORD_RULES = {
  passport: {
    include: ["visa", "immigration", "border", "document", "identity", "travel document"],
    exclude: DEFAULT_KEYWORD_EXCLUDES,
  },
  "driver license": {
    include: ["dmv", "driver", "document", "identity", "permit", "registration"],
    exclude: MUSIC_FALSE_POSITIVE_KEYWORDS,
  },
  coins: {
    include: COIN_CONTEXT_KEYWORDS,
    exclude: GAMING_COIN_FALSE_POSITIVE_KEYWORDS,
  },
  banknotes: {
    include: ["central bank", "note", "banknote", "issued", "circulation", "currency", "security printing"],
    exclude: ["game currency", "gaming", "token pack", "virtual currency"],
  },
  visa: {
    include: ["immigration", "border", "permit", "travel", "passport", "embassy"],
    exclude: ["payment card", "visa card", "credit card", "debit card", "mastercard", "banking"],
  },
  "identity document": {
    include: ["id", "document", "verification", "biometrics", "authentication", "security"],
    exclude: ["celebrity gossip", "music", "song", "songs", "lyrics", "album", "concert", "entertainment"],
  },
};
const TOPIC_KEYWORD_RULE_ALIASES = {
  passport: "passport",
  passports: "passport",
  epassport: "passport",
  "e-passport": "passport",
  "driver licenses": "driver license",
  "drivers license": "driver license",
  "driver's license": "driver license",
  "driving license": "driver license",
  coin: "coins",
  coins: "coins",
  numismatic: "coins",
  numismatics: "coins",
  banknote: "banknotes",
  banknotes: "banknotes",
  visa: "visa",
  visas: "visa",
  identity: "identity document",
  "identity documents": "identity document",
  "identity document": "identity document",
  "id document": "identity document",
  "id documents": "identity document",
  "id card": "identity document",
};
const SIGNAL_CATEGORIES = [
  {
    id: "new-releases",
    label: "New releases",
    badgeLabel: "Release",
    strong: ["issued", "released", "launched", "introduced", "unveiled"],
    requiredObjects: ["banknote", "passport", "id card", "identity document", "driver license"],
    noise: [
      "central bank",
      "inflation",
      "interest rate",
      "borrowing",
      "loan",
      "market",
      "economy",
      "investment",
      "monetary policy",
    ],
    exclude: [],
  },
  {
    id: "regulations",
    label: "Regulations",
    badgeLabel: "Regulation",
    strong: ["regulation", "regulations", "law", "requirement", "requirements", "compliance"],
    weak: ["rule", "rules", "guidance", "policy", "directive", "standard", "standards"],
    exclude: [],
  },
  {
    id: "design-changes",
    label: "Design changes",
    badgeLabel: "Design",
    strong: [
      "new design",
      "redesigned",
      "redesign",
      "updated design",
      "design change",
      "banknote design",
      "passport design",
      "id card design",
    ],
    weak: ["new series", "motif", "portrait", "symbol", "theme", "visual identity", "polymer design"],
    exclude: [],
  },
  {
    id: "security-features",
    label: "Security features",
    badgeLabel: "Security",
    strong: ["hologram", "watermark", "security feature", "uv ink", "ovi", "microprint", "intaglio"],
    weak: ["new", "enhanced", "advanced"],
    exclude: [],
  },
  {
    id: "technology",
    label: "Technology",
    badgeLabel: "Technology",
    strong: ["biometric", "biometrics", "chip", "nfc", "digital id", "verification", "identity verification"],
    weak: ["authentication", "machine readable", "mrz", "mobile id", "eid"],
    exclude: [],
  },
  {
    id: "fraud",
    label: "Fraud",
    badgeLabel: "Fraud",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "counterfeit",
    label: "Counterfeit",
    badgeLabel: "Counterfeit",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "withdrawal",
    label: "Withdrawal",
    badgeLabel: "Withdrawal",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "redesign",
    label: "Redesign",
    badgeLabel: "Redesign",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "polymer",
    label: "Polymer",
    badgeLabel: "Polymer",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "commemorative",
    label: "Commemorative",
    badgeLabel: "Commemorative",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "rollout",
    label: "Rollout",
    badgeLabel: "Rollout",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "delay",
    label: "Delay",
    badgeLabel: "Delay",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "travel-disruption",
    label: "Travel disruption",
    badgeLabel: "Disruption",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "criminal-misuse",
    label: "Criminal misuse",
    badgeLabel: "Criminal misuse",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "biometric",
    label: "Biometric",
    badgeLabel: "Biometric",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "identity-theft",
    label: "Identity theft",
    badgeLabel: "Identity theft",
    strong: [],
    weak: [],
    exclude: [],
  },
  {
    id: "border-control",
    label: "Border control",
    badgeLabel: "Border control",
    strong: [],
    weak: [],
    exclude: [],
  },
];
const SIGNAL_CATEGORY_BY_ID = new Map(SIGNAL_CATEGORIES.map((category) => [category.id, category]));
const SIGNAL_CORE_OBJECT_KEYWORDS = [
  "banknote",
  "banknotes",
  "currency",
  "passport",
  "identity",
  "id",
  "document",
  "driver license",
];
const SIGNAL_STRICT_INCLUDE_KEYWORDS = [
  "passport",
  "id card",
  "identity document",
  "driver license",
  "hologram",
  "security feature",
  "anti-counterfeit",
  "polymer note",
  "banknote design",
  "new banknote",
  "issued banknote",
  "currency redesign",
  "printing technology",
];
const SIGNAL_RELEASE_VARIANT_KEYWORDS = [
  "confirmed",
  "new sig/date",
  "new signature",
  "new date",
  "signature date",
  "sig/date",
  "new variety",
  "new variant",
  "replacement note",
  "new note",
  "issued note",
  "banknote confirmed",
];
const SIGNAL_RELEASE_OBJECT_KEYWORDS = [
  "banknote",
  "note",
  "notes",
  "quetzal",
  "dollar",
  "dinar",
  "peso",
  "rupee",
  "leu",
  "euro",
  "currency",
];
const BANKNOTE_SIGNAL_OBJECT_KEYWORDS = [
  "banknote",
  "banknotes",
  "note",
  "notes",
  "currency",
  "legal tender",
  "polymer",
  "security thread",
];
const BANKNOTE_HIGH_PRIORITY_KEYWORDS = [
  "withdraw",
  "withdrawn",
  "withdrawal",
  "demonetised",
  "demonetized",
  "demonetisation",
  "demonetization",
  "out of circulation",
  "cease legal tender",
  "no longer legal tender",
  "legal tender until",
  "exchange deadline",
  "banknote series",
  "new series",
  "redesigned",
  "redesign",
  "new design",
  "new banknote design",
  "new banknote family",
  "security feature",
  "security features",
  "hologram",
  "windowed thread",
  "security thread",
  "polymer",
  "upgraded banknote",
  "enhanced security",
  "counterfeit prevention",
  "anti-counterfeit",
];
const BANKNOTE_LOW_PRIORITY_KEYWORDS = [
  "new sig/date",
  "new signature",
  "new date",
  "signature date",
  "confirmed",
  "reported",
  "catalog",
];
const BANKNOTE_LOW_PRIORITY_CODE_PATTERN = /\bb\d{2,}[a-z]?\b/i;
const ID_SIGNAL_OBJECT_KEYWORDS = [
  "passport",
  "passports",
  "id card",
  "identity card",
  "identity document",
  "national id",
  "driver license",
  "driving licence",
  "residence permit",
  "visa",
  "e-passport",
  "epassport",
  "biometric passport",
];
const ID_SIGNAL_VALID_CONTEXT_KEYWORDS = [
  "passport",
  "id card",
  "identity document",
  "driver license",
  "residence permit",
  "national id",
  "biometric",
  "border control",
  "immigration",
  "identity verification",
  "digital id",
  "aadhaar",
  "e-ktp",
];
const ID_SIGNAL_NOISE_CONTEXT_KEYWORDS = [
  "smartphone",
  "foldable",
  "rumor",
  "rumored",
  "leak",
  "speculation",
  "preview",
  "hands-on",
  "review",
  "concept device",
  "prototype device",
];
const ID_SIGNAL_SYSTEM_EVENT_KEYWORDS = [
  "rollout",
  "launched",
  "introduced",
  "deployed",
  "implemented",
  "law",
  "regulation",
  "mandate",
  "policy change",
  "compliance",
  "breach",
  "biometric system",
  "fraud network",
  "identity theft system-level",
  "passport system",
  "id system",
  "identity platform",
  "verification system",
];
const ID_SIGNAL_SYSTEM_IMPACT_KEYWORDS = [
  "rollout",
  "launched",
  "introduced",
  "implemented",
  "deployed",
  "system upgrade",
  "mandatory",
  "enforced",
  "requirement",
  "compliance rule",
  "new law applied",
  "biometric system change",
  "passport system change",
  "id verification change",
  "border control change",
  "breach",
  "fraud network",
  "system vulnerability",
];
const ID_SIGNAL_NON_SYSTEM_NOISE_KEYWORDS = [
  "man",
  "woman",
  "person",
  "individual",
  "case of",
  "arrested",
  "encountered",
  "denied passport",
  "issued wrong",
  "leader says",
  "backs",
  "criticizes",
  "debate",
  "calls for",
  "urges",
  "court case",
  "lawsuit",
  "sues",
  "supreme court",
];
const ID_SIGNAL_NON_IMPACT_KEYWORDS = [
  "why",
  "what is",
  "how to",
  "guide",
  "explained",
  "man",
  "woman",
  "individual",
  "encountered",
  "unable to",
  "denied",
  "says",
  "backs",
  "calls for",
  "criticizes",
  "court",
  "lawsuit",
  "supreme court",
];
const ID_SIGNAL_RELEASE_STRONG_KEYWORDS = [
  "issued",
  "released",
  "launched",
  "introduced",
  "unveiled",
  "rollout",
  "roll out",
  "next generation",
];
const ID_SIGNAL_RELEASE_SUPPORT_KEYWORDS = [
  "new passport",
  "new id card",
  "new identity card",
  "new version",
  "new format",
  "electronic passport",
  "digital identity document",
];
const ID_SIGNAL_DESIGN_STRONG_KEYWORDS = [
  "redesigned passport",
  "redesigned id card",
  "updated passport design",
  "updated id card design",
];
const ID_SIGNAL_DESIGN_WEAK_KEYWORDS = [
  "new design",
  "redesign",
  "redesigned",
  "updated design",
];
const ID_SIGNAL_SECURITY_STRONG_KEYWORDS = [
  "hologram",
  "watermark",
  "security feature",
  "uv ink",
  "biometric",
];
const ID_SIGNAL_TECHNOLOGY_STRONG_KEYWORDS = [
  "chip",
  "nfc",
  "machine readable",
  "mrz",
  "digital id",
  "mobile id",
  "document verification",
  "identity verification",
  "liveness",
  "authentication",
];
const ID_SIGNAL_REGULATION_KEYWORDS = [
  "regulation",
  "law",
  "requirement",
  "compliance",
  "mandate",
  "policy",
  "directive",
  "new rules",
  "document requirements",
  "identity verification rules",
];
const ID_SIGNAL_HIGH_INTENT_KEYWORDS = [
  "issued",
  "released",
  "launched",
  "introduced",
  "rolled out",
  "rollout",
  "unveiled",
  "deployed",
  "implemented",
  "now in use",
  "suspended",
  "blocked",
  "approved",
  "rejected",
  "passed",
  "adopted",
  "law",
  "regulation",
  "mandate",
  "requirement",
  "policy change",
  "directive",
  "compliance rule",
  "enforced",
  "biometric system",
  "passport system",
  "id system",
  "identity verification system",
  "border checks",
  "biometric checks",
  "chip-enabled",
  "nfc passport",
  "digital id system launched",
  "identity verification system deployed",
  "data breach",
  "passport data",
  "identity data",
  "document fraud network",
];
const ID_SIGNAL_WEAK_INTENT_KEYWORDS = [
  "how to",
  "guide",
  "tips",
  "explained",
  "what you need",
  "why you need",
  "advice",
  "overview",
  "comparison",
  "step by step",
  "simple guide",
  "everything you need to know",
  "things to know",
  "faq",
  "tutorial",
  "opinion",
  "analysis only",
  "discussion",
];
const ID_SIGNAL_OVERRIDE_KEYWORDS = [
  "data breach",
  "passport data",
  "identity data",
  "document fraud network",
  "biometric system",
  "identity verification system",
  "identity verification system deployed",
  "digital id system launched",
  "border checks",
  "biometric checks",
  "law",
  "regulation",
  "mandate",
  "directive",
  "enforced",
];
const ID_SIGNAL_NOISE_KEYWORDS = [
  "film",
  "casting",
  "actor",
  "actress",
  "episode",
  "transcript",
  "celebrity",
  "music",
  "song",
  "lyrics",
  "election",
  "voting",
  "voter",
  "crime story",
  "found passport",
  "lost passport",
  "fake passport tracked",
  "travel chaos",
  "airport delays",
  "passport mistake",
  "passport renewal tips",
  "passport photo",
  "car",
  "honda passport",
];
const SIGNAL_RELEVANCE_NOISE_KEYWORDS = [
  "economy",
  "inflation",
  "interest rate",
  "central bank",
  "monetary policy",
  "gdp",
  "forex",
  "borrowing",
  "bond",
  "stock market",
  "currency rate",
  "yen",
];
const SIGNAL_NOISE_CONTEXT_KEYWORDS = [
  "central bank",
  "inflation",
  "interest rate",
  "economy",
  "finance",
  "market",
  "loan",
  "borrowing",
  "investment",
];

const state = {
  feeds: [],
  dmvCatalog: [],
  articles: [],
  dashboardMode: "normal",
  editingFeedId: "",
  feedPanelCollapsed: false,
  addSourceExpanded: false,
  analyticsScope: "all",
  analyticsQualityFilter: "all",
  tagManagerExpanded: false,
  noiseKeywordsExpanded: false,
  keywordFilters: {
    include: [],
    exclude: [],
  },
  personalDashboard: {
    interests: [],
    expandedGroups: PERSONAL_DASHBOARD_GROUPS.map((group) => group.id),
    mode: "balanced",
  },
  filters: {
    search: "",
    topic: "",
    tag: "",
    signalCategory: "",
    feedId: "",
    dmvFeedId: "",
    canadaDmvFeedPath: "",
    canadaDmvAll: false,
    sourceGroup: "all",
    date: "",
    articleIds: [],
    alertLabel: "",
  },
  pagination: {
    page: 1,
    pageSize: ARTICLE_RENDER_PAGE_SIZE,
  },
  articleStats: {
    totalAvailable: 0,
    loadedInFrontend: 0,
  },
  remoteQuery: {
    activeKey: "",
    totalCount: 0,
    page: 1,
    limit: MAX_ARTICLES_IN_MEMORY,
  },
};

const runtime = {
  pollTimer: null,
  eventSource: null,
  realtimeEnabled: false,
  notificationId: 0,
  notificationTimers: new Map(),
  knownErrorFeedIds: new Set(),
  knownArticleIds: new Set(),
  dashboardAlerts: [],
  dashboardAlertId: 0,
  activityLog: [],
  activityLogId: 0,
  previousSnapshotStats: null,
  snapshotLoaded: false,
  expandedGroupedSourceKeys: new Set(),
  fullyExpandedGroupedSourceKeys: new Set(),
  articleComputationCache: new Map(),
  articlePairComputationCache: new Map(),
  feedLookupKey: "",
  feedByUniqueIdentity: new Map(),
  feedById: new Map(),
  feedBySourceId: new Map(),
  duplicateFeedIds: new Set(),
  duplicateSourceIds: new Set(),
  selectedFeedResolutionCache: new Map(),
  articlesByFeedId: new Map(),
  groupedFeedCache: new Map(),
  articleDataRevision: 0,
  backendArticleQueryCache: new Map(),
  backendArticleQueryRequestId: 0,
  backendArticleQueryActiveRequestId: 0,
  backendArticleQueryLoading: false,
  paginationContextKey: "",
  scheduledRenderFrame: 0,
  scheduledRenderTimeout: 0,
  scheduledRenderReason: "",
  lastRenderedReason: "",
  lastBackgroundRefreshAt: 0,
  lastRefreshStatusAt: 0,
  refreshPauseUntil: 0,
  refreshInteractionReason: "",
  pendingBackgroundRefresh: false,
  pendingBackgroundRefreshReason: "",
  pendingBackgroundNewArticles: 0,
  pendingRefreshTimer: 0,
  articleGridHovered: false,
  sidebarHovered: false,
  lastSnapshotSignature: "",
  pendingSnapshot: null,
};

const elements = {
  notificationRegion: document.getElementById("notification-region"),
  summaryGrid: document.getElementById("summary-grid"),
  articlesGrid: document.getElementById("articles-grid"),
  sidebar: document.querySelector(".sidebar"),
  articleFilterContext: document.getElementById("article-filter-context"),
  paginationControls: document.getElementById("pagination-controls"),
  paginationRange: document.getElementById("pagination-range"),
  paginationStatus: document.getElementById("pagination-status"),
  paginationPrev: document.getElementById("pagination-prev"),
  paginationNext: document.getElementById("pagination-next"),
  topicFilter: document.getElementById("topic-filter"),
  tagFilter: document.getElementById("tag-filter"),
  signalFilter: document.getElementById("signal-filter"),
  tagAddInput: document.getElementById("tag-add-input"),
  tagAddButton: document.getElementById("tag-add-button"),
  tagResetButton: document.getElementById("tag-reset-button"),
  tagManagerToggle: document.getElementById("tag-manager-toggle"),
  tagManagerContent: document.getElementById("tag-manager-content"),
  tagManagerList: document.getElementById("tag-manager-list"),
  personalDashboard: document.getElementById("personal-dashboard"),
  personalDashboardGroups: document.getElementById("personal-dashboard-groups"),
  personalDashboardInterests: document.getElementById("personal-dashboard-interests"),
  personalDashboardClear: document.getElementById("personal-dashboard-clear"),
  feedFilter: document.getElementById("feed-filter"),
  dmvFeedFilter: document.getElementById("dmv-feed-filter"),
  canadaDmvFilter: document.getElementById("canada-dmv-filter"),
  dmvOfficialLinkWrap: document.getElementById("dmv-official-link-wrap"),
  dmvOfficialLink: document.getElementById("dmv-official-link"),
  dmvModeIndicator: document.getElementById("dmv-mode-indicator"),
  dateFilter: document.getElementById("date-filter"),
  searchFilter: document.getElementById("search-filter"),
  clearFilters: document.getElementById("clear-filters"),
  activeFilterList: document.getElementById("active-filter-list"),
  includeKeywordsInput: document.getElementById("include-keywords-input"),
  excludeKeywordsInput: document.getElementById("exclude-keywords-input"),
  keywordResetButton: document.getElementById("keyword-reset-button"),
  keywordToggle: document.getElementById("keyword-toggle"),
  keywordContent: document.getElementById("keyword-filter-content"),
  refreshButton: document.getElementById("refresh-button"),
  connectionStatus: document.getElementById("connection-status"),
  resultsCount: document.getElementById("results-count"),
  themeToggle: document.getElementById("theme-toggle"),
  feedForm: document.getElementById("feed-form"),
  feedSubmit: document.getElementById("feed-submit"),
  feedCancel: document.getElementById("feed-cancel"),
  feedName: document.getElementById("feed-name"),
  feedTopic: document.getElementById("feed-topic"),
  feedUrl: document.getElementById("feed-url"),
  feedSourceType: document.getElementById("feed-source-type"),
  feedFormStatus: document.getElementById("feed-form-status"),
  googleAlertsBatchInput: document.getElementById("google-alerts-batch-input"),
  googleAlertsBatchSubmit: document.getElementById("google-alerts-batch-submit"),
  googleAlertsBatchStatus: document.getElementById("google-alerts-batch-status"),
  feedCount: document.getElementById("feed-count"),
  feedList: document.getElementById("feed-list"),
  feedPanelSearch: document.getElementById("feed-panel-search"),
  feedVisibilityFilter: document.getElementById("feed-visibility-filter"),
  feedGroupTabs: document.getElementById("feed-group-tabs"),
  feedPanel: document.getElementById("feed-panel"),
  feedPanelToggle: document.getElementById("feed-panel-toggle"),
  feedPanelContent: document.getElementById("feed-panel-content"),
  addSourceToggle: document.getElementById("add-source-toggle"),
  addSourceContent: document.getElementById("add-source-content"),
  summaryCardTemplate: document.getElementById("summary-card-template"),
  feedItemTemplate: document.getElementById("feed-item-template"),
  articleCardTemplate: document.getElementById("article-card-template"),
  importDmvButton: document.getElementById("import-dmv-button"),
  dmvToggleButton: document.getElementById("dmv-toggle-button"),
  canadaToggleButton: document.getElementById("canada-toggle-button"),
};

function debounce(callback, wait = 250) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}

function flushScheduledRender() {
  if (runtime.scheduledRenderFrame) {
    window.cancelAnimationFrame(runtime.scheduledRenderFrame);
    runtime.scheduledRenderFrame = 0;
  }

  if (runtime.scheduledRenderTimeout) {
    window.clearTimeout(runtime.scheduledRenderTimeout);
    runtime.scheduledRenderTimeout = 0;
  }

  const reason = runtime.scheduledRenderReason || "scheduled";
  runtime.scheduledRenderReason = "";
  runtime.lastRenderedReason = reason;
  intelligenceDebug("[scheduleRenderArticles:flush]", { reason });
  renderArticles();
}

function scheduleRenderArticles(reason = "interaction", options = {}) {
  const mode = options.mode === "timeout" ? "timeout" : "frame";
  runtime.scheduledRenderReason = reason;

  if (runtime.scheduledRenderFrame) {
    window.cancelAnimationFrame(runtime.scheduledRenderFrame);
    runtime.scheduledRenderFrame = 0;
  }

  if (runtime.scheduledRenderTimeout) {
    window.clearTimeout(runtime.scheduledRenderTimeout);
    runtime.scheduledRenderTimeout = 0;
  }

  if (mode === "timeout") {
    runtime.scheduledRenderTimeout = window.setTimeout(() => {
      runtime.scheduledRenderTimeout = 0;
      flushScheduledRender();
    }, 0);
    return;
  }

  runtime.scheduledRenderFrame = window.requestAnimationFrame(() => {
    runtime.scheduledRenderFrame = 0;
    flushScheduledRender();
  });
}

function toDate(value) {
  if (!value) {
    return new Date(0);
  }
  return new Date(value);
}

function compareArticlesByPublicationDate(left, right) {
  const leftPubDate = toDate(left?.pubDate).getTime() || 0;
  const rightPubDate = toDate(right?.pubDate).getTime() || 0;
  if (rightPubDate !== leftPubDate) {
    return rightPubDate - leftPubDate;
  }

  const leftCreatedAt = toDate(left?.createdAt).getTime() || 0;
  const rightCreatedAt = toDate(right?.createdAt).getTime() || 0;
  if (rightCreatedAt !== leftCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function sortArticlesByPublicationDate(articles) {
  return Array.isArray(articles) ? articles.slice().sort(compareArticlesByPublicationDate) : [];
}

function promoteNewestArticleInSelectedFeedGroup(article) {
  const sources = Array.isArray(article?.sources) && article.sources.length
    ? sortArticlesByPublicationDate(article.sources)
    : [article].filter(Boolean);
  const newest = sources[0] || article;

  return {
    ...article,
    ...newest,
    sources,
    sourceCount: Number(article?.sourceCount) || sources.length,
    groupedArticlesCount: Number(article?.groupedArticlesCount) || Math.max(0, sources.length - 1),
  };
}

function prepareDateFirstGroupedArticles(articles) {
  const dateSortedArticles = sortArticlesByPublicationDate(articles);
  return sortArticlesByPublicationDate(
    groupArticlesByEvent(dateSortedArticles).map(promoteNewestArticleInSelectedFeedGroup)
  );
}

function prepareSelectedFeedGroupedArticles(articles) {
  return prepareDateFirstGroupedArticles(articles);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));
}

function formatRefreshAge(timestamp) {
  if (!timestamp) {
    return "Awaiting first refresh";
  }

  const deltaMs = Math.max(0, Date.now() - timestamp);
  if (deltaMs < 10000) {
    return "Updated just now";
  }
  const seconds = Math.round(deltaMs / 1000);
  if (seconds < 60) {
    return `Updated ${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  return `Updated ${minutes}m ago`;
}

function updateRefreshStatus(options = {}) {
  if (!elements.connectionStatus) {
    return;
  }

  if (options.message) {
    elements.connectionStatus.textContent = options.message;
    return;
  }

  const pendingCount = Number(options.pendingCount ?? runtime.pendingBackgroundNewArticles ?? 0);
  const baseLabel = AUTO_REFRESH_MODE === "off"
    ? "Manual refresh mode"
    : "Background refresh every 60 minutes";

  elements.connectionStatus.innerHTML = "";
  const baseText = document.createTextNode(baseLabel);
  elements.connectionStatus.appendChild(baseText);

  if (pendingCount > 0) {
    const spacer = document.createTextNode(" | ");
    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "status-inline-refresh";
    refreshButton.dataset.applyRefresh = "true";
    refreshButton.textContent = "New articles available (Refresh)";
    elements.connectionStatus.append(spacer, refreshButton);
  }
}

function markRefreshInteraction(reason = "interaction", pauseMs = REFRESH_INTERACTION_PAUSE_MS) {
  runtime.refreshPauseUntil = Math.max(runtime.refreshPauseUntil || 0, Date.now() + pauseMs);
  runtime.refreshInteractionReason = reason;
}

function isBackgroundRefreshPaused() {
  return runtime.articleGridHovered || runtime.sidebarHovered || Date.now() < runtime.refreshPauseUntil;
}

function buildArticleSnapshotSignature(articles = []) {
  if (!Array.isArray(articles) || !articles.length) {
    return "empty";
  }

  const identitySlice = articles
    .slice(0, 40)
    .map((article) => String(article?.id || article?.url || article?.title || "").trim())
    .join("|");
  const newestDate = String(articles[0]?.pubDate || "");
  return `${articles.length}:${newestDate}:${identitySlice}`;
}

function countNewArticles(previousArticles = [], nextArticles = []) {
  const previousIds = new Set(
    (Array.isArray(previousArticles) ? previousArticles : [])
      .map((article) => String(article?.id || "").trim())
      .filter(Boolean)
  );

  return (Array.isArray(nextArticles) ? nextArticles : []).reduce((count, article) => {
    const articleId = String(article?.id || "").trim();
    return articleId && !previousIds.has(articleId) ? count + 1 : count;
  }, 0);
}

function renderArticleRegionPreservingScroll({ updateSummary = true } = {}) {
  const scrollY = window.scrollY;
  if (updateSummary) {
    renderSummary();
  }
  renderArticles();
  window.requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
  });
}

function clearPendingBackgroundRefresh() {
  runtime.pendingBackgroundRefresh = false;
  runtime.pendingBackgroundRefreshReason = "";
  runtime.pendingBackgroundNewArticles = 0;
  runtime.pendingSnapshot = null;
  if (runtime.pendingRefreshTimer) {
    window.clearTimeout(runtime.pendingRefreshTimer);
    runtime.pendingRefreshTimer = 0;
  }
}

function schedulePendingBackgroundRefresh() {
  if (!runtime.pendingBackgroundRefresh) {
    return;
  }
  if (runtime.pendingRefreshTimer) {
    window.clearTimeout(runtime.pendingRefreshTimer);
  }
  const delay = Math.max(250, (runtime.refreshPauseUntil || 0) - Date.now() + 250);
  runtime.pendingRefreshTimer = window.setTimeout(() => {
    runtime.pendingRefreshTimer = 0;
    if (runtime.pendingBackgroundRefresh && !isBackgroundRefreshPaused()) {
      clearPendingBackgroundRefresh();
      renderArticleRegionPreservingScroll({ updateSummary: true });
      runtime.lastRefreshStatusAt = Date.now();
      updateRefreshStatus();
      return;
    }
    if (runtime.pendingBackgroundRefresh) {
      schedulePendingBackgroundRefresh();
    }
  }, delay);
}

function dismissNotification(notificationId) {
  const notification = elements.notificationRegion?.querySelector(`[data-notification-id="${notificationId}"]`);
  if (!notification) {
    return;
  }

  window.clearTimeout(runtime.notificationTimers.get(notificationId));
  runtime.notificationTimers.delete(notificationId);
  notification.remove();
}

function showNotification({ title, message = "", type = "info", timeout = NOTIFICATION_TIMEOUT_MS }) {
  if (!elements.notificationRegion) {
    return;
  }

  const notificationId = String((runtime.notificationId += 1));
  const notification = document.createElement("article");
  const content = document.createElement("div");
  const titleElement = document.createElement("strong");
  const messageElement = document.createElement("p");
  const closeButton = document.createElement("button");

  notification.className = `notification-toast is-${type}`;
  notification.dataset.notificationId = notificationId;
  content.className = "notification-content";
  titleElement.textContent = title;
  messageElement.textContent = message;
  closeButton.className = "notification-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Dismiss notification");
  closeButton.textContent = "Dismiss";
  closeButton.addEventListener("click", () => dismissNotification(notificationId));

  content.append(titleElement);
  if (message) {
    content.appendChild(messageElement);
  }
  notification.append(content, closeButton);
  elements.notificationRegion.appendChild(notification);

  if (timeout > 0) {
    const timer = window.setTimeout(() => dismissNotification(notificationId), timeout);
    runtime.notificationTimers.set(notificationId, timer);
  }
}

function parseStreamPayload(event) {
  try {
    return JSON.parse(event?.data || "{}");
  } catch {
    return {};
  }
}

function isNotafiliaUrl(value) {
  try {
    return new URL(String(value || "")).hostname === "news.notafilia.pl";
  } catch {
    return false;
  }
}

function isKnownBrokenImageUrl(url) {
  const host = url.hostname.replace(/^www\./, "");
  const path = `${url.pathname} ${url.search}`.toLowerCase();
  return (
    host === "imgbb.com" ||
    host.endsWith(".imgbb.com") ||
    path.includes("image-not-found") ||
    path.includes("image_not_found") ||
    path.includes("not-found") ||
    path.includes("placeholder") ||
    path.includes("default-image")
  );
}

function normalizeArticleImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "null" || raw === "undefined" || raw.startsWith("data:")) {
    return "";
  }

  try {
    const url = new URL(raw, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol) || isKnownBrokenImageUrl(url)) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

function isGoogleNewsArticle(article) {
  return getCachedArticleValue(article, "isGoogleNewsArticle", () => {
    const context = getPersonalBoostContext(article);
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    return [
      "news.google.com",
      "google news",
      "news.google",
    ].some((value) => textMatchesKeyword(sourceFingerprint, value));
  });
}

function assessArticleImageQuality(article) {
  return getCachedArticleValue(article, "articleImageQuality", () => {
    const normalizedImageUrl = normalizeArticleImageUrl(article?.thumbnail);
    if (!normalizedImageUrl) {
      return {
        score: 0,
        imageSrc: "",
      };
    }

    try {
      const url = new URL(normalizedImageUrl);
      const fingerprint = `${url.hostname.toLowerCase()} ${url.pathname.toLowerCase()} ${url.search.toLowerCase()}`;
      let score = 10;

      if ([
        "news.google.com",
        "lh3.googleusercontent.com",
        "gstatic.com",
        "googleusercontent.com",
      ].some((value) => fingerprint.includes(value))) {
        score -= 4;
      }

      if ([
        "placeholder",
        "default-image",
        "default",
        "blank",
        "spacer",
        "sprite",
        "logo",
        "icon",
        "avatar",
        "tracking",
      ].some((value) => fingerprint.includes(value))) {
        score -= 7;
      }

      return {
        score: Math.max(0, score),
        imageSrc: isNotafiliaUrl(normalizedImageUrl)
          ? `/api/image?url=${encodeURIComponent(normalizedImageUrl)}`
          : normalizedImageUrl,
      };
    } catch {
      return {
        score: 0,
        imageSrc: "",
      };
    }
  });
}

function getArticleVisualQualityScore(article) {
  return getCachedArticleValue(article, "articleVisualQualityScore", () => {
    const groupedSources = Array.isArray(article?.sources) ? article.sources : [];
    const candidates = [article, ...groupedSources];
    return candidates.reduce((bestScore, candidate) => {
      return Math.max(bestScore, assessArticleImageQuality(candidate).score);
    }, 0);
  });
}

function isDmvWrapperFeed(feed) {
  return isDmvSource(feed);
}

function getPreferredArticleImageSrc(article) {
  const groupedSources = getGroupedArticleSources(article);
  const candidates = [article, ...groupedSources]
    .map((candidate) => ({
      article: candidate,
      quality: assessArticleImageQuality(candidate),
      googleNews: isGoogleNewsArticle(candidate),
    }))
    .filter((entry) => entry.quality.imageSrc);

  if (!candidates.length) {
    return "";
  }

  candidates.sort((left, right) => {
    if (right.quality.score !== left.quality.score) {
      return right.quality.score - left.quality.score;
    }
    if (left.googleNews !== right.googleNews) {
      return left.googleNews ? 1 : -1;
    }
    return 0;
  });

  return candidates[0]?.quality.imageSrc || "";
}

function getArticleImageSrc(article) {
  return getPreferredArticleImageSrc(article);
}

function toDateInputValue(value) {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function applyTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = value === "dark" ? "dark" : "";
  elements.themeToggle.textContent = value === "dark" ? "Light mode" : "Dark mode";
  window.localStorage.setItem(THEME_STORAGE_KEY, value);
}

function loadTheme() {
  applyTheme(window.localStorage.getItem(THEME_STORAGE_KEY) || "light");
}

function normalizePersonalDashboardInterestId(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return PERSONAL_DASHBOARD_INTEREST_MAP.has(normalizedValue) ? normalizedValue : "";
}

function normalizePersonalDashboardInterests(interests) {
  return Array.from(
    new Set((Array.isArray(interests) ? interests : []).map(normalizePersonalDashboardInterestId).filter(Boolean))
  );
}

function normalizePersonalDashboardMode(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PERSONAL_DASHBOARD_MODES, normalizedValue)
    ? normalizedValue
    : "balanced";
}

function loadPersonalDashboardPreferences() {
  state.personalDashboard.mode = normalizePersonalDashboardMode(
    window.localStorage.getItem(PERSONAL_DASHBOARD_MODE_STORAGE_KEY) || "balanced"
  );
  try {
    const storedInterests = JSON.parse(
      window.localStorage.getItem(PERSONAL_DASHBOARD_INTERESTS_STORAGE_KEY) || "[]"
    );
    state.personalDashboard.interests = normalizePersonalDashboardInterests(storedInterests);
  } catch {
    state.personalDashboard.interests = [];
  }
}

function savePersonalDashboardPreferences() {
  state.personalDashboard.mode = normalizePersonalDashboardMode(state.personalDashboard.mode);
  state.personalDashboard.interests = normalizePersonalDashboardInterests(state.personalDashboard.interests);
  window.localStorage.setItem(PERSONAL_DASHBOARD_MODE_STORAGE_KEY, state.personalDashboard.mode);
  window.localStorage.setItem(
    PERSONAL_DASHBOARD_INTERESTS_STORAGE_KEY,
    JSON.stringify(state.personalDashboard.interests)
  );
}

function clearPersonalDashboardPreferences() {
  state.personalDashboard.interests = [];
  state.personalDashboard.mode = "balanced";
  window.localStorage.removeItem(PERSONAL_DASHBOARD_MODE_STORAGE_KEY);
  window.localStorage.removeItem(PERSONAL_DASHBOARD_INTERESTS_STORAGE_KEY);
}

function ensurePersonalDashboardElements() {
  if (!elements.personalDashboard) {
    return false;
  }

  if (!elements.personalDashboardGroups) {
    const groups = document.createElement("div");
    groups.id = "personal-dashboard-groups";
    groups.className = "personal-dashboard-groups";
    groups.setAttribute("aria-live", "polite");
    elements.personalDashboard.appendChild(groups);
    elements.personalDashboardGroups = groups;
  }

  if (!elements.personalDashboardInterests) {
    const interests = document.createElement("div");
    interests.id = "personal-dashboard-interests";
    interests.className = "personal-dashboard-interests";
    interests.setAttribute("aria-live", "polite");
    elements.personalDashboard.appendChild(interests);
    elements.personalDashboardInterests = interests;
  }

  return Boolean(
    elements.personalDashboardGroups &&
      elements.personalDashboardInterests &&
      elements.personalDashboardClear
  );
}

function isPersonalDashboardGroupExpanded(groupId) {
  return (state.personalDashboard.expandedGroups || []).includes(groupId);
}

function togglePersonalDashboardGroup(groupId) {
  const nextExpandedGroups = new Set(state.personalDashboard.expandedGroups || []);
  if (nextExpandedGroups.has(groupId)) {
    nextExpandedGroups.delete(groupId);
  } else {
    nextExpandedGroups.add(groupId);
  }
  state.personalDashboard.expandedGroups = Array.from(nextExpandedGroups);
  renderPersonalDashboard();
}

function renderPersonalDashboard() {
  if (!ensurePersonalDashboardElements()) {
    return;
  }

  const activeInterests = new Set(normalizePersonalDashboardInterests(state.personalDashboard.interests));
  if (!Array.isArray(state.personalDashboard.expandedGroups) || !state.personalDashboard.expandedGroups.length) {
    state.personalDashboard.expandedGroups = PERSONAL_DASHBOARD_GROUPS.map((group) => group.id);
  }

  elements.personalDashboardGroups.innerHTML = PERSONAL_DASHBOARD_GROUPS.map((group) => {
    const expanded = isPersonalDashboardGroupExpanded(group.id);
    const selectedCount = group.interests.filter((interest) => activeInterests.has(interest.id)).length;
    return `
      <section class="personal-dashboard-group">
        <button
          type="button"
          class="personal-dashboard-group-toggle"
          data-personal-group-toggle="${escapeHtml(group.id)}"
          aria-expanded="${expanded ? "true" : "false"}"
        >
          <span>${escapeHtml(group.label)}</span>
          <span class="personal-dashboard-group-count">${selectedCount ? `${selectedCount} selected` : "Select interests"}</span>
        </button>
        <div class="personal-dashboard-group-options" ${expanded ? "" : "hidden"}>
          ${group.interests.map((interest) => `
            <label class="personal-dashboard-checkbox">
              <input
                type="checkbox"
                data-personal-interest="${escapeHtml(interest.id)}"
                ${activeInterests.has(interest.id) ? "checked" : ""}
              />
              <span class="personal-dashboard-checkbox-label">${escapeHtml(interest.label)}</span>
            </label>
          `).join("")}
        </div>
      </section>
    `;
  }).join("");

  if (activeInterests.size) {
    elements.personalDashboardInterests.innerHTML = Array.from(activeInterests)
      .map((interestId) => {
        const interest = PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId);
        if (!interest) {
          return "";
        }
        return `
          <span class="personal-dashboard-interest">
            <span>${escapeHtml(interest.label)}</span>
            <button
              type="button"
              class="personal-dashboard-interest-remove"
              data-remove-personal-interest="${escapeHtml(interest.id)}"
              aria-label="Remove ${escapeHtml(interest.label)}"
            ></button>
          </span>
        `;
      })
      .filter(Boolean)
      .join("");
  } else {
    elements.personalDashboardInterests.innerHTML =
      `<p class="personal-dashboard-empty">No personal interests selected yet. Select interests to gently prioritize matching intelligence topics.</p>`;
  }

  elements.personalDashboardClear.disabled = !activeInterests.size;
}

function setPersonalDashboardInterest(interestId, enabled) {
  const normalizedInterestId = normalizePersonalDashboardInterestId(interestId);
  if (!normalizedInterestId) {
    return;
  }

  const nextInterests = new Set(state.personalDashboard.interests || []);
  if (enabled) {
    nextInterests.add(normalizedInterestId);
  } else {
    nextInterests.delete(normalizedInterestId);
  }

  state.personalDashboard.interests = Array.from(nextInterests);
  ensurePaginationState();
  state.pagination.page = 1;
  savePersonalDashboardPreferences();
  renderPersonalDashboard();
  clearFeedRenderCaches();
  scheduleRenderArticles("personal-dashboard-boost", { mode: "frame" });
}

function hasPersonalDashboardSelections() {
  return Array.isArray(state.personalDashboard.interests) && state.personalDashboard.interests.length > 0;
}

function getSelectedIdentityDocumentSubinterests(selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  return normalizePersonalDashboardInterests(selectedInterests)
    .filter((interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "identity_documents");
}

function getSelectedSharedSecuritySubinterests(selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  return normalizePersonalDashboardInterests(selectedInterests)
    .filter((interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === PERSONAL_DASHBOARD_SHARED_GROUP_ID);
}

function isSharedSecurityOnlyPersonalSelection(selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  return !getSelectedMainDomains(selectedInterests).length && getSelectedSharedSecuritySubinterests(selectedInterests).length > 0;
}

function matchesSelectedSharedSecurityTechnique(article, selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  const selectedSharedInterests = getSelectedSharedSecuritySubinterests(selectedInterests);
  if (!selectedSharedInterests.length) {
    return true;
  }

  return selectedSharedInterests.some((interestId) =>
    getSharedSecurityStandaloneAssessment(article, interestId).included
  );
}

const ID_CARDS_HOLOGRAPHY_OVD_BRIDGE_TECHNIQUE_TERMS = [
  "hologram",
  "holograms",
  "holography",
  "holographic",
  "dovid",
  "dovids",
  "nano dovid",
  "nanodovid",
  "ovd",
  "optically variable device",
  "optically variable feature",
];

const ID_CARDS_HOLOGRAPHY_OVD_BRIDGE_DOCUMENT_TERMS = [
  "id documents",
  "identity documents",
  "id card",
  "id cards",
  "identity card",
  "identity cards",
  "secure document",
  "secure documents",
  "document protection",
  "identity document protection",
  "security feature",
  "security features",
  "physical document",
  "physical documents",
];

const IDENTITY_SHARED_SECURITY_COMBINATION_TECHNIQUE_TERMS = {
  security_inks: [
    "security ink",
    "security inks",
    "intaglio ink",
    "optically variable ink",
    "ovi",
    "spark ink",
    "spark security ink",
    "magnetic ink",
    "fluorescent ink",
    "uv ink",
  ],
  holography: [
    "hologram",
    "holograms",
    "holographic",
    "holography",
    "dovid",
    "dovids",
    "holographic foil",
  ],
  ovd: [
    "ovd",
    "ovds",
    "optically variable device",
    "optically variable devices",
    "optically variable",
    "dovid",
    "dovids",
  ],
  micro_optics: [
    "micro optics",
    "micro-optics",
    "micro lens",
    "microlens",
    "micro-lens",
    "micro lens array",
    "micro-optic",
    "nano optics",
    "nano-optics",
    "nanoswitch",
    "nanovista",
  ],
  security_printing_core: [
    "security printing",
    "secure printing",
    "anti-counterfeit printing",
    "document security",
    "secure document",
    "secure documents",
  ],
  secure_documents: [
    "secure document",
    "secure documents",
    "document security",
    "security document",
    "security documents",
  ],
};

function matchesIdCardsHolographyOvdCombinationBridge(article, selectedIdentityInterests = [], selectedSharedInterests = []) {
  const hasIdCardsSelected = selectedIdentityInterests.includes("id_cards");
  const selectedBridgeTechniqueInterests = selectedSharedInterests.filter((interestId) =>
    interestId === "holography" || interestId === "ovd"
  );

  if (!hasIdCardsSelected || !selectedBridgeTechniqueInterests.length) {
    return false;
  }

  const techniqueMatched = selectedBridgeTechniqueInterests.some((interestId) =>
    getSharedSecurityStandaloneAssessment(article, interestId).included
  );
  if (!techniqueMatched) {
    return false;
  }

  const context = getPersonalBoostContext(article);
  const articleText = [
    context.titleText,
    context.tagText,
    context.bodyText,
  ]
    .filter(Boolean)
    .join(" ");

  const hasStrongTechniqueEvidence = ID_CARDS_HOLOGRAPHY_OVD_BRIDGE_TECHNIQUE_TERMS.some((term) =>
    textMatchesKeyword(articleText, term)
  );
  const hasDocumentSecurityContext = ID_CARDS_HOLOGRAPHY_OVD_BRIDGE_DOCUMENT_TERMS.some((term) =>
    textMatchesKeyword(articleText, term)
  );

  return hasStrongTechniqueEvidence && hasDocumentSecurityContext;
}

function articleMatchesSelectedIdentityTechniqueBridge(article, selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests(selectedInterests);
  const selectedSharedInterests = getSelectedSharedSecuritySubinterests(selectedInterests);

  if (!selectedIdentityInterests.length || !selectedSharedInterests.length) {
    return false;
  }

  const identityScopeMatched = selectedIdentityInterests.some((interestId) =>
    computePersonalInterestBoost(article, interestId).score >= 18
  );
  if (!identityScopeMatched) {
    return false;
  }

  const context = getPersonalBoostContext(article);
  const articleText = [
    context.titleText,
    context.tagText,
    context.metadataText,
    context.bodyText,
  ]
    .filter(Boolean)
    .join(" ");

  return selectedSharedInterests.some((interestId) => {
    const standaloneAssessment = getSharedSecurityStandaloneAssessment(article, interestId);
    if (standaloneAssessment.included) {
      return true;
    }

    const combinationTerms = IDENTITY_SHARED_SECURITY_COMBINATION_TECHNIQUE_TERMS[interestId] || [];
    return combinationTerms.some((term) => textMatchesKeyword(articleText, term));
  });
}

// Identity Documents retrieval should start from secure-document intent, not generic travel/passport mentions.
const IDENTITY_DOCUMENT_RETRIEVAL_EXCLUSION_TERMS = [
  "agritourism passport",
  "food passport",
  "food & drink passport",
  "digital product passport",
  "product passport",
  "passport rankings",
  "travel rankings",
  "vacation",
  "holiday",
  "cruise",
  "tourism",
  "travel guide",
  "passport to paradise",
  "passport to leadership",
  "sports passport",
  "travel passport",
  "passport adventure",
  "passport program",
  "beach holiday",
  "luxury travel",
];
const IDENTITY_DOCUMENT_RETRIEVAL_SECURE_ANCHORS = [
  "issuance",
  "renewal",
  "application",
  "biometric",
  "icao",
  "doc 9303",
  "chip",
  "rfid",
  "nfc",
  "verification",
  "authentication",
  "fraud",
  "counterfeit",
  "inspection",
  "border control",
  "secure document",
  "passport office",
  "consular service",
  "passport authority",
  "polycarbonate",
  "laminate",
  "security feature",
  "security printing",
  "hologram",
  "kinegram",
  "micro optics",
  "intaglio",
  "guilloche",
  "laser engraving",
  "document security",
  "passport production",
  "passport manufacturing",
  "booklet production",
  "residence permit",
  "resident card",
  "immigration card",
  "permit issuance",
  "visa issuance",
  "evisa",
  "digital visa",
  "mrtd",
  "emrtd",
  "mrz",
  "pkd",
  "lds",
  "pace",
  "bac",
  "sac",
  "dtc",
  "digital travel credential",
  "entry/exit system",
  "ees",
  "etias",
  "egate",
  "e-gate",
  "abc gate",
  "document inspection",
  "immigration control",
  "automated border control",
];

function shouldExcludeIdentityDocumentsRetrievalCandidate(
  article,
  selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)
) {
  const selectedIdentitySubinterests = getSelectedIdentityDocumentSubinterests(selectedInterests);
  const selectedSet = new Set(selectedIdentitySubinterests);
  const context = getPersonalBoostContext(article);
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

  const hasExcludedTheme = IDENTITY_DOCUMENT_RETRIEVAL_EXCLUSION_TERMS.some((term) => textMatchesKeyword(haystack, term));
  if (!hasExcludedTheme) {
    return false;
  }

  const secureAnchorTerms = selectedSet.has("visas")
    ? IDENTITY_DOCUMENT_RETRIEVAL_SECURE_ANCHORS.concat([
      "visa issuance",
      "visa processing",
      "consular system",
      "immigration system",
      "visa verification",
      "travel authorization",
      "visa waiver",
      "visa exemption",
    ])
    : IDENTITY_DOCUMENT_RETRIEVAL_SECURE_ANCHORS;

  const hasSecureAnchor = secureAnchorTerms.some((term) => textMatchesKeyword(haystack, term));
  return !hasSecureAnchor;
}

const SHARED_SECURITY_BACKEND_RETRIEVAL_SEARCH_TERMS = {
  holography: [
    "hologram",
    "holograms",
    "holographic",
    "holography",
    "DOVID",
    "DOVIDs",
    "holographic foil",
  ],
  ovd: [
    "DOVID",
    "DOVIDs",
    "optically variable",
    "optically variable device",
    "optically variable feature",
    "OVD",
    "OVDs",
  ],
  micro_optics: [
    "micro optics",
    "micro-optics",
    "micro optic",
    "micro-optic",
    "micro lens",
    "micro-lens",
    "microlens",
    "nano optics",
    "nano-optics",
    "nanoDOVID",
    "Nanoswitch",
    "Nanovista",
  ],
  security_inks: [
    "security ink",
    "security inks",
    "fluorescent ink",
    "magnetic ink",
    "UV ink",
    "IR ink",
    "infrared ink",
    "color-shifting ink",
    "optically variable ink",
    "intaglio ink",
    "counterfeit cash",
    "Inkjet Passport Printer",
    "UV curable inks",
  ],
};

function getPersonalDashboardBackendDomainPlan() {
  const selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests);
  const selectedMainDomains = getSelectedMainDomains(selectedInterests);
  const hasInterest = (interestId) => selectedInterests.includes(interestId);
  const selectedSharedSecurityInterests = getSelectedSharedSecuritySubinterests(selectedInterests);
  const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests(selectedInterests);
  const selectedBanknoteInterests = selectedInterests.filter(
    (interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "banknote_intelligence"
  );
  const selectedDigitalIdentityInterests = selectedInterests.filter(
    (interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "digital_identity_biometrics"
  );

  if (
    selectedSharedSecurityInterests.length > 0 &&
    selectedIdentityInterests.length === 0 &&
    selectedBanknoteInterests.length === 0 &&
    selectedDigitalIdentityInterests.length === 0
  ) {
    const sharedSecuritySearches = new Set();
    selectedSharedSecurityInterests.forEach((interestId) => {
      (SHARED_SECURITY_BACKEND_RETRIEVAL_SEARCH_TERMS[interestId] || [])
        .forEach((term) => sharedSecuritySearches.add(term));
    });

    if (sharedSecuritySearches.size) {
      return {
        domain: "shared_security",
        includeTopicBaseline: false,
        searches: Array.from(sharedSecuritySearches),
      };
    }
  }

  if (!selectedInterests.length || !selectedMainDomains.length) {
    return null;
  }

  if (selectedMainDomains.length === 1 && selectedMainDomains[0] === "banknotes") {
    return {
      domain: "banknotes",
      topic: "Banknotes",
      searches: [
        "banknote",
        "currency",
        "central bank",
        "counterfeit",
        "polymer",
        "substrate",
        "security printing",
        "banknotenews",
        "notafilia",
        "mriguide",
        "reform.news",
      ],
    };
  }

  if (selectedMainDomains.length === 1 && selectedMainDomains[0] === "identity_documents") {
    const selectedIdentitySubinterests = getSelectedIdentityDocumentSubinterests(selectedInterests);
    const identitySearches = new Set(selectedIdentitySubinterests.length === 1 ? [] : [
      "passport issuance",
      "biometric passport",
      "passport verification",
      "passport security",
      "residence permit card",
      "biometric residence permit",
      "visa issuance",
      "evisa",
      "secure document",
      "document security",
      "polycarbonate",
      "icao",
      "doc 9303",
      "mrtd",
      "emrtd",
      "border control",
      "document inspection",
      "automated border control",
    ]);

    const addTerms = (terms = []) => {
      terms.forEach((term) => identitySearches.add(term));
    };

    if (selectedIdentitySubinterests.length === 1) {
      const selectedSubinterest = selectedIdentitySubinterests[0];
      if (selectedSubinterest === "passports") {
        addTerms([
          "passport issuance",
          "passport renewal",
          "biometric passport",
          "epassport",
          "e-passport",
          "machine readable travel document",
          "mrtd",
          "emrtd",
          "passport chip",
          "passport personalization",
          "passport personalisation",
          "passport verification",
          "passport authentication",
          "passport fraud",
          "passport office",
          "consular service",
          "passport authority",
          "passport polycarbonate",
          "passport laminate",
          "passport security features",
          "passport security printing",
          "passport hologram",
          "passport holography",
          "passport ovd",
          "passport kinegram",
          "passport micro optics",
          "passport intaglio",
          "passport guilloche",
          "passport laser engraving",
          "secure passport document",
          "passport production",
          "passport manufacturing",
        ]);
      } else if (selectedSubinterest === "id_cards") {
        addTerms([
          "id card",
          "identity card",
          "national id",
          "electronic identity card",
          "identity documents",
          "id documents",
          "physical identity documents",
          "secure id documents",
          "national id documents",
          "czech id",
          "hybrid id documents",
          "identity document protection",
          "id protection",
          "national identity guard",
          "card issuance",
          "polycarbonate id",
          "identity card design",
        ]);
      } else if (selectedSubinterest === "residence_permits") {
        addTerms([
          "residence permit",
          "residence permit card",
          "biometric residence permit",
          "residence card",
          "resident card",
          "foreign resident card",
          "immigration card",
          "residence document",
          "immigration document",
          "permit issuance",
          "permit renewal",
          "permit production",
          "permit personalization",
          "permit personalisation",
          "permit verification",
          "residence permit security features",
        ]);
      } else if (selectedSubinterest === "drivers_licenses") {
        addTerms([
          "driver license",
          "driver's license",
          "driving licence",
          "driver licence",
          "dmv",
          "license card",
          "real id",
          "mobile driver license",
          "digital driver license",
        ]);
      } else if (selectedSubinterest === "visas") {
        addTerms([
          "evisa",
          "digital visa",
          "electronic visa",
          "visa issuance",
          "visa processing",
          "consular systems",
          "immigration systems",
          "visa verification",
          "travel authorization",
          "visa waiver",
          "visa exemption",
        ]);
      } else if (selectedSubinterest === "polycarbonate") {
        addTerms([
          "polycarbonate",
          "polycarbonate card",
          "pc datapage",
          "passport datapage",
          "secure document material",
          "id card substrate",
        ]);
      } else if (selectedSubinterest === "fraud") {
        addTerms([
          "document fraud",
          "fake passport",
          "forged passport",
          "forged id",
          "counterfeit id",
          "fraudulent issuance",
          "fake identity document",
          "permit fraud",
          "document verification",
        ]);
      } else if (selectedSubinterest === "icao") {
        addTerms([
          "icao",
          "doc 9303",
          "mrtd",
          "emrtd",
          "epassport",
          "e-passport",
          "pkd",
          "lds",
          "pace",
          "bac",
          "sac",
          "active authentication",
          "chip authentication",
          "dtc",
          "digital travel credential",
          "mrz",
        ]);
      } else if (selectedSubinterest === "border_control") {
        addTerms([
          "border control",
          "passport control",
          "egate",
          "e-gate",
          "abc gate",
          "automated border control",
          "immigration control",
          "entry/exit system",
          "ees",
          "etias",
          "cbp",
          "frontex",
          "document inspection",
          "border inspection",
          "mobile passport control",
          "mpc",
          "biometric border",
          "facial recognition",
        ]);
      } else if (selectedSubinterest === "issuance") {
        addTerms([
          "document issuance",
          "passport issuance",
          "passport renewal",
          "secure issuance",
          "issuance system",
          "identity infrastructure",
        ]);
      } else if (selectedSubinterest === "laminate") {
        addTerms([
          "passport laminate",
          "laminated document",
          "security laminate",
          "document laminate",
        ]);
      }
    }

    if (hasInterest("passports")) {
      addTerms([
        "passport issuance",
        "passport renewal",
        "biometric passport",
        "epassport",
        "e-passport",
        "passport verification",
        "passport security",
        "passport fraud",
        "passport production",
      ]);
    }
    if (hasInterest("id_cards")) {
      addTerms([
        "identity card",
        "id card",
        "electronic identity card",
        "identity documents",
        "id documents",
        "hybrid id documents",
        "identity document protection",
        "national identity guard",
        "card issuance",
        "polycarbonate id",
      ]);
    }
    if (hasInterest("residence_permits")) {
      addTerms([
        "residence permit",
        "residence permit card",
        "biometric residence permit",
        "resident card",
        "permit issuance",
        "permit renewal",
        "immigration card",
      ]);
    }
    if (hasInterest("drivers_licenses")) {
      addTerms([
        "driver license",
        "driver's license",
        "driving licence",
      ]);
    }
    if (hasInterest("visas")) {
      addTerms([
        "visa issuance",
        "evisa",
        "digital visa",
        "visa processing",
        "consular systems",
        "immigration systems",
      ]);
    }
    if (hasInterest("laminate")) {
      addTerms([
        "passport laminate",
        "security laminate",
      ]);
    }
    if (hasInterest("polycarbonate")) {
      addTerms([
        "polycarbonate",
        "polycarbonate card",
        "passport datapage",
      ]);
    }
    if (hasInterest("issuance")) {
      addTerms([
        "document issuance",
        "passport issuance",
        "secure issuance",
      ]);
    }
    if (hasInterest("fraud")) {
      addTerms([
        "document fraud",
        "forged document",
        "fake passport",
      ]);
    }
    if (hasInterest("icao")) {
      addTerms([
        "icao",
        "doc 9303",
        "mrz",
        "emrtd",
        "pkd",
        "lds",
        "dtc",
      ]);
    }
    if (hasInterest("border_control")) {
      addTerms([
        "border control",
        "passport control",
        "automated border control",
        "entry/exit system",
        "ees",
        "etias",
        "document inspection",
      ]);
    }
    if (hasInterest("security_printing_core")) {
      addTerms([
        "security printing for passports",
        "secure document printing",
        "passport security printing",
      ]);
    }
    if (hasInterest("personalization")) {
      addTerms([
        "passport personalization",
        "card personalization",
        "laser personalization",
      ]);
    }

    return {
      domain: "identity_documents",
      topic: "Identity Documents",
      includeTopicBaseline: false,
      searches: Array.from(identitySearches),
    };
  }

  if (selectedMainDomains.length === 1 && selectedMainDomains[0] === "digital_identity_biometrics") {
    return {
      domain: "digital_identity_biometrics",
      topic: "Digital Identity & Biometrics",
      searches: [
        "digital identity",
        "biometric",
        "eid",
        "digital wallet",
        "kyc",
        "onboarding",
        "liveness",
        "identity verification",
      ],
    };
  }

  return {
    domain: selectedMainDomains.slice().sort().join("+"),
    topic: "",
    searches: [],
  };
}

function getPersonalBoostContext(article) {
  return getCachedArticleValue(article, "personalBoostContext", () => {
    const normalizedEvent = article?._intelligence?.normalizedEvent || normalizeIntelligenceEvent(article);
    const signalIds = getArticleSignalCategories(article);
    const signalLabels = signalIds
      .map((signalId) => getSignalCategoryById(signalId)?.label || signalId)
      .join(" ")
      .toLowerCase();
    const sourceText = [
      article?.source,
      article?.sourceName,
      article?.feedTitle,
      getFeedName(article?.feedId),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const domainText = [
      getFeedMatchDomain(article?.canonicalLink || article?.link || ""),
      getFeedMatchDomain(article?.feedUrl || ""),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      titleText: [article?.title, article?.normalizedTitle].filter(Boolean).join(" ").toLowerCase(),
      tagText: [
        Array.isArray(article?.tags) ? article.tags.join(" ") : "",
        Array.isArray(article?.keywords) ? article.keywords.join(" ") : "",
        getArticleFilterTags(article).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      metadataText: [
        article?.topic,
        sourceText,
        signalLabels,
        normalizedEvent?.canonicalEventType,
        normalizedEvent?.domain,
        normalizedEvent?.action,
        normalizedEvent?.documentType,
        normalizedEvent?.currency,
        normalizedEvent?.operationalContext,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      bodyText: [article?.summary, article?.summaryShort, article?.contentSnippet].filter(Boolean).join(" ").toLowerCase(),
      sourceText,
      domainText,
      topicType: String(article?.topicType || ""),
      topic: normalizeFilterTag(article?.topic || ""),
      signalIds,
      eventType: String(normalizedEvent?.canonicalEventType || ""),
      domain: String(normalizedEvent?.domain || ""),
    };
  });
}

function countBoostKeywordMatches(text, keywords = []) {
  return keywords.filter((keyword) => textMatchesKeyword(text, keyword)).length;
}

function getStrongBanknoteDomainSignalAssessment(article) {
  return getCachedArticleValue(article, "strongBanknoteDomainSignalAssessment", () => {
    const context = getPersonalBoostContext(article);
    const titleMatches = STRONG_BANKNOTE_DOMAIN_SIGNAL_TERMS.filter((term) => textMatchesKeyword(context.titleText, term));
    const tagMatches = STRONG_BANKNOTE_DOMAIN_SIGNAL_TERMS.filter((term) => textMatchesKeyword(context.tagText, term));
    const metadataMatches = STRONG_BANKNOTE_DOMAIN_SIGNAL_TERMS.filter((term) => textMatchesKeyword(context.metadataText, term));
    const bodyMatches = STRONG_BANKNOTE_DOMAIN_SIGNAL_TERMS.filter((term) => textMatchesKeyword(context.bodyText, term));
    const allMatchedTerms = Array.from(new Set([
      ...titleMatches,
      ...tagMatches,
      ...metadataMatches,
      ...bodyMatches,
    ]));
    const concreteIdentityMatches = CONCRETE_IDENTITY_DOCUMENT_ANCHOR_TERMS.filter((term) =>
      textMatchesKeyword(`${context.titleText} ${context.tagText} ${context.bodyText}`, term)
    );
    const hasCoreBanknoteSignal = STRONG_BANKNOTE_CORE_TERMS.some((term) =>
      textMatchesKeyword(`${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`, term)
    );
    const hasCentralBankSecurityThreadCombo =
      allMatchedTerms.includes("central bank") && allMatchedTerms.includes("security thread");
    const weightedScore =
      (titleMatches.length * 8) +
      (tagMatches.length * 5) +
      (metadataMatches.length * 4) +
      (bodyMatches.length * 1.25);
    const matched = weightedScore >= 8 && (hasCoreBanknoteSignal || hasCentralBankSecurityThreadCombo);
    const boost = matched ? Math.min(46, Math.round(16 + weightedScore + (allMatchedTerms.length * 3))) : 0;
    const identityPenalty = matched && !concreteIdentityMatches.length
      ? Math.min(42, Math.round(12 + weightedScore))
      : 0;

    return {
      matched,
      boost,
      identityPenalty,
      matchedTerms: allMatchedTerms,
      concreteIdentityMatches,
      weightedScore,
    };
  });
}

function getSecurityPrintingTopLevelAdjustment(context) {
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

  const matchedStrongSignals = SECURITY_PRINTING_TOP_LEVEL_STRONG_SIGNALS.filter((term) => textMatchesKeyword(haystack, term));
  const matchedMediumSignals = SECURITY_PRINTING_TOP_LEVEL_MEDIUM_SIGNALS.filter((term) => textMatchesKeyword(haystack, term));
  const matchedSupportTerms = SECURITY_PRINTING_TOP_LEVEL_SUPPORT_TERMS.filter((term) => textMatchesKeyword(haystack, term));
  const matchedNegativeTerms = SECURITY_PRINTING_TOP_LEVEL_NEGATIVE_TECH_TERMS.filter((term) => textMatchesKeyword(haystack, term));

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

function getPersonalDomainContextProfile(context, groupId) {
  const config = PERSONAL_DASHBOARD_DOMAIN_CONTEXTS[groupId];
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

  if (groupId === "banknote_intelligence" && (context.topicType === "banknote" || context.domain === "banknote")) {
    score += 12;
  }
  if (groupId === "identity_documents" && ["travel_passport", "identity_document", "dmv_driver_license"].includes(context.topicType)) {
    score += 10;
    score += countBoostKeywordMatches(context.titleText, [
      "biometric passport",
      "electronic passport",
      "emrtd",
      "mrtd",
      "identity card",
      "residence permit",
      "driver license",
      "polycarbonate",
      "document security",
      "document fraud",
    ]) * 4;
    score -= countBoostKeywordMatches(context.titleText, [
      "passport appointment",
      "passport photo",
      "travel tips",
      "vacation",
      "visa requirements",
      "celebrity passport",
      "political passport",
      "passport renewal",
      "immigration lawyer",
      "youtube",
      "tiktok",
      "instagram",
    ]) * 5;
  }
  if (groupId === "digital_identity_biometrics" && context.topicType === "digital_identity") {
    score += 10;
  }
  if (groupId === "security_printing" && (context.domain === "banknote" || context.topicType === "identity_document")) {
    score += 4;
    const securityPrintingAdjustment = getSecurityPrintingTopLevelAdjustment(context);
    score += securityPrintingAdjustment.bonus;
  }

  return {
    score,
    excludedHits,
  };
}

function computePersonalInterestBoost(article, interestId) {
  return getCachedArticleValue(article, `personalInterestBoost:${interestId}`, () => {
    const interest = PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId);
    if (!interest) {
      return { score: 0, matched: false };
    }

    const groupId = interest.groupId;
    const context = getPersonalBoostContext(article);
    const domainContext = getPersonalDomainContextProfile(context, groupId);
    const strongKeywords = Array.isArray(interest.strong) ? interest.strong : [];
    const weakKeywords = Array.isArray(interest.weak) ? interest.weak : [];
    const titleStrongHits = countBoostKeywordMatches(context.titleText, strongKeywords);
    const tagStrongHits = countBoostKeywordMatches(context.tagText, strongKeywords);
    const metaStrongHits = countBoostKeywordMatches(context.metadataText, strongKeywords);
    const bodyStrongHits = countBoostKeywordMatches(context.bodyText, strongKeywords);
    const titleWeakHits = countBoostKeywordMatches(context.titleText, weakKeywords);
    const tagWeakHits = countBoostKeywordMatches(context.tagText, weakKeywords);
    const metaWeakHits = countBoostKeywordMatches(context.metadataText, weakKeywords);
    const bodyWeakHits = countBoostKeywordMatches(context.bodyText, weakKeywords);
    let score = 0;
    const hasDomainContext = domainContext.score >= 6;
    const isGenericInterest = PERSONAL_DASHBOARD_GENERIC_INTEREST_IDS.has(interest.id);

    if (interest.id === "banknotes") {
      score += domainContext.score * 1.9;
    } else {
      score += domainContext.score * 0.65;
    }

    if (!isGenericInterest || hasDomainContext) {
      score += (titleStrongHits * 5.5) + (tagStrongHits * 4.5) + (metaStrongHits * 3.5) + (bodyStrongHits * 1.5);
      score += (titleWeakHits * 1.5) + (tagWeakHits * 1.5) + (metaWeakHits * 1) + (bodyWeakHits * 0.35);
    } else {
      score += (titleStrongHits * 1.25) + (tagStrongHits * 1) + (metaStrongHits * 0.75);
    }

    if (Array.isArray(interest.topicSignals) && interest.topicSignals.includes(context.topic)) {
      score += 10;
    }
    if (Array.isArray(interest.tagSignals) && interest.tagSignals.some((tagSignal) => textMatchesKeyword(context.tagText, tagSignal))) {
      score += 8;
    }
    if (Array.isArray(interest.signalIds) && interest.signalIds.some((signalId) => context.signalIds.includes(signalId))) {
      score += 4;
    }
    if (Array.isArray(interest.eventTypes) && interest.eventTypes.includes(context.eventType)) {
      score += 5;
    }
    if (isGenericInterest && !hasDomainContext) {
      score *= 0.2;
    }
    if (Array.isArray(SPECIALIST_SOURCE_INTERESTS[groupId]) && SPECIALIST_SOURCE_INTERESTS[groupId].some((specialistSource) =>
      context.sourceText.includes(specialistSource) || context.domainText.includes(specialistSource)
    )) {
      score += groupId === "banknote_intelligence" ? 18 : 10;
    }

    if (groupId === "banknote_intelligence") {
      const strongBanknoteSignals = getStrongBanknoteDomainSignalAssessment(article);
      score += strongBanknoteSignals.boost;
      const banknoteNoise = getBanknoteNoiseAssessment(article);
      score += Math.min(90, Math.round(banknoteNoise.positiveHits * 0.75));
      score -= Math.min(260, Math.round(banknoteNoise.totalNoiseHits * 2.4));
      if (banknoteNoise.weakTrumpDebate) {
        score -= 180;
      }
      if (isBanknoteSocialSource(article)) {
        score = Math.min(score, 42);
      }
      if (banknoteNoise.contaminated) {
        score -= 420;
      }
    }

    if (groupId === "identity_documents") {
      const signals = getIdentityDocumentInterestSignals(article);
      const authority = getIdentityDocumentSourceAuthority(article);
      const subinterestScore = getIdentityDocumentSubinterestScore(article);
      const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests();
      const selectedSubinterest = selectedIdentityInterests.length === 1 ? selectedIdentityInterests[0] : "";
      const borderAuthorityAdjustment = selectedSubinterest === "border_control"
        ? getBorderControlAuthorityAdjustment(article, authority)
        : { multiplier: authority.multiplier, sourceBoostScale: 1 };
      const genericDmvNoise = isGenericDmvNoise(article);
      const requiredContext = selectedSubinterest ? hasRequiredContextCombo(article, selectedSubinterest) : { matched: false, matchedCombos: [] };
      const hardPenaltyBase = selectedSubinterest ? Number(IDENTITY_REQUIRED_CONTEXT_STRICT_PENALTIES[selectedSubinterest] || 0) : 0;
      const borderTravelNoise = hasIdentityTravelNoise(article, IDENTITY_BORDER_CONTROL_TRAVEL_NOISE_TERMS);
      const borderTechContext = hasIdentityTravelNoise(article, IDENTITY_BORDER_CONTROL_TECH_TERMS);
      const passportLifestyleNoise = hasIdentityTravelNoise(article, IDENTITY_PASSPORT_LIGHT_NOISE_TERMS);
      const passportAnchorContext = hasIdentityTravelNoise(article, IDENTITY_PASSPORT_ANCHOR_TERMS);
      const visaSpamNoise = hasIdentityTravelNoise(article, IDENTITY_VISA_SPAM_TERMS);
      const selectedIntent = selectedSubinterest
        ? (subinterestScore.intentByInterest?.[selectedSubinterest] || {
          score: 0,
          matchedStrong: [],
          matchedWeak: [],
          matchedNegative: [],
        })
        : { score: 0, matchedStrong: [], matchedWeak: [], matchedNegative: [] };
      const selectedProfileSourcePriority = selectedSubinterest
        ? getIdentityProfileSourcePriorityBoost(article, selectedSubinterest)
        : { level: "none", boost: 0 };
      const selectedSoftNoise = selectedSubinterest
        ? getIdentityProfileSoftNoiseAssessment(article, selectedSubinterest)
        : { penalty: 0, hasNoise: false, hasStrongContext: false, matchedNoise: [], matchedStrongContext: [] };
      const borderMarketingPenalty = selectedSubinterest === "border_control"
        ? getBorderControlMarketingPagePenalty(article)
        : { penalty: 0 };
      const borderNewsPriority = selectedSubinterest === "border_control"
        ? getBorderControlNewsPriority(article)
        : { boost: 0, penalty: 0 };
      const residencePermitIntentAdjustment = selectedSubinterest === "residence_permits" || interestId === "residence_permits"
        ? getResidencePermitIntentAdjustment(article)
        : { hasCardIntent: false, cardBoost: 0, officialSourceBoost: 0, guidePenalty: 0 };
      const googleNewsArticle = isGoogleNewsArticle(article);
      const visualQualityScore = getArticleVisualQualityScore(article);
      const activeIdentityProfile = selectedSubinterest || interestId || "";
      const recencyAdjustment = getIdentityRecencyAdjustment(article);
      const googleNewsPenalty = getIdentityGoogleNewsPenalty(article, activeIdentityProfile);

      score += Math.min(80, Math.round(signals.primaryContextHits * 0.9));
      score += Math.round(authority.boost * borderAuthorityAdjustment.sourceBoostScale);
      score += Math.round(selectedProfileSourcePriority.boost * borderAuthorityAdjustment.sourceBoostScale);
      score += recencyAdjustment.boost;
      score -= selectedSoftNoise.penalty;
      if (selectedSubinterest === "border_control") {
        score += borderNewsPriority.boost;
        score -= borderNewsPriority.penalty;
      }
      score -= Math.min(90, Math.round(signals.noisyHits * 0.8));
      score += Math.max(-120, subinterestScore.score);
      score -= Math.min(110, subinterestScore.mismatchPenalty);
      if (googleNewsArticle) {
        score -= googleNewsPenalty.penalty;
      }

      if (selectedSubinterest && subinterestScore.bestSelectedScore < 8 && selectedSubinterest !== "drivers_licenses") {
        score -= 400;
      }
      if (subinterestScore.mismatchPenalty > HARD_SUBINTEREST_MISMATCH_THRESHOLD) {
        score -= 500;
      }
      if (genericDmvNoise && selectedSubinterest && selectedSubinterest !== "drivers_licenses") {
        score -= 700;
      }
      if (selectedSubinterest && ["passports", "residence_permits", "icao"].includes(selectedSubinterest)) {
        score += Math.min(120, Math.round(selectedIntent.score * 1.2));
        score += getIdentityIntentAuthorityBoost(article, selectedIntent.score);
        if (subinterestScore.travelNoiseArticle) {
          score -= 300;
        }
      }
      const selectedProfile = selectedSubinterest
        ? (subinterestScore.profileByInterest?.[selectedSubinterest] || {
          score: 0,
          authorityBoost: 0,
          matchedRequiredGroups: 0,
          matchedNegative: [],
          rejectionReasons: [],
        })
        : null;
      if (selectedProfile) {
        score += Math.min(160, Math.round(selectedProfile.score));
        if (selectedProfile.matchedNegative.length >= 2) {
          score -= 180;
        }
        if (selectedProfile.rejectionReasons.includes("missing_required_context")) {
          score -= 140;
        }
      }
      let hardPenaltyApplied = 0;
      if (hardPenaltyBase && !requiredContext.matched) {
        score -= hardPenaltyBase;
        hardPenaltyApplied += hardPenaltyBase;
      }
      if (selectedSubinterest === "border_control" && borderTravelNoise && !borderTechContext) {
        score -= 900;
        hardPenaltyApplied += 900;
      }
      if (selectedSubinterest === "border_control" && borderMarketingPenalty.penalty) {
        score -= borderMarketingPenalty.penalty;
      }
      if (selectedSubinterest === "passports" && passportLifestyleNoise && !passportAnchorContext) {
        score -= 260;
        hardPenaltyApplied += 260;
      }
      if (selectedSubinterest === "visas" && visaSpamNoise) {
        score -= 260;
        hardPenaltyApplied += 260;
      }

      if (interestId === "passports") {
        score += Math.min(90, Math.round((signals.passportHits * 0.7) + (selectedIntent.score * 1.1)));
        score -= Math.min(40, Math.round((signals.idCardHits + signals.driverLicenseHits) * 0.25));
        score -= Math.min(160, Math.round(signals.driverLicenseHits * 0.9));
        score -= Math.min(80, Math.round(signals.visaHits * 0.35));
        if (genericDmvNoise) {
          score -= 500;
        }
      } else if (interestId === "id_cards") {
        score += Math.min(90, Math.round(signals.idCardHits * 1.25));
        score += Math.min(120, Math.round((selectedProfile?.score || 0) * 0.85));
        score += Math.min(45, Math.round(signals.polycarbonateHits * 0.5));
        score -= Math.min(45, Math.round(signals.passportHits * 0.35));
      } else if (interestId === "residence_permits") {
        score += Math.min(110, Math.round((signals.residencePermitHits * 1.35) + (selectedIntent.score * 0.9)));
        score += residencePermitIntentAdjustment.cardBoost;
        score += residencePermitIntentAdjustment.officialSourceBoost;
        score -= residencePermitIntentAdjustment.guidePenalty;
        score -= Math.min(45, Math.round(signals.passportHits * 0.3));
        score -= Math.min(180, Math.round(signals.driverLicenseHits * 1.0));
        score -= Math.min(60, Math.round(signals.visaHits * 0.3));
      } else if (interestId === "drivers_licenses") {
        score += Math.min(90, Math.round(signals.driverLicenseHits * 1.35));
        score -= Math.min(45, Math.round(signals.passportHits * 0.35));
      } else if (interestId === "polycarbonate") {
        score += Math.min(100, Math.round(signals.polycarbonateHits * 1.5));
        score -= Math.min(140, Math.round(signals.driverLicenseHits * 0.75));
      } else if (interestId === "fraud") {
        score += Math.min(100, Math.round(signals.fraudHits * 1.45));
        score -= Math.min(160, Math.round(signals.driverLicenseHits * 0.9));
      } else if (interestId === "icao") {
        score += Math.min(120, Math.round((signals.icaoHits * 1.5) + (selectedIntent.score * 0.9)));
        score -= Math.min(180, Math.round(signals.driverLicenseHits * 1.0));
      } else if (interestId === "border_control") {
        score += Math.min(220, Math.round((signals.borderHits * 0.7) + ((selectedProfile?.score || 0) * 1.2)));
        if (selectedProfile?.rejectionReasons?.length) {
          score -= 140;
        }
      } else if (interestId === "visas") {
        score += Math.min(120, Math.round((signals.visaHits * 1.45) + (selectedIntent.score * 1.0)));
        score -= Math.min(200, Math.round(signals.driverLicenseHits * 1.1));
        score -= Math.min(90, Math.round(signals.passportHits * 0.45));
      } else if (interestId === "issuance") {
        score += Math.min(95, Math.round(signals.issuanceHits * 1.45));
        score -= Math.min(140, Math.round(signals.driverLicenseHits * 0.7));
      } else if (interestId === "laminate") {
        score += Math.min(95, Math.round(signals.laminateHits * 1.5));
        score -= Math.min(140, Math.round(signals.driverLicenseHits * 0.7));
      }
      score -= getStrongBanknoteDomainSignalAssessment(article).identityPenalty;

      if (DEBUG_PERSONAL_DASHBOARD && selectedSubinterest) {
        const intentScore = selectedIntent || {
          score: 0,
          matchedStrong: [],
          matchedWeak: [],
          matchedNegative: [],
        };
        debugPersonalDashboardLog("[identity-subinterest-hard-filter]", {
          selectedSubinterest,
          matchedSubinterest: subinterestScore.matchedSubinterest,
          mismatchPenalty: subinterestScore.mismatchPenalty,
          genericDmvNoise,
          finalScore: Math.round(score),
          title: article?.title || "Untitled article",
        });
        debugPersonalDashboardLog("[identity-intent-score]", {
          subinterest: selectedSubinterest,
          intentScore: intentScore.score,
          matchedStrong: intentScore.matchedStrong,
          matchedWeak: intentScore.matchedWeak,
          matchedNegative: intentScore.matchedNegative,
          travelNoiseArticle: subinterestScore.travelNoiseArticle,
          sourcePriorityLevel: selectedProfileSourcePriority.level,
          sourcePriorityBoost: selectedProfileSourcePriority.boost,
          recencyBoost: recencyAdjustment.boost,
          ageDays: Math.round(recencyAdjustment.ageDays),
          googleNewsPenalty: googleNewsPenalty.penalty,
          softNoisePenalty: selectedSoftNoise.penalty,
          googleNewsArticle,
          visualQualityScore,
          profileScore: selectedProfile?.score || 0,
          profileRejectionReasons: selectedProfile?.rejectionReasons || [],
          finalScore: Math.round(score),
          title: article?.title || "Untitled article",
        });
        debugPersonalDashboardLog("[identity-required-context]", {
          selectedSubinterest,
          requiredContextMatched: requiredContext.matched,
          matchedCombos: requiredContext.matchedCombos,
          hardPenaltyApplied,
          travelNoiseDetected: selectedSubinterest === "border_control" ? borderTravelNoise : subinterestScore.travelNoiseArticle,
          finalScore: Math.round(score),
          title: article?.title || "Untitled article",
          source: article?.source || article?.feedTitle || "",
        });
      }
    }

    score -= domainContext.excludedHits * 10;
    score = Math.max(0, Math.round(score));

    return {
      score,
      matched: score > 0,
    };
  });
}

function computePersonalBoost(article) {
  const selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests);
  const mode = normalizePersonalDashboardMode(state.personalDashboard.mode);
  const cacheKey = `personalBoost:${mode}:${selectedInterests.join("|")}`;
  return getCachedArticleValue(article, cacheKey, () => {
    if (!selectedInterests.length) {
      return {
        score: 0,
        level: "",
      };
    }

    const personalDomainScore = calculatePersonalDomainScore(article, selectedInterests);
    const score = personalDomainScore.domainScore;
    const bucket = getPersonalDomainBucket(article, selectedInterests);
    let level = "";

    if (bucket === "primary") {
      if (score >= 320) {
        level = "high";
      } else if (score >= 180) {
        level = "relevant";
      } else if (score >= 80) {
        level = "related";
      }
    } else if (bucket === "adjacent" && score >= 80) {
      level = "related";
    }

    return {
      score,
      level,
    };
  });
}

function getPersonalInterestSignature() {
  const selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests);
  const mode = normalizePersonalDashboardMode(state.personalDashboard.mode);
  return `${mode}:${selectedInterests.join("|")}`;
}

function contextMatchesSpecialistSource(context, groupId) {
  return Array.isArray(SPECIALIST_SOURCE_INTERESTS[groupId]) && SPECIALIST_SOURCE_INTERESTS[groupId].some((specialistSource) =>
    context.sourceText.includes(specialistSource) || context.domainText.includes(specialistSource)
  );
}

function getBanknoteSourceAuthority(article) {
  return getCachedArticleValue(article, "banknoteSourceAuthority", () => {
    const context = getPersonalBoostContext(article);
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    const hasAny = (values = []) => values.some((value) => textMatchesKeyword(sourceFingerprint, value));

    let level = "medium";
    let multiplier = 1.0;

    if (hasAny(BANKNOTE_SOURCE_AUTHORITY.veryHigh)) {
      level = "very_high";
      multiplier = 2.4;
    } else if (hasAny(BANKNOTE_SOURCE_AUTHORITY.high)) {
      level = "high";
      multiplier = 1.8;
    } else if (hasAny(BANKNOTE_SOURCE_AUTHORITY.veryLow)) {
      level = "very_low";
      multiplier = 0.15;
    } else if (hasAny(BANKNOTE_SOURCE_AUTHORITY.low)) {
      level = "low";
      multiplier = 0.45;
    }

    return {
      level,
      multiplier,
    };
  });
}

function getPersonalDashboardSelectedDomainConfig() {
  const selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests);
  const mainDomainSelections = new Map();
  const sharedInterestSelections = [];

  selectedInterests.forEach((interestId) => {
    const interest = PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId);
    if (!interest) {
      return;
    }

    if (PERSONAL_DASHBOARD_MAIN_DOMAIN_GROUP_IDS.has(interest.groupId)) {
      const existing = mainDomainSelections.get(interest.groupId) || [];
      existing.push(interestId);
      mainDomainSelections.set(interest.groupId, existing);
      return;
    }

    if (interest.groupId === PERSONAL_DASHBOARD_SHARED_GROUP_ID) {
      sharedInterestSelections.push(interestId);
    }
  });

  return {
    selectedInterests,
    mainDomainSelections,
    sharedInterestSelections,
  };
}

function getEffectivePersonalDashboardDomains() {
  const { mainDomainSelections, sharedInterestSelections } = getPersonalDashboardSelectedDomainConfig();
  const selectedDomains = Array.from(mainDomainSelections.keys());
  return selectedDomains.length
    ? selectedDomains
      : sharedInterestSelections.length
        ? ["banknote_intelligence", "identity_documents"]
        : [];
}

function mapPersonalDashboardGroupToMainDomain(groupId) {
  if (groupId === "banknote_intelligence") {
    return "banknotes";
  }
  if (groupId === "identity_documents") {
    return "identity_documents";
  }
  if (groupId === "digital_identity_biometrics") {
    return "digital_identity_biometrics";
  }
  if (groupId === PERSONAL_DASHBOARD_SHARED_GROUP_ID) {
    return "shared_security";
  }
  return "unknown";
}

function getSelectedMainDomains(selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  const normalizedInterests = normalizePersonalDashboardInterests(selectedInterests);
  const mainDomains = new Set();

  normalizedInterests.forEach((interestId) => {
    const groupId = PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId || "";
    const mappedDomain = mapPersonalDashboardGroupToMainDomain(groupId);
    if (mappedDomain === "banknotes" || mappedDomain === "identity_documents" || mappedDomain === "digital_identity_biometrics") {
      mainDomains.add(mappedDomain);
    }
  });

  return Array.from(mainDomains);
}

function isBanknotesOnlyPersonalSelection(selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  const selectedMainDomains = getSelectedMainDomains(selectedInterests);
  return selectedMainDomains.length === 1 && selectedMainDomains[0] === "banknotes";
}

function isBanknoteAuthoritySource(article) {
  return getCachedArticleValue(article, "isBanknoteAuthoritySource", () => {
    return getBanknoteSourceAuthority(article).level === "very_high";
  });
}

function getDigitalSubgroupHybridAssessment(article, interestId) {
  return getCachedArticleValue(article, `digitalSubgroupHybrid:${interestId}`, () => {
    const interest = PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId);
    if (!interest || interest.groupId !== "digital_identity_biometrics") {
      return {
        beforeIncluded: false,
        included: false,
        directMatch: false,
        hybridMatch: false,
        excludedWeakMatch: false,
        directStrongHits: 0,
        directWeakHits: 0,
        relatedHits: 0,
        interestScore: 0,
        domainScore: 0,
      };
    }

    const context = getPersonalBoostContext(article);
    const domainContext = getPersonalDomainContextProfile(context, "digital_identity_biometrics");
    const interestScore = computePersonalInterestBoost(article, interestId).score;
    const config = DIGITAL_SUBGROUP_HYBRID_FILTERS[interestId] || {
      minimumDomainScore: 11,
      minimumInterestScore: 20,
      related: [],
    };
    const strongKeywords = Array.isArray(interest.strong) ? interest.strong : [];
    const weakKeywords = Array.isArray(interest.weak) ? interest.weak : [];
    const relatedKeywords = Array.isArray(config.related) ? config.related : [];
    const preferredKeywords = Array.isArray(config.preferred) ? config.preferred : [];
    const crossKeywords = Array.isArray(config.cross) ? config.cross : [];

    const directStrongHits =
      countBoostKeywordMatches(context.titleText, strongKeywords) +
      countBoostKeywordMatches(context.tagText, strongKeywords) +
      countBoostKeywordMatches(context.metadataText, strongKeywords) +
      countBoostKeywordMatches(context.bodyText, strongKeywords);
    const directWeakHits =
      countBoostKeywordMatches(context.titleText, weakKeywords) +
      countBoostKeywordMatches(context.tagText, weakKeywords) +
      countBoostKeywordMatches(context.metadataText, weakKeywords) +
      countBoostKeywordMatches(context.bodyText, weakKeywords);
    const relatedHits =
      countBoostKeywordMatches(context.titleText, relatedKeywords) +
      countBoostKeywordMatches(context.tagText, relatedKeywords) +
      countBoostKeywordMatches(context.metadataText, relatedKeywords) +
      countBoostKeywordMatches(context.bodyText, relatedKeywords);
    const preferredHits =
      countBoostKeywordMatches(context.titleText, preferredKeywords) +
      countBoostKeywordMatches(context.tagText, preferredKeywords) +
      countBoostKeywordMatches(context.metadataText, preferredKeywords) +
      countBoostKeywordMatches(context.bodyText, preferredKeywords);
    const crossHits =
      countBoostKeywordMatches(context.titleText, crossKeywords) +
      countBoostKeywordMatches(context.tagText, crossKeywords) +
      countBoostKeywordMatches(context.metadataText, crossKeywords) +
      countBoostKeywordMatches(context.bodyText, crossKeywords);
    const minimumPreferredHits = Number(config.minimumPreferredHits || 0);
    const minimumNetEvidence = Number(config.minimumNetEvidence || 0);
    const netEvidence = (preferredHits + relatedHits + directStrongHits + directWeakHits) - crossHits;
    const preferredSatisfied = minimumPreferredHits <= 0 || preferredHits >= minimumPreferredHits;
    const conflictDominates = crossHits > 0 && netEvidence < minimumNetEvidence;
    const directStrongMatch = directStrongHits > 0;
    const directWeakOnlyMatch =
      !directStrongMatch &&
      directWeakHits > 0 &&
      interestScore >= config.minimumInterestScore &&
      preferredSatisfied &&
      !conflictDominates;

    const directMatch = directStrongMatch || directWeakOnlyMatch;
    const hybridMatch =
      !directMatch &&
      domainContext.score >= config.minimumDomainScore &&
      interestScore >= config.minimumInterestScore &&
      (directWeakHits > 0 || relatedHits > 0 || preferredHits > 0) &&
      preferredSatisfied &&
      netEvidence >= minimumNetEvidence &&
      !conflictDominates;
    const beforeIncluded = interestScore >= DIGITAL_SUBGROUP_BASELINE_MINIMUM_SCORE;
    const included = directMatch || hybridMatch;

    return {
      beforeIncluded,
      included,
      directMatch,
      hybridMatch,
      excludedWeakMatch: beforeIncluded && !included,
      directStrongHits,
      directWeakHits,
      relatedHits,
      preferredHits,
      crossHits,
      netEvidence,
      interestScore,
      domainScore: domainContext.score,
    };
  });
}

const SHARED_SECURITY_STANDALONE_RULES = {
  security_printing_core: {
    strong: [
      "security printing",
      "secure printing",
      "security printer",
      "banknote printing",
      "passport printing",
      "id card printing",
      "id document printing",
      "secure document production",
      "banknote security feature",
      "banknote security features",
      "passport security feature",
      "passport security features",
      "id card security feature",
      "id card security features",
      "mykad security feature",
      "mykad security features",
      "security thread",
      "security threads",
      "security foil",
      "security foils",
      "holographic security feature",
      "holographic security features",
      "optical security feature",
      "optical security features",
      "secure document",
      "secure documents",
      "physical security document",
      "physical security documents",
      "document security",
    ],
    weak: [
      "document printing",
      "secure print",
      "document protection",
      "anti-counterfeiting feature",
      "anti-counterfeiting features",
      "security feature",
      "security features",
    ],
    support: [
      "banknote",
      "banknotes",
      "passport",
      "passports",
      "id card",
      "identity card",
      "secure document",
      "secure documents",
      "travel document",
      "credential",
      "credentials",
      "document",
      "documents",
      "security printing",
      "printing works",
      "printer",
      "foil",
      "thread",
      "mykad",
      "residence permit",
      "visa sticker",
      "physical document",
    ],
    negative: [
      "digital identity",
      "digital wallet",
      "wallet onboarding",
      "cybersecurity",
      "cloud security",
      "ai security",
      "home security",
      "smart home",
      "phone security",
      "national security",
      "opensearch",
      "aws",
      "password",
      "account security",
      "domain security",
      "malware",
      "zero trust",
      "trump",
      "white house",
      "ballroom",
      "real estate",
      "travel guide",
      "tourism",
      "iata",
      "sap quality awards",
      "campus",
      "appointed to the board",
      "board appointment",
      "executive appointment",
      "appointed as",
      "recognized as",
      "grand winner",
      "award winner",
      "certified",
      "certification",
      "minergie-certified",
      "underserved communities",
      "community project",
      "community projects",
      "community initiative",
      "csr",
      "corporate social responsibility",
      "conference participation",
      "conference announcement",
      "event participation",
      "unconference",
      "dice",
      "digital travel experience",
      "travel experience initiative",
      "company milestone",
    ],
    weakOnlyMinScore: 24,
    minimumBodyStrongHits: 2,
  },
  security_inks: {
    strong: [
      "security ink",
      "security inks",
      "invisible ink",
      "fluorescent ink",
      "optically variable ink",
      "magnetic ink",
      "intaglio ink",
      "uv ink",
      "ir ink",
      "infrared ink",
      "color-shifting ink",
      "colour-shifting ink",
    ],
    weak: ["specialty ink", "security pigment", "pigment ink"],
    support: [
      "banknote",
      "banknotes",
      "passport",
      "passports",
      "identity document",
      "identity documents",
      "secure document",
      "secure documents",
      "security feature",
      "security features",
      "counterfeit",
      "counterfeiting",
      "currency",
      "document security",
      "security printing",
    ],
    negative: [
      "sap quality awards",
      "sap",
      "digital identity",
      "wallet",
      "tourism",
      "expo",
      "definition",
      "grammar",
      "pronunciation",
      "synonyms",
      "glosbe",
    ],
    requiresSupportContext: true,
    allowForegroundStrongWithoutSupport: true,
    weakOnlyMinScore: 26,
  },
  micro_optics: {
    strong: [
      "micro optics",
      "micro-optics",
      "micro optical",
      "micro optical elements",
      "micro and nano optical elements",
      "nano optical elements",
      "nano optical structures",
      "micro-optic structures",
      "optical microstructures",
      "nanoengineered optical structures",
      "nanofabricated optical structures",
      "nanostructures",
      "micro-segmentation",
      "nanofabrication",
      "nanoswitch",
      "nanovista",
    ],
    weak: [
      "optical security",
      "optical security features",
      "optical structures",
      "nanoengineered optical",
      "nanofabricated optical",
    ],
    negative: [
      "expo",
      "exhibition",
      "drug delivery",
      "tissue engineering",
      "bioengineering",
      "organ-on-chip",
      "mosque",
      "microneedles",
      "medical research",
      "photonic research",
      "photonics research",
      "vinyl",
      "vinyl records",
    ],
    support: [
      "security feature",
      "security features",
      "security printing",
      "secure document",
      "secure documents",
      "document security",
      "passport",
      "passports",
      "id card",
      "identity card",
      "identity document",
      "banknote",
      "banknotes",
      "anti-counterfeit",
      "counterfeit protection",
      "optical security",
    ],
    requiresSupportContext: true,
    allowForegroundStrongWithoutSupport: true,
    rejectNegativeMatches: true,
    weakOnlyMinScore: 3,
    minimumBodyStrongHits: 2,
  },
  holography: {
    strong: [
      "holography",
      "holographic",
      "hologram",
      "holograms",
      "dovid",
      "dovids",
      "nano dovid",
      "nanodovid",
      "holographic effects",
      "holographic security feature",
      "holographic foil",
    ],
    weak: ["diffractive", "diffractive optical"],
    negative: [
      "appointed",
      "board",
      "expo",
      "exhibition",
      "grand winner",
      "sap quality awards",
      "academic research",
      "university research",
      "vinyl",
      "vinyl records",
      "coin assortment",
      "commemorative coins",
      "precious metals",
      "investment packaging",
      "decorative holographic",
      "holographic decorative",
      "reddit",
    ],
    support: [
      "security feature",
      "security features",
      "security printing",
      "secure document",
      "secure documents",
      "document security",
      "passport",
      "passports",
      "id card",
      "identity card",
      "identity document",
      "banknote",
      "banknotes",
      "anti-counterfeit",
      "counterfeit protection",
      "ovd",
      "optically variable",
    ],
    requiresSupportContext: true,
    allowForegroundStrongWithoutSupport: true,
    rejectNegativeMatches: true,
    weakOnlyMinScore: 24,
  },
  ovd: {
    strong: [
      "optically variable device",
      "optically variable devices",
      "optically variable feature",
      "optically variable features",
      "optical security device",
      "optical security feature",
      "dovid",
      "dovids",
      "nano dovid",
      "nanodovid",
    ],
    weak: ["ovd", "ovds", "optically variable", "diffractive feature", "diffractive optical"],
    negative: [
      "digital identity",
      "wallet onboarding",
      "sap quality awards",
      "brandweer",
      "alarmering",
      "alarmeringen",
      "112",
      "officier van dienst",
      "middelbrand",
      "hoge urgentie",
      "normale urgentie",
      "p2000",
      "ambulance",
      "politie",
    ],
    support: [
      "optically variable",
      "optically variable device",
      "dovid",
      "dovids",
      "security feature",
      "security features",
      "secure document",
      "secure documents",
      "passport",
      "passports",
      "id card",
      "identity card",
      "identity document",
      "banknote",
      "banknotes",
      "hologram",
      "holograms",
      "holographic",
      "security printing",
    ],
    requiresSupportContext: true,
    allowForegroundStrongWithoutSupport: true,
    rejectNegativeMatches: true,
    weakOnlyMinScore: 22,
  },
};

const SHARED_SECURITY_STANDALONE_BODY_CONTEXT = {
  securityVendors: [
    "iq structures",
    "surys",
    "kurz",
    "sicpa",
    "in groupe",
    "ingroupe",
    "bundesdruckerei",
    "hid",
    "veridos",
    "idemia",
    "louisenthal",
  ],
  ovdExplicitBodyTerms: [
    "dovid",
    "dovids",
    "nano dovid",
    "nanodovid",
    "optically variable device",
    "optically variable devices",
    "optically variable feature",
    "optically variable features",
  ],
  securityInkStrongBodyTerms: [
    "security ink",
    "security inks",
    "fluorescent ink",
    "magnetic ink",
    "intaglio ink",
    "uv ink",
    "ir ink",
    "infrared ink",
    "color-shifting ink",
    "colour-shifting ink",
    "optically variable ink",
  ],
};

const SECURITY_PRINTING_TECHNIQUE_BRIDGE_KEYWORDS = [
  "holography",
  "holographic",
  "hologram",
  "holograms",
  "dovid",
  "dovids",
  "nano dovid",
  "nanodovid",
  "machine-readable holograms",
  "optically variable device",
  "optically variable devices",
  "optically variable feature",
  "optically variable features",
  "optical security device",
  "optical security feature",
  "optical security features",
  "micro optics",
  "micro-optics",
  "micro optical",
  "microlens",
  "micro-optic structures",
  "nano optics",
  "nanostructures",
  "optical microstructures",
  "anti-counterfeit",
  "anti counterfeit",
  "counterfeit prevention",
  "counterfeit protection",
  "anti-forgery",
  "brand protection",
];

const SECURITY_PRINTING_TECHNIQUE_BRIDGE_DOCUMENT_CONTEXT = [
  "banknote",
  "banknotes",
  "passport",
  "passports",
  "id card",
  "id cards",
  "identity document",
  "identity documents",
  "secure document",
  "secure documents",
  "physical document",
  "physical documents",
];

function getSharedSecurityStandaloneAssessment(article, interestId) {
  return getCachedArticleValue(article, `sharedSecurityStandalone:${interestId}`, () => {
    const interest = PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId);
    if (!interest || interest.groupId !== PERSONAL_DASHBOARD_SHARED_GROUP_ID) {
      return {
        included: false,
        directMatch: false,
        directStrongHits: 0,
        directWeakHits: 0,
        interestScore: 0,
        domainScore: 0,
      };
    }

    const context = getPersonalBoostContext(article);
    const metadataTextForMatching = interestId === "security_printing_core"
      ? String(context.metadataText || "").replace(/\bshared security printing\b/gi, " ").replace(/\s+/g, " ").trim()
      : context.metadataText;
    const tunedRule = SHARED_SECURITY_STANDALONE_RULES[interestId] || null;
    const strongKeywords = Array.isArray(tunedRule?.strong) ? tunedRule.strong : Array.isArray(interest.strong) ? interest.strong : [];
    const weakKeywords = Array.isArray(tunedRule?.weak) ? tunedRule.weak : Array.isArray(interest.weak) ? interest.weak : [];
    const supportKeywords = Array.isArray(tunedRule?.support) ? tunedRule.support : [];
    const negativeKeywords = Array.isArray(tunedRule?.negative) ? tunedRule.negative : [];
    const weakOnlyMinScore = Number(tunedRule?.weakOnlyMinScore || 22);
    const minimumBodyStrongHits = Number(tunedRule?.minimumBodyStrongHits || 2);

    const titleStrongHits = countBoostKeywordMatches(context.titleText, strongKeywords);
    const tagStrongHits = countBoostKeywordMatches(context.tagText, strongKeywords);
    const metaStrongHits = countBoostKeywordMatches(metadataTextForMatching, strongKeywords);
    const bodyStrongHits = countBoostKeywordMatches(context.bodyText, strongKeywords);
    const titleWeakHits = countBoostKeywordMatches(context.titleText, weakKeywords);
    const tagWeakHits = countBoostKeywordMatches(context.tagText, weakKeywords);
    const metaWeakHits = countBoostKeywordMatches(metadataTextForMatching, weakKeywords);
    const bodyWeakHits = countBoostKeywordMatches(context.bodyText, weakKeywords);
    const negativeHits =
      countBoostKeywordMatches(context.titleText, negativeKeywords) +
      countBoostKeywordMatches(metadataTextForMatching, negativeKeywords) +
      countBoostKeywordMatches(context.bodyText, negativeKeywords);
    const supportHits =
      countBoostKeywordMatches(context.titleText, supportKeywords) +
      countBoostKeywordMatches(context.tagText, supportKeywords) +
      countBoostKeywordMatches(metadataTextForMatching, supportKeywords) +
      countBoostKeywordMatches(context.bodyText, supportKeywords);
    const bridgeDocumentContextHits = interestId === "security_printing_core"
      ? (
        countBoostKeywordMatches(context.titleText, SECURITY_PRINTING_TECHNIQUE_BRIDGE_DOCUMENT_CONTEXT) +
        countBoostKeywordMatches(context.tagText, SECURITY_PRINTING_TECHNIQUE_BRIDGE_DOCUMENT_CONTEXT) +
        countBoostKeywordMatches(context.bodyText, SECURITY_PRINTING_TECHNIQUE_BRIDGE_DOCUMENT_CONTEXT)
      )
      : 0;
    const bridgeTitleHits = interestId === "security_printing_core"
      ? countBoostKeywordMatches(context.titleText, SECURITY_PRINTING_TECHNIQUE_BRIDGE_KEYWORDS)
      : 0;
    const bridgeTagHits = interestId === "security_printing_core"
      ? countBoostKeywordMatches(context.tagText, SECURITY_PRINTING_TECHNIQUE_BRIDGE_KEYWORDS)
      : 0;
    const bridgeBodyHits = interestId === "security_printing_core"
      ? countBoostKeywordMatches(context.bodyText, SECURITY_PRINTING_TECHNIQUE_BRIDGE_KEYWORDS)
      : 0;

    const foregroundStrongHits = titleStrongHits + tagStrongHits + metaStrongHits;
    const foregroundWeakHits = titleWeakHits + tagWeakHits + metaWeakHits;
    const directStrongHits = foregroundStrongHits + bodyStrongHits;
    const directWeakHits = foregroundWeakHits + bodyWeakHits;
    const bridgeForegroundHits = bridgeTitleHits + bridgeTagHits;
    const hasTechniqueBridgeContext = interestId === "security_printing_core" && (bridgeDocumentContextHits > 0 || supportHits > 0);
    const bridgeEvidenceHits = hasTechniqueBridgeContext ? bridgeForegroundHits + bridgeBodyHits : 0;
    const bridgeScore = hasTechniqueBridgeContext
      ? (
        (bridgeTitleHits * 3) +
        (bridgeTagHits * 2.5) +
        (bridgeBodyHits * 1.25)
      )
      : 0;
    const contentOnlyScore =
      (titleStrongHits * 5.5) +
      (tagStrongHits * 4.5) +
      (metaStrongHits * 3.5) +
      (bodyStrongHits * 1.5) +
      (titleWeakHits * 1.5) +
      (tagWeakHits * 1.5) +
      (metaWeakHits * 1) +
      (bodyWeakHits * 0.35) -
      (negativeHits * 8);
    const effectiveContentScore = contentOnlyScore + bridgeScore;

    const requiresSupportContext = interestId === "security_printing_core" || Boolean(tunedRule?.requiresSupportContext);
    const allowForegroundStrongWithoutSupport = Boolean(tunedRule?.allowForegroundStrongWithoutSupport);
    const hasSupportContext = !requiresSupportContext || supportHits > 0;
    const hasBridgeDrivenSupportContext = hasSupportContext || hasTechniqueBridgeContext;
    const sourceSecurityContextHits = countBoostKeywordMatches(
      `${context.sourceText} ${context.domainText} ${metadataTextForMatching}`,
      SHARED_SECURITY_STANDALONE_BODY_CONTEXT.securityVendors
    );
    const hasVendorSecurityContext = sourceSecurityContextHits > 0;
    const hasDocumentSecurityBodyContext = supportHits >= 3 || hasVendorSecurityContext;
    const ovdExplicitBodyHits = countBoostKeywordMatches(
      context.bodyText,
      SHARED_SECURITY_STANDALONE_BODY_CONTEXT.ovdExplicitBodyTerms
    );
    const securityInkBodyHits = countBoostKeywordMatches(
      context.bodyText,
      SHARED_SECURITY_STANDALONE_BODY_CONTEXT.securityInkStrongBodyTerms
    );
    const bodyContextBridgeMatch =
      negativeHits === 0 &&
      (
        (
          interestId === "holography" &&
          (
            (bodyStrongHits >= 3 && supportHits >= 3) ||
            (bodyStrongHits >= 2 && hasDocumentSecurityBodyContext)
          )
        ) ||
        (
          interestId === "ovd" &&
          ovdExplicitBodyHits > 0 &&
          supportHits >= 4
        ) ||
        (
          interestId === "micro_optics" &&
          bodyStrongHits > 0 &&
          (bodyWeakHits >= 2 || supportHits >= 4 || hasVendorSecurityContext) &&
          hasDocumentSecurityBodyContext
        ) ||
        (
          interestId === "security_inks" &&
          securityInkBodyHits > 0 &&
          supportHits >= 2
        )
      );
    const hardNegativeRejected = Boolean(tunedRule?.rejectNegativeMatches) && negativeHits > 0;

    // Standalone technique filters should depend on explicit technique language,
    // not merely on vendor/source affinity inside the broader shared-security layer.
    const directMatch =
      (foregroundStrongHits > 0 && (hasSupportContext || allowForegroundStrongWithoutSupport)) ||
      (foregroundWeakHits > 0 && contentOnlyScore >= weakOnlyMinScore && hasSupportContext) ||
      (bodyStrongHits >= minimumBodyStrongHits && contentOnlyScore >= weakOnlyMinScore && hasSupportContext) ||
      (
        hasBridgeDrivenSupportContext &&
        (
          bridgeForegroundHits > 0 ||
          (bridgeBodyHits >= 2 && (bodyStrongHits > 0 || bodyWeakHits > 0))
        )
      );
    const hybridMatch =
      !directMatch &&
      negativeHits === 0 &&
      hasBridgeDrivenSupportContext &&
      effectiveContentScore >= weakOnlyMinScore + 2 &&
      (foregroundWeakHits > 0 || bodyStrongHits >= minimumBodyStrongHits + 1 || bridgeBodyHits >= 2);
    const included = (directMatch || hybridMatch || bodyContextBridgeMatch) && !(
      negativeHits > 0 &&
      foregroundStrongHits === 0 &&
      bridgeEvidenceHits === 0
    ) && !hardNegativeRejected;

    return {
      included,
      directMatch,
      hybridMatch,
      bodyContextBridgeMatch,
      foregroundStrongHits,
      foregroundWeakHits,
      bodyStrongHits,
      bodyWeakHits,
      supportHits,
      sourceSecurityContextHits,
      bridgeDocumentContextHits,
      bridgeEvidenceHits,
      negativeHits,
      directStrongHits,
      directWeakHits,
      interestScore: Math.max(0, Math.round(effectiveContentScore)),
      domainScore: 0,
    };
  });
}

function isBanknoteSocialSource(article) {
  return getCachedArticleValue(article, "isBanknoteSocialSource", () => {
    const context = getPersonalBoostContext(article);
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    return [
      "reddit",
      "facebook",
      "instagram",
      "tiktok",
      "x.com",
      "twitter",
      "linkedin",
    ].some((value) => textMatchesKeyword(sourceFingerprint, value));
  });
}

function getIdentityDocumentSourceAuthority(article) {
  return getCachedArticleValue(article, "identityDocumentSourceAuthority", () => {
    const context = getPersonalBoostContext(article);
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    const hasAny = (values = []) => values.some((value) => textMatchesKeyword(sourceFingerprint, value));
    const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests();
    const onlyDriverLicensesSelected =
      selectedIdentityInterests.length === 1 && selectedIdentityInterests[0] === "drivers_licenses";
    const dmvAuthoritySource = ["dmv", "driver license agency", "motor vehicle", "department of motor vehicles"]
      .some((value) => textMatchesKeyword(sourceFingerprint, value));

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

    if (dmvAuthoritySource && !onlyDriverLicensesSelected && !isDriverLicenseSpecificArticle(article)) {
      boost = Math.min(boost, 10);
      multiplier = Math.min(multiplier, 1.0);
      if (level === "very_high" || level === "high") {
        level = "medium";
      }
    }

    return {
      level,
      multiplier,
      boost,
    };
  });
}

function getIdentityDocumentInterestSignals(article) {
  return getCachedArticleValue(article, "identityDocumentInterestSignals", () => {
    const context = getPersonalBoostContext(article);
    const weightedHits = (terms = []) =>
      (countBoostKeywordMatches(context.titleText, terms) * 5) +
      (countBoostKeywordMatches(context.tagText, terms) * 2.5) +
      (countBoostKeywordMatches(context.metadataText, terms) * 2.5) +
      countBoostKeywordMatches(context.bodyText, terms);

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
    const idCardTerms = [
      "identity card",
      "id card",
      "national id",
      "electronic identity card",
      "identity documents",
      "id documents",
      "physical identity documents",
      "secure id documents",
      "national id documents",
      "czech id",
      "hybrid id documents",
      "national identity guard",
      "identity document protection",
      "id protection",
      "polycarbonate id",
      "card issuance",
      "card design",
    ];
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
    const driverLicenseTerms = [
      "driver license",
      "driver's license",
      "driving licence",
      "license card",
      "dmv",
    ];
    const polycarbonateTerms = [
      "polycarbonate",
      "pc datapage",
      "polycarbonate card",
      "passport datapage",
      "secure document material",
    ];
    const fraudTerms = [
      "document fraud",
      "fake passport",
      "forged passport",
      "forged document",
      "counterfeit id",
      "fraudulent issuance",
    ];
    const icaoTerms = [
      "icao",
      "doc 9303",
      "mrz",
      "mrtd",
      "emrtd",
      "travel document standards",
      "compliance",
    ];
    const borderTerms = [
      "border control",
      "border verification",
      "passport control",
      "document checks",
      "travel document inspection",
      "e-gates",
    ];
    const visaTerms = [
      "visa",
      "visas",
      "visa document",
      "visa sticker",
      "evisa",
      "electronic visa",
      "visa issuance",
      "visa security",
    ];
    const issuanceTerms = [
      "document issuance",
      "passport issuance",
      "identity card issuance",
      "residence permit issuance",
      "visa issuance",
      "secure issuance",
    ];
    const laminateTerms = [
      "laminate",
      "laminated document",
      "security laminate",
      "passport laminate",
      "id laminate",
    ];
    const personalizationTerms = [
      "personalization",
      "passport personalization",
      "card personalization",
      "secure personalization",
      "document personalization",
    ];
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
      "passport child support",
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
      primaryContextHits: weightedHits(primaryContextTerms),
      passportHits: weightedHits(passportTerms),
      idCardHits: weightedHits(idCardTerms),
      residencePermitHits: weightedHits(residencePermitTerms),
      driverLicenseHits: weightedHits(driverLicenseTerms),
      polycarbonateHits: weightedHits(polycarbonateTerms),
      fraudHits: weightedHits(fraudTerms),
      icaoHits: weightedHits(icaoTerms),
      borderHits: weightedHits(borderTerms),
      visaHits: weightedHits(visaTerms),
      issuanceHits: weightedHits(issuanceTerms),
      laminateHits: weightedHits(laminateTerms),
      personalizationHits: weightedHits(personalizationTerms),
      noisyHits: weightedHits(noisyTerms),
    };
  });
}

function isDriverLicenseSpecificArticle(article) {
  const context = getPersonalBoostContext(article);
  const text = `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`;
  return [
    "real id",
    "driver license",
    "driver's license",
    "driving licence",
    "driver licence",
    "cdl",
    "mobile driver license",
    "digital driver license",
    "state id card",
    "license card",
  ].some((keyword) => textMatchesKeyword(text, keyword));
}

function isGenericDmvNoise(article) {
  const text = [
    article?.title || "",
    article?.description || "",
    article?.summary || "",
    article?.summaryShort || "",
    article?.content || "",
    article?.contentSnippet || "",
  ]
    .join(" ")
    .toLowerCase();

  const noiseKeywords = [
    "resurfacing",
    "highway",
    "flood maps",
    "forestry",
    "immunization",
    "road work",
    "traffic",
    "vehicle registration",
    "parking",
    "bridge",
    "transportation",
    "construction",
    "weather",
    "snow removal",
    "lane closure",
    "pavement",
    "freeway",
    "detour",
    "road maintenance",
  ];

  return noiseKeywords.some((keyword) => text.includes(keyword));
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

function getIdentityDocumentIntentText(article) {
  const context = getPersonalBoostContext(article);
  return [
    context.titleText,
    context.tagText,
    context.metadataText,
    context.bodyText,
  ]
    .filter(Boolean)
    .join(" ");
}

const IDENTITY_INTENT_AUTHORITY_SOURCES = [
  "keesing",
  "biometric update",
  "regula",
  "hid",
  "entrust",
  "veridos",
  "bundesdruckerei",
  "in groupe",
  "security document world",
];

function isIdentityTravelNoiseArticle(article) {
  return getCachedArticleValue(article, "identityTravelNoiseArticle", () => {
    const context = getPersonalBoostContext(article);
    const text = [
      context.titleText,
      context.tagText,
      context.metadataText,
      context.bodyText,
      context.sourceText,
      context.domainText,
    ]
      .filter(Boolean)
      .join(" ");

    const travelNoiseTerms = [
      "visa-free",
      "tourist",
      "tourism",
      "travel destination",
      "vacation",
      "airline",
      "holiday",
      "travel ranking",
      "destination ranking",
      "cheap flights",
      "airport hotel",
      "travel guide",
      "travel tips",
    ];
    const secureDocumentAnchors = [
      "issuance",
      "biometric",
      "verification",
      "security",
      "personalization",
      "border",
      "icao",
      "document",
      "passport chip",
      "emrtd",
      "mrtd",
      "mrz",
      "consular",
    ];

    const hasTravelNoise = travelNoiseTerms.some((term) => textMatchesKeyword(text, term));
    const hasSecureDocumentAnchor = secureDocumentAnchors.some((term) => textMatchesKeyword(text, term));
    return hasTravelNoise && !hasSecureDocumentAnchor;
  });
}

function getIdentityIntentAuthorityBoost(article, intentScore) {
  if (intentScore <= 10) {
    return 0;
  }

  const context = getPersonalBoostContext(article);
  const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
  return IDENTITY_INTENT_AUTHORITY_SOURCES.some((value) => textMatchesKeyword(sourceFingerprint, value)) ? 20 : 0;
}

function normalizeIdentityNavTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isIdentityNavigationPageArticle(article) {
  return getCachedArticleValue(article, "identityNavigationPageArticle", () => {
    const context = getPersonalBoostContext(article);
    const normalizedTitle = normalizeIdentityNavTitle(article?.title || "");
    const linkValue = `${article?.link || ""} ${article?.canonicalLink || ""}`.toLowerCase();
    const strongContextTerms = Array.from(
      new Set([
        ...Object.values(IDENTITY_PROFILE_STRONG_CONTEXT_TERMS).flatMap((terms) => terms),
        "news",
        "newsroom",
        "press",
        "media",
        "announcement",
        "announcements",
        "update",
        "updates",
      ])
    );
    const hasStrongContext = strongContextTerms.some((term) =>
      textMatchesKeyword(
        [
          context.titleText,
          context.tagText,
          context.metadataText,
          context.bodyText,
          context.sourceText,
          context.domainText,
        ]
          .filter(Boolean)
          .join(" "),
        term
      )
    );
    const titleBlocked = IDENTITY_WEBSITE_NAV_TITLE_TERMS.some((pattern) => {
      if (normalizedTitle === pattern) {
        return true;
      }

      const suffix = normalizedTitle.slice(pattern.length).trim();
      return normalizedTitle.startsWith(`${pattern} `) && suffix.length > 0 && suffix.length <= 24;
    });
    const blockedUrl = IDENTITY_WEBSITE_NAV_URL_SEGMENTS.some((segment) => linkValue.includes(segment));

    return titleBlocked || (blockedUrl && !hasStrongContext);
  });
}

function getBorderControlMarketingPagePenalty(article) {
  return getCachedArticleValue(article, "borderControlMarketingPagePenalty", () => {
    const context = getPersonalBoostContext(article);
    const normalizedTitle = normalizeIdentityNavTitle(article?.title || "");
    const linkValue = `${article?.link || ""} ${article?.canonicalLink || ""}`.toLowerCase();
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    const strongContextTerms = [
      ...IDENTITY_PROFILE_STRONG_CONTEXT_TERMS.border_control,
      "news",
      "newsroom",
      "press",
      "media",
      "announcement",
      "announcements",
      "case study",
      "case studies",
    ];
    const hasStrongContext = strongContextTerms.some((term) =>
      textMatchesKeyword(
        [
          context.titleText,
          context.tagText,
          context.metadataText,
          context.bodyText,
          context.sourceText,
          context.domainText,
        ]
          .filter(Boolean)
          .join(" "),
        term
      )
    );
    const marketingTitleMatches = IDENTITY_WEBSITE_MARKETING_TITLE_TERMS.filter((term) => normalizedTitle.includes(term));
    const marketingUrl = IDENTITY_WEBSITE_MARKETING_URL_SEGMENTS.some((segment) => linkValue.includes(segment));
    const veridosArticle = textMatchesKeyword(sourceFingerprint, "veridos");
    const veridosPreferredContext = ["press", "media", "news", "announcement", "announcements", "case study", "case studies"]
      .some((term) => textMatchesKeyword([context.titleText, context.metadataText, context.bodyText].join(" "), term));

    let penalty = 0;
    if ((marketingTitleMatches.length || marketingUrl) && !hasStrongContext) {
      penalty += 180 + (marketingTitleMatches.length * 35);
    } else if (marketingTitleMatches.length || marketingUrl) {
      penalty += 45;
    }

    if (veridosArticle && (marketingTitleMatches.length || marketingUrl) && !veridosPreferredContext) {
      penalty += 140;
    }

    return {
      penalty,
      hasStrongContext,
      marketingTitleMatches,
      marketingUrl,
      veridosPreferredContext,
    };
  });
}

function getBorderControlNewsPriority(article) {
  return getCachedArticleValue(article, "borderControlNewsPriority", () => {
    const context = getPersonalBoostContext(article);
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
    const normalizedTitle = normalizeIdentityNavTitle(article?.title || "");
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    const recencyAdjustment = getIdentityRecencyAdjustment(article);

    const matchedNewsSignals = BORDER_CONTROL_NEWS_SIGNAL_TERMS.filter((term) => textMatchesKeyword(haystack, term));
    const matchedNewsContext = BORDER_CONTROL_NEWS_CONTEXT_TERMS.filter((term) => textMatchesKeyword(haystack, term));
    const matchedProductTerms = BORDER_CONTROL_PRODUCT_PAGE_TERMS.filter((term) => textMatchesKeyword(normalizedTitle, term) || textMatchesKeyword(haystack, term));
    const vendorSource = BORDER_CONTROL_VENDOR_SOURCE_TERMS.some((term) => textMatchesKeyword(sourceFingerprint, term));
    const newslikeSourceContext = ["news", "newsroom", "press", "media", "announcement", "announcements", "case study", "case studies"]
      .some((term) => textMatchesKeyword(haystack, term));

    let boost = 0;
    let penalty = 0;

    boost += matchedNewsSignals.length * 28;
    boost += matchedNewsContext.length * 44;

    if (vendorSource && (matchedNewsSignals.length || matchedNewsContext.length || newslikeSourceContext)) {
      boost += 70;
    }

    if (recencyAdjustment.ageDays <= 30 && (matchedNewsSignals.length || matchedNewsContext.length)) {
      boost += 45;
    } else if (recencyAdjustment.ageDays <= 90 && (matchedNewsSignals.length || matchedNewsContext.length)) {
      boost += 20;
    }

    if (matchedProductTerms.length) {
      penalty += 70 + (matchedProductTerms.length * 18);
      if (!matchedNewsSignals.length && !matchedNewsContext.length) {
        penalty += 60;
      }
      if (vendorSource && !newslikeSourceContext && !matchedNewsContext.length) {
        penalty += 45;
      }
    }

    return {
      boost,
      penalty,
      matchedNewsSignals,
      matchedNewsContext,
      matchedProductTerms,
      vendorSource,
      newslikeSourceContext,
    };
  });
}

function getBorderControlContentType(article) {
  return getCachedArticleValue(article, "borderControlContentType", () => {
    const newsPriority = getBorderControlNewsPriority(article);
    const marketingPenalty = getBorderControlMarketingPagePenalty(article);
    const aggregated = isGoogleNewsArticle(article);
    const linkValue = `${article?.link || ""} ${article?.canonicalLink || ""}`.toLowerCase();
    const hasNewsUrl = BORDER_CONTROL_NEWS_URL_SEGMENTS.some((segment) => linkValue.includes(segment));
    const hasPublicationDate = Boolean(getArticlePublishedTimestamp(article));
    const hasAnnouncementLanguage =
      newsPriority.matchedNewsSignals.length > 0
      || newsPriority.matchedNewsContext.length > 0
      || marketingPenalty.veridosPreferredContext;
    const strongProductSignals =
      (marketingPenalty.marketingTitleMatches?.length || 0)
      + (marketingPenalty.marketingUrl ? 1 : 0)
      + newsPriority.matchedProductTerms.length;

    let type = "NEWS";
    if (aggregated) {
      type = "AGGREGATED_NEWS";
    } else if (
      marketingPenalty.marketingUrl
      && !hasNewsUrl
      && !hasAnnouncementLanguage
      && (!hasPublicationDate || strongProductSignals > 0)
    ) {
      type = "PRODUCT";
    } else if (strongProductSignals > 0 && newsPriority.matchedNewsSignals.length === 0) {
      type = "PRODUCT";
    } else if ((marketingPenalty.marketingTitleMatches?.length || marketingPenalty.marketingUrl) && newsPriority.matchedNewsSignals.length <= 1 && newsPriority.matchedNewsContext.length === 0) {
      type = "PRODUCT";
    } else if (newsPriority.matchedProductTerms.length >= 2 && newsPriority.matchedNewsContext.length === 0) {
      type = "PRODUCT";
    }

    const rank = type === "NEWS" ? 0 : type === "PRODUCT" ? 1 : 2;
    return {
      type,
      rank,
      aggregated,
      hasNewsSignals: newsPriority.matchedNewsSignals.length > 0 || newsPriority.matchedNewsContext.length > 0,
      hasProductSignals: newsPriority.matchedProductTerms.length > 0 || Boolean(marketingPenalty.marketingUrl),
      strongProductSignals,
      hasNewsUrl,
      hasAnnouncementLanguage,
    };
  });
}

function getBorderControlAuthorityAdjustment(article, authority) {
  return getCachedArticleValue(article, "borderControlAuthorityAdjustment", () => {
    const contentType = getBorderControlContentType(article);
    if (contentType.type !== "PRODUCT") {
      return {
        multiplier: Number(authority?.multiplier || 1),
        sourceBoostScale: 1,
      };
    }

    return {
      multiplier: 1 + ((Number(authority?.multiplier || 1) - 1) * 0.2),
      sourceBoostScale: 0.5,
    };
  });
}

function getBorderControlGuidancePenalty(article) {
  return getCachedArticleValue(article, "borderControlGuidancePenalty", () => {
    const context = getPersonalBoostContext(article);
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
    const matchedGuidanceTerms = BORDER_CONTROL_GUIDANCE_NOISE_TERMS.filter((term) =>
      textMatchesKeyword(haystack, term)
    );
    const matchedOperationalTerms = BORDER_CONTROL_OPERATIONAL_PRIORITY_TERMS.filter((term) =>
      textMatchesKeyword(haystack, term)
    );

    let penalty = 0;
    if (matchedGuidanceTerms.length) {
      penalty += 45 + (matchedGuidanceTerms.length * 20);
      if (!matchedOperationalTerms.length) {
        penalty += 110;
      } else {
        penalty -= Math.min(70, matchedOperationalTerms.length * 14);
      }
    }

    return {
      penalty: Math.max(0, penalty),
      matchedGuidanceTerms,
      matchedOperationalTerms,
      hasOperationalContext: matchedOperationalTerms.length > 0,
    };
  });
}

function getBorderControlRecencyAdjustment(article) {
  return getCachedArticleValue(article, "borderControlRecencyAdjustment", () => {
    const publishedAt = getArticlePublishedTimestamp(article);
    if (!publishedAt) {
      return {
        ageDays: Number.POSITIVE_INFINITY,
        boost: -35,
      };
    }

    const ageDays = Math.max(0, (Date.now() - publishedAt) / (24 * 60 * 60 * 1000));
    let boost = 0;

    if (ageDays <= 30) {
      boost = 140;
    } else if (ageDays <= 90) {
      boost = 85;
    } else if (ageDays <= 180) {
      boost = 30;
    } else if (ageDays <= 365) {
      boost = 0;
    } else if (ageDays <= 730) {
      boost = -70;
    } else {
      boost = -160;
    }

    return {
      ageDays,
      boost,
    };
  });
}

function getResidencePermitIntentAdjustment(article) {
  return getCachedArticleValue(article, "residencePermitIntentAdjustment", () => {
    const context = getPersonalBoostContext(article);
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;

    const titleCardHits = countBoostKeywordMatches(context.titleText, RESIDENCE_PERMIT_CARD_PRIORITY_TERMS);
    const tagCardHits = countBoostKeywordMatches(context.tagText, RESIDENCE_PERMIT_CARD_PRIORITY_TERMS);
    const metaCardHits = countBoostKeywordMatches(context.metadataText, RESIDENCE_PERMIT_CARD_PRIORITY_TERMS);
    const bodyCardHits = countBoostKeywordMatches(context.bodyText, RESIDENCE_PERMIT_CARD_PRIORITY_TERMS);
    const totalCardHits = titleCardHits + tagCardHits + metaCardHits + bodyCardHits;
    const hasCardIntent = totalCardHits > 0;

    let cardBoost = 0;
    cardBoost += titleCardHits * 26;
    cardBoost += tagCardHits * 18;
    cardBoost += metaCardHits * 16;
    cardBoost += bodyCardHits * 8;
    cardBoost = Math.min(210, cardBoost);

    const officialSourceHits = RESIDENCE_PERMIT_OFFICIAL_SOURCE_TERMS.filter((term) =>
      textMatchesKeyword(sourceFingerprint, term)
    ).length;
    const officialSourceBoost = hasCardIntent
      ? Math.min(140, officialSourceHits * 38)
      : 0;

    const titleGuideHits = countBoostKeywordMatches(context.titleText, RESIDENCE_PERMIT_GUIDE_NOISE_TERMS);
    const tagGuideHits = countBoostKeywordMatches(context.tagText, RESIDENCE_PERMIT_GUIDE_NOISE_TERMS);
    const metaGuideHits = countBoostKeywordMatches(context.metadataText, RESIDENCE_PERMIT_GUIDE_NOISE_TERMS);
    const bodyGuideHits = countBoostKeywordMatches(context.bodyText, RESIDENCE_PERMIT_GUIDE_NOISE_TERMS);

    let guidePenalty = 0;
    guidePenalty += titleGuideHits * 34;
    guidePenalty += tagGuideHits * 24;
    guidePenalty += metaGuideHits * 18;
    guidePenalty += bodyGuideHits * 10;
    if (hasCardIntent) {
      guidePenalty = Math.max(0, guidePenalty - Math.min(120, cardBoost * 0.55));
    }
    guidePenalty = Math.min(220, guidePenalty);

    return {
      hasCardIntent,
      cardBoost,
      officialSourceBoost,
      guidePenalty,
      officialSourceHits,
    };
  });
}

function getIdentityProfileSourcePriorityBoost(article, profileId) {
  return getCachedArticleValue(article, `identityProfileSourcePriority:${profileId}`, () => {
    const profile = IDENTITY_PROFILE_SOURCE_PRIORITY[profileId];
    if (!profile) {
      return {
        level: "none",
        boost: 0,
      };
    }

    const context = getPersonalBoostContext(article);
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    const hasAny = (values = []) => values.some((value) => textMatchesKeyword(sourceFingerprint, value));

    if (hasAny(profile.strong)) {
      return {
        level: "strong",
        boost: 220,
      };
    }

    if (hasAny(profile.medium)) {
      return {
        level: "medium",
        boost: 95,
      };
    }

    return {
      level: "none",
      boost: 0,
    };
  });
}

function getIdentityProfileSoftNoiseAssessment(article, profileId) {
  return getCachedArticleValue(article, `identityProfileSoftNoise:${profileId}`, () => {
    const noiseTerms = Array.isArray(IDENTITY_PROFILE_SOFT_NOISE_TERMS[profileId])
      ? IDENTITY_PROFILE_SOFT_NOISE_TERMS[profileId]
      : [];
    const strongContextTerms = Array.isArray(IDENTITY_PROFILE_STRONG_CONTEXT_TERMS[profileId])
      ? IDENTITY_PROFILE_STRONG_CONTEXT_TERMS[profileId]
      : [];
    const context = getPersonalBoostContext(article);
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

    const matchedNoise = noiseTerms.filter((term) => textMatchesKeyword(haystack, term));
    const matchedStrongContext = strongContextTerms.filter((term) => textMatchesKeyword(haystack, term));

    let penalty = 0;
    if (matchedNoise.length) {
      penalty += matchedNoise.length * 28;
      if (!matchedStrongContext.length) {
        penalty += 110;
      } else {
        penalty -= Math.min(60, matchedStrongContext.length * 12);
      }
    }

    return {
      matchedNoise,
      matchedStrongContext,
      hasNoise: matchedNoise.length > 0,
      hasStrongContext: matchedStrongContext.length > 0,
      penalty: Math.max(0, penalty),
    };
  });
}

function getIdentityRecencyAdjustment(article) {
  return getCachedArticleValue(article, "identityRecencyAdjustment", () => {
    const publishedAt = getArticlePublishedTimestamp(article);
    if (!publishedAt) {
      return {
        ageDays: Number.POSITIVE_INFINITY,
        boost: -45,
      };
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

    return {
      ageDays,
      boost,
    };
  });
}

function getIdentityGoogleNewsPenalty(article, profileId) {
  return getCachedArticleValue(article, `identityGoogleNewsPenalty:${profileId}`, () => {
    if (!isGoogleNewsArticle(article)) {
      return {
        penalty: 0,
        hasStrongContext: false,
        weakContext: false,
      };
    }

    const recency = getIdentityRecencyAdjustment(article);
    const visualQualityScore = getArticleVisualQualityScore(article);
    const strongContextTerms = profileId && Array.isArray(IDENTITY_PROFILE_STRONG_CONTEXT_TERMS[profileId])
      ? IDENTITY_PROFILE_STRONG_CONTEXT_TERMS[profileId]
      : Array.from(
        new Set(Object.values(IDENTITY_PROFILE_STRONG_CONTEXT_TERMS).flatMap((terms) => terms))
      );
    const context = getPersonalBoostContext(article);
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
    const matchedStrongContext = strongContextTerms.filter((term) => textMatchesKeyword(haystack, term));
    const hasStrongContext = matchedStrongContext.length > 0;
    const softNoise = getIdentityProfileSoftNoiseAssessment(article, profileId);

    let penalty = 35;
    if (recency.ageDays > 365) {
      penalty += 90;
    }
    if (recency.ageDays > 365 * 3) {
      penalty += 90;
    }
    if (visualQualityScore <= 2) {
      penalty += 35;
    }
    if (!hasStrongContext) {
      penalty += 55;
    }
    if (softNoise.hasNoise && !softNoise.hasStrongContext) {
      penalty += 60;
    }
    if (hasStrongContext) {
      penalty -= 45;
    }

    return {
      penalty: Math.max(0, penalty),
      hasStrongContext,
      weakContext: !hasStrongContext,
    };
  });
}

function getIdentityDocumentIntentBreakdown(article) {
  return getCachedArticleValue(article, "identityDocumentIntentBreakdown", () => {
    const intentText = getIdentityDocumentIntentText(article);
    return {
      passports: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.passports),
      visas: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.visas),
      residence_permits: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.residence_permits),
      icao: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.icao),
      border_control: calculateIntentScore(intentText, IDENTITY_SUBINTEREST_INTENTS.border_control),
    };
  });
}

function evaluateIdentityDocumentHardContext(article, profileId) {
  return getCachedArticleValue(article, `identityHardContext:${profileId}`, () => {
    const gate = IDENTITY_DOCUMENT_HARD_CONTEXT_GATES[profileId];
    if (!gate) {
      return {
        matched: true,
        severePenalty: 0,
        requiredHits: 0,
        contextHits: 0,
        securityHits: 0,
        negativeSourceHits: 0,
        matchedRequiredTerms: [],
        matchedContextTerms: [],
      };
    }

    const context = getPersonalBoostContext(article);
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

    const getMatchedTerms = (terms = []) =>
      normalizeKeywordList(terms).filter((term) => textMatchesKeyword(haystack, term));
    const countHits = (terms = []) => getMatchedTerms(terms).length;

    const negativeSourceHits = countHits(IDENTITY_DOCUMENT_NEGATIVE_SOURCE_TERMS);

    if (profileId === "passports") {
      const matchedRequiredTerms = getMatchedTerms(gate.requiredTerms);
      const matchedContextTerms = getMatchedTerms(gate.documentSecurityTerms);
      const matchedSecurityTerms = getMatchedTerms(gate.securityProductionTerms);
      const requiredHits = matchedRequiredTerms.length;
      const contextHits = matchedContextTerms.length;
      const securityHits = matchedSecurityTerms.length;
      return {
        matched: requiredHits > 0 && (contextHits > 0 || securityHits > 0),
        severePenalty: gate.severePenalty,
        requiredHits,
        contextHits,
        securityHits,
        negativeSourceHits,
        matchedRequiredTerms,
        matchedContextTerms: matchedContextTerms.concat(matchedSecurityTerms),
      };
    }

    if (profileId === "residence_permits") {
      const matchedPermitTerms = getMatchedTerms(gate.permitTerms);
      const matchedIssuanceTerms = getMatchedTerms(gate.issuanceTerms);
      const matchedSecurityTerms = getMatchedTerms(gate.securityTerms);
      const permitHits = matchedPermitTerms.length;
      const contextHits = matchedIssuanceTerms.length;
      const securityHits = matchedSecurityTerms.length;
      return {
        matched: permitHits > 0 || contextHits > 0 || securityHits > 0,
        severePenalty: gate.severePenalty,
        requiredHits: permitHits,
        contextHits,
        securityHits,
        negativeSourceHits,
        matchedRequiredTerms: matchedPermitTerms,
        matchedContextTerms: matchedIssuanceTerms.concat(matchedSecurityTerms),
      };
    }

    if (profileId === "icao" || profileId === "border_control") {
      const matchedRequiredTerms = getMatchedTerms(gate.requiredTerms);
      return {
        matched: matchedRequiredTerms.length > 0,
        severePenalty: gate.severePenalty,
        requiredHits: matchedRequiredTerms.length,
        contextHits: 0,
        securityHits: 0,
        negativeSourceHits,
        matchedRequiredTerms,
        matchedContextTerms: [],
      };
    }

    return {
      matched: true,
      severePenalty: 0,
      requiredHits: 0,
      contextHits: 0,
      securityHits: 0,
      negativeSourceHits,
      matchedRequiredTerms: [],
      matchedContextTerms: [],
    };
  });
}

function calculateIdentityProfileScore(article, profileId) {
  return getCachedArticleValue(article, `identityProfileScore:${profileId}`, () => {
    const profile = IDENTITY_INTELLIGENCE_PROFILES[profileId];
    if (!profile) {
      return {
        score: 0,
        authorityBoost: 0,
        matchedRequiredGroups: 0,
        matchedStrong: [],
        matchedMedium: [],
        matchedWeak: [],
        matchedNegative: [],
        rejectionReasons: [],
      };
    }

    const context = getPersonalBoostContext(article);
    const sourceFingerprint = `${context.sourceText} ${context.domainText} ${context.metadataText}`;
    const hardContext = evaluateIdentityDocumentHardContext(article, profileId);
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

    const matchedRequiredGroups = (Array.isArray(profile.requiredContextGroups) ? profile.requiredContextGroups : []).reduce(
      (count, group) => {
        const hasGroupMatch = Array.isArray(group) && group.some((term) =>
          textMatchesKeyword(context.titleText, term) ||
          textMatchesKeyword(context.tagText, term) ||
          textMatchesKeyword(context.metadataText, term) ||
          textMatchesKeyword(context.bodyText, term)
        );
        return hasGroupMatch ? count + 1 : count;
      },
      0
    );

    let score = strong.score + medium.score + weak.score - negative.score;
    const rejectionReasons = [];

    if (matchedRequiredGroups >= 2) {
      score += 28;
    } else if (matchedRequiredGroups === 1) {
      score += 8;
    } else if (strong.matched.length || medium.matched.length) {
      score -= 90;
      rejectionReasons.push("missing_required_context");
    }

    const authorityBoost = Array.isArray(profile.authorityBoostSources) &&
      profile.authorityBoostSources.some((value) => textMatchesKeyword(sourceFingerprint, value))
      ? 30
      : 0;
    if (score > 10) {
      score += authorityBoost;
    }

    if (negative.matched.length >= 2) {
      score -= 220;
      rejectionReasons.push("stacked_negative_context");
    }

    if (["passports", "residence_permits", "icao", "border_control"].includes(profileId)) {
      if (!hardContext.matched) {
        score -= hardContext.severePenalty;
        rejectionReasons.push("failed_document_context_gate");
      } else if (["passports", "residence_permits"].includes(profileId)) {
        score += Math.min(110, (hardContext.contextHits * 10) + (hardContext.securityHits * 12));
      }

      if (hardContext.negativeSourceHits > 0 && !hardContext.matched) {
        score -= 180;
        rejectionReasons.push("negative_travel_source");
      }

      if (
        hardContext.matched
        && IDENTITY_DOCUMENT_SECURITY_INDUSTRY_SOURCES.some((value) => textMatchesKeyword(sourceFingerprint, value))
      ) {
        score += 24;
      }
    }

    debugPersonalDashboardLog("[identity-profile-gate]", {
      profileId,
      title: article?.title || "Untitled article",
      source: article?.source || article?.feedTitle || "",
      matchedRequiredTerms: hardContext.matchedRequiredTerms || [],
      matchedContextTerms: hardContext.matchedContextTerms || [],
      gatePassed: hardContext.matched,
      penaltyApplied: !hardContext.matched ? hardContext.severePenalty : 0,
      finalScore: Math.round(score),
    });

    debugPersonalDashboardLog("[identity-semantic-profile]", {
      profileId,
      title: article?.title || "Untitled article",
      matchedStrong: strong.matched,
      matchedMedium: medium.matched,
      matchedWeak: weak.matched,
      matchedNegative: negative.matched,
      matchedRequiredGroups,
      hardContextMatched: hardContext.matched,
      hardContextRequiredHits: hardContext.requiredHits,
      hardContextContextHits: hardContext.contextHits,
      hardContextSecurityHits: hardContext.securityHits,
      hardContextNegativeSourceHits: hardContext.negativeSourceHits,
      authorityBoost,
      rejectionReasons,
      profileScore: Math.round(score),
    });

    return {
      score: Math.round(score),
      authorityBoost,
      matchedRequiredGroups,
      matchedStrong: strong.matched,
      matchedMedium: medium.matched,
      matchedWeak: weak.matched,
      matchedNegative: negative.matched,
      rejectionReasons,
      hardContextMatched: hardContext.matched,
    };
  });
}

function hasRequiredContextCombo(article, profileId) {
  return getCachedArticleValue(article, `identityRequiredContext:${profileId}`, () => {
    const combos = Array.isArray(IDENTITY_REQUIRED_CONTEXT_COMBOS[profileId])
      ? IDENTITY_REQUIRED_CONTEXT_COMBOS[profileId]
      : [];
    const context = getPersonalBoostContext(article);
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

    const matchedCombos = combos
      .filter((combo) => Array.isArray(combo) && combo.every((term) => textMatchesKeyword(haystack, term)))
      .map((combo) => combo.join(" + "));

    return {
      matched: matchedCombos.length > 0,
      matchedCombos,
    };
  });
}

function hasIdentityTravelNoise(article, terms = []) {
  const context = getPersonalBoostContext(article);
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
  return normalizeKeywordList(terms).some((term) => textMatchesKeyword(haystack, term));
}

function getIdentityDocumentSubinterestScore(article, selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests(selectedInterests);
  const signature = selectedIdentityInterests.slice().sort().join("|");
  const cacheKey = `identityDocumentSubinterestScore:${signature}`;

  return getCachedArticleValue(article, cacheKey, () => {
    if (!selectedIdentityInterests.length) {
      return {
        score: 0,
        mismatchPenalty: 0,
        selectedSubinterest: "",
        matchedSubinterest: "",
      };
    }

    const signals = getIdentityDocumentInterestSignals(article);
    const intentByInterest = getIdentityDocumentIntentBreakdown(article);
    const profileByInterest = {
      id_cards: calculateIdentityProfileScore(article, "id_cards"),
      passports: calculateIdentityProfileScore(article, "passports"),
      visas: calculateIdentityProfileScore(article, "visas"),
      residence_permits: calculateIdentityProfileScore(article, "residence_permits"),
      border_control: calculateIdentityProfileScore(article, "border_control"),
      icao: calculateIdentityProfileScore(article, "icao"),
      issuance: calculateIdentityProfileScore(article, "issuance"),
      fraud: calculateIdentityProfileScore(article, "fraud"),
    };
    const travelNoiseArticle = isIdentityTravelNoiseArticle(article);
    const scoreByInterest = {
      passports:
        (signals.passportHits * 0.7) +
        (signals.icaoHits * 0.45) +
        (signals.issuanceHits * 0.45) +
        (signals.personalizationHits * 0.45) -
        (signals.driverLicenseHits * 1.05) -
        (signals.noisyHits * 0.9) -
        (signals.visaHits * 0.2) +
        (profileByInterest.passports.score * 1.1),
      id_cards:
        (signals.idCardHits * 1.55) +
        (signals.polycarbonateHits * 0.5) +
        (signals.issuanceHits * 0.4) -
        (signals.driverLicenseHits * 0.75) -
        (signals.passportHits * 0.45) -
        (signals.noisyHits * 0.4) +
        (profileByInterest.id_cards.score * 1.05),
      residence_permits:
        (signals.residencePermitHits * 1.95) +
        (signals.issuanceHits * 0.45) +
        (signals.personalizationHits * 0.2) +
        (signals.borderHits * 0.15) -
        (signals.driverLicenseHits * 1.0) -
        (signals.passportHits * 0.45) -
        (signals.visaHits * 0.25) -
        (signals.noisyHits * 0.55) +
        (profileByInterest.residence_permits.score * 1.15),
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
        (profileByInterest.visas.score * 0.9),
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
        (profileByInterest.fraud.score * 1.0),
      icao:
        (signals.icaoHits * 2.0) +
        (signals.passportHits * 0.2) +
        (signals.borderHits * 0.5) -
        (signals.driverLicenseHits * 1.05) -
        (signals.noisyHits * 0.85) +
        (profileByInterest.icao.score * 1.05),
      border_control:
        (signals.borderHits * 1.85) +
        (signals.icaoHits * 0.35) +
        (signals.passportHits * 0.2) -
        (signals.noisyHits * 0.6) +
        (profileByInterest.border_control.score * 1.2),
      issuance:
        (signals.issuanceHits * 1.75) +
        (signals.passportHits * 0.2) +
        (signals.idCardHits * 0.2) +
        (signals.visaHits * 0.2) -
        (signals.driverLicenseHits * 0.8) -
        (signals.noisyHits * 0.35) +
        (profileByInterest.issuance.score * 1.0),
      laminate:
        (signals.laminateHits * 1.8) +
        (signals.polycarbonateHits * 0.35) +
        (signals.passportHits * 0.2) +
        (signals.idCardHits * 0.2) -
        (signals.driverLicenseHits * 0.8) -
        (signals.noisyHits * 0.35),
    };
    const selectedInterestSet = new Set(selectedIdentityInterests);

    const selectedScores = selectedIdentityInterests.map((interestId) => {
      const intent = intentByInterest[interestId] || {
        score: 0,
        matchedStrong: [],
        matchedWeak: [],
        matchedNegative: [],
      };
      let score = Number(scoreByInterest[interestId] || 0) + Number(intent.score || 0);
      score += getIdentityIntentAuthorityBoost(article, intent.score);
      if (travelNoiseArticle && ["passports", "residence_permits", "icao"].includes(interestId)) {
        score -= 300;
      }
      return {
        interestId,
        score,
      };
    });
    selectedScores.sort((left, right) => right.score - left.score);

    const bestSelected = selectedScores[0] || { interestId: "", score: 0 };
    const nonSelectedScores = Object.entries(scoreByInterest)
      .filter(([interestId]) => !selectedInterestSet.has(interestId))
      .map(([interestId, score]) => {
        const intent = intentByInterest[interestId] || {
          score: 0,
          matchedStrong: [],
          matchedWeak: [],
          matchedNegative: [],
        };
        let nonSelectedScore = Number(score || 0) + Number(intent.score || 0);
        nonSelectedScore += getIdentityIntentAuthorityBoost(article, intent.score);
        if (travelNoiseArticle && ["passports", "residence_permits", "icao"].includes(interestId)) {
          nonSelectedScore -= 300;
        }
        return { interestId, score: nonSelectedScore };
      })
      .sort((left, right) => right.score - left.score);
    const strongestMismatch = nonSelectedScores[0] || { interestId: "", score: 0 };
    const mismatchPenalty = Math.max(0, strongestMismatch.score - bestSelected.score);

      return {
        score: Math.round(bestSelected.score - (mismatchPenalty * 0.9)),
        bestSelectedScore: Math.round(bestSelected.score),
        mismatchPenalty: Math.round(mismatchPenalty),
        selectedSubinterest: selectedIdentityInterests.length === 1 ? selectedIdentityInterests[0] : selectedIdentityInterests.join(","),
        matchedSubinterest: bestSelected.interestId,
        intentByInterest,
        profileByInterest,
        travelNoiseArticle,
      };
  });
}

const PERSONAL_DASHBOARD_BANKNOTE_DEBUG_SOURCES = [
  "banknotenews",
  "notafilia",
  "mriguide",
];

function getPersonalDashboardBanknoteSourceCounts(articles = []) {
  const counts = {
    total: Array.isArray(articles) ? articles.length : 0,
    banknotenews: 0,
    notafilia: 0,
    mriguide: 0,
  };

  if (!Array.isArray(articles) || !articles.length) {
    return counts;
  }

  articles.forEach((article) => {
    const context = getPersonalBoostContext(article);
    const fingerprint = `${context.sourceText} ${context.domainText}`;
    PERSONAL_DASHBOARD_BANKNOTE_DEBUG_SOURCES.forEach((sourceKey) => {
      if (textMatchesKeyword(fingerprint, sourceKey)) {
        counts[sourceKey] += 1;
      }
    });
  });

  return counts;
}

function logPersonalDashboardSourceStage(stage, articles, extra = {}) {
  debugPersonalDashboardLog(stage, {
    sourceCounts: getPersonalDashboardBanknoteSourceCounts(articles),
    ...extra,
  });
}

function getPersonalBucketOrder(bucket) {
  if (bucket === "primary") {
    return 0;
  }
  if (bucket === "adjacent") {
    return 1;
  }
  return 2;
}

function getBanknoteInterestSignals(article) {
  return getCachedArticleValue(article, "banknoteInterestSignals", () => {
    const context = getPersonalBoostContext(article);
    const weightedHits = (terms = []) =>
      (countBoostKeywordMatches(context.titleText, terms) * 5) +
      (countBoostKeywordMatches(context.tagText, terms) * 2) +
      (countBoostKeywordMatches(context.metadataText, terms) * 2) +
      countBoostKeywordMatches(context.bodyText, terms);

    const banknoteCoreTerms = [
      "banknote",
      "banknotes",
      "currency note",
      "paper money",
      "polymer note",
      "polymer banknote",
      "denomination",
      "legal tender",
      "banknote redesign",
      "banknote release",
      "banknote withdrawal",
      "commemorative banknote",
      "counterfeit money",
      "counterfeit currency",
      "cash circulation",
      "currency issuance",
      "note issuance",
      "note withdrawal",
      "central bank currency",
      "central bank note",
    ];
    const banknoteContextTerms = [
      "banknote",
      "banknotes",
      "currency",
      "cash",
      "note",
      "paper money",
      "central bank",
      "denomination",
      "legal tender",
      "circulation",
      "counterfeit money",
      "counterfeit currency",
      "security printing",
      "note issuance",
      "banknote issuance",
      "watermark",
      "holography",
      "ovd",
      "intaglio",
      "polymer",
      "substrate",
      "mint",
      "issuing authority",
    ];
    const securityFeatureTerms = [
      "security feature",
      "security features",
      "security thread",
      "watermark",
      "hologram",
      "ovd",
      "optically variable device",
      "intaglio",
      "anti-counterfeit currency",
      "counterfeit prevention",
      "polymer substrate",
      "windowed thread",
    ];
    const securityPrintingTerms = [
      "security printing",
      "security printer",
      "banknote printing",
      "currency printing",
      "print works",
      "secure print",
      "security inks",
      "holography",
      "ovd",
      "intaglio",
      "micro optics",
      "micro-optics",
    ];
    const polymerTerms = [
      "polymer note",
      "polymer banknote",
      "polymer substrate",
      "polymer currency",
      "guardian substrate",
      "ccl substrate",
      "hybrid substrate",
      "plastic banknote",
    ];
    const substrateTerms = [
      "substrate",
      "polymer substrate",
      "paper substrate",
      "guardian substrate",
      "ccl substrate",
      "hybrid substrate",
      "substrate migration",
    ];
    const releaseTerms = [
      "issued",
      "issue",
      "issuance",
      "release",
      "released",
      "unveiled",
      "new note rollout",
      "banknote rollout",
      "circulation rollout",
      "new series launch",
      "new banknote launch",
    ];
    const redesignTerms = [
      "redesign",
      "new design",
      "new family",
      "new portrait",
      "new artwork",
      "currency redesign",
      "banknote redesign",
    ];
    const withdrawalTerms = [
      "withdrawn from circulation",
      "withdrawal",
      "demonetisation",
      "demonetization",
      "legal tender deadline",
      "exchange deadline",
      "phase-out",
      "phase out",
      "note retirement",
      "old series withdrawal",
    ];
    const counterfeitTerms = [
      "counterfeit money",
      "counterfeit currency",
      "counterfeit banknote",
      "counterfeit banknotes",
      "counterfeit notes",
      "fake note",
      "fake currency",
      "forged notes",
      "cash fraud",
    ];
    const centralBankTerms = [
      "central bank",
      "national bank",
      "reserve bank",
      "monetary authority",
      "issuer bank",
      "issuing authority",
      "bank of england",
      "ecb",
      "rbi",
    ];

    return {
      isAuthoritySource: isBanknoteAuthoritySource(article),
      hasBanknoteTopic:
        context.topic === "banknotes" || context.topicType === "banknote" || context.domain === "banknote",
      coreHits: weightedHits(banknoteCoreTerms),
      contextHits: weightedHits(banknoteContextTerms),
      securityFeatureHits: weightedHits(securityFeatureTerms),
      securityPrintingHits: weightedHits(securityPrintingTerms),
      polymerHits: weightedHits(polymerTerms),
      substrateHits: weightedHits(substrateTerms),
      releaseHits: weightedHits(releaseTerms),
      redesignHits: weightedHits(redesignTerms),
      withdrawalHits: weightedHits(withdrawalTerms),
      counterfeitHits: weightedHits(counterfeitTerms),
      centralBankHits: weightedHits(centralBankTerms),
    };
  });
}

function getBanknoteNoiseAssessment(article) {
  return getCachedArticleValue(article, "banknoteNoiseAssessment", () => {
    const context = getPersonalBoostContext(article);
    const weightedHits = (terms = []) =>
      (countBoostKeywordMatches(context.titleText, terms) * 5) +
      (countBoostKeywordMatches(context.tagText, terms) * 2) +
      (countBoostKeywordMatches(context.metadataText, terms) * 2) +
      countBoostKeywordMatches(context.bodyText, terms);

    const strongPositiveTerms = [
      "banknotenews",
      "central bank",
      "reserve bank",
      "national bank",
      "monetary authority",
      "ecb",
      "bceao",
      "imf",
      "keesing",
      "new note",
      "new banknote",
      "banknote issuance",
      "note issuance",
      "banknote rollout",
      "polymer banknote",
      "substrate",
      "commemorative note",
      "security thread",
      "watermark",
      "anti-counterfeit",
      "counterfeit banknote",
      "withdrawal",
      "redesign",
      "denomination",
      "currency issue",
      "currency issuance",
      "banknote printer",
      "de la rue",
      "g+d",
      "giesecke+devrient",
      "crane currency",
      "orell fussli",
      "oberthur",
      "sicpa",
      "louisenthal",
      "security printing",
    ];
    const socialMarketplaceNoiseTerms = [
      "marketplace",
      "for sale",
      "discount code",
      "collectible promotion",
      "tiktok",
      "instagram",
      "reddit",
      "facebook",
      "old banknotes for sale",
      "album of old banknotes",
      "ebay",
      "etsy",
      "facebook marketplace",
    ];
    const marketFinanceNoiseTerms = [
      "lottery",
      "gambling",
      "casino",
      "betting",
      "money laundering",
      "stocks",
      "bonds",
      "forex",
      "exchange rate",
      "market tensions",
      "financial market",
      "stock market",
      "currency markets",
      "foreign exchange",
      "inflation report",
      "investors on edge",
      "bond market",
      "economy",
      "gdp",
      "unemployment",
      "banking sector",
      "fintech funding",
      "political debate",
      "political row",
      "political clash",
      "coin values",
      "value your coins",
      "coin valuation",
    ];
    const stockPhotoNoiseTerms = [
      "stock photography",
      "hi-res stock",
      "stock photo",
      "alamy",
      "freepik",
      "shutterstock",
      "getty images",
    ];
    const weakTrumpBillTerms = [
      "trump 250 bill",
      "$250 bill",
      "250 dollar bill",
      "trump banknote",
      "trump bill",
    ];
    const officialProposalTerms = [
      "treasury",
      "legislative proposal",
      "bill introduced",
      "house bill",
      "senate bill",
      "official design proposal",
      "currency issuance",
      "official proposal",
    ];

    const positiveHits = weightedHits(strongPositiveTerms);
    const socialMarketplaceNoiseHits = weightedHits(socialMarketplaceNoiseTerms);
    const marketFinanceNoiseHits = weightedHits(marketFinanceNoiseTerms);
    const stockPhotoNoiseHits = weightedHits(stockPhotoNoiseTerms);
    const totalNoiseHits = socialMarketplaceNoiseHits + marketFinanceNoiseHits + stockPhotoNoiseHits;
    const isAuthoritySource = isBanknoteAuthoritySource(article);
    const weakTrumpBillHits = weightedHits(weakTrumpBillTerms);
    const officialProposalHits = weightedHits(officialProposalTerms);
    const weakTrumpDebate = weakTrumpBillHits >= 5 && officialProposalHits < 5;

    const contaminated =
      !isAuthoritySource
      && (
        (socialMarketplaceNoiseHits >= 5 && positiveHits < 10)
        || (stockPhotoNoiseHits >= 5 && positiveHits < 10)
        || (marketFinanceNoiseHits >= 8 && positiveHits < 12)
        || (totalNoiseHits >= 10 && positiveHits < 12)
        || weakTrumpDebate
      );

    return {
      positiveHits,
      totalNoiseHits,
      socialMarketplaceNoiseHits,
      marketFinanceNoiseHits,
      stockPhotoNoiseHits,
      weakTrumpDebate,
      contaminated,
    };
  });
}

function getArticleDominantDomain(article) {
  return getCachedArticleValue(article, "personalDominantDomain", () => {
    const context = getPersonalBoostContext(article);
    const banknoteSignals = getPersonalDomainContextProfile(context, "banknote_intelligence");
    const identitySignals = getPersonalDomainContextProfile(context, "identity_documents");
    const digitalSignals = getPersonalDomainContextProfile(context, "digital_identity_biometrics");
    const banknoteInterestSignals = getBanknoteInterestSignals(article);
    const strongBanknoteSignals = getStrongBanknoteDomainSignalAssessment(article);

    const banknoteScore =
      banknoteSignals.score
      + (banknoteInterestSignals.hasBanknoteTopic ? 18 : 0)
      + (banknoteInterestSignals.isAuthoritySource ? 28 : 0)
      + Math.min(18, Math.round(banknoteInterestSignals.contextHits / 2))
      + strongBanknoteSignals.boost;
    const identityScore =
      identitySignals.score
      + (["travel_passport", "identity_document", "dmv_driver_license"].includes(context.topicType) ? 18 : 0)
      + (contextMatchesSpecialistSource(context, "identity_documents") ? 14 : 0)
      - strongBanknoteSignals.identityPenalty;
    const digitalScore =
      digitalSignals.score
      + (context.topicType === "digital_identity" || context.domain === "digital_identity" ? 20 : 0)
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
  });
}

function hasSelectedDomainContext(article, selectedMainDomain) {
  const context = getPersonalBoostContext(article);
  if (selectedMainDomain === "banknotes") {
    return getPersonalDomainContextProfile(context, "banknote_intelligence").score >= 8;
  }
  if (selectedMainDomain === "identity_documents") {
    return getPersonalDomainContextProfile(context, "identity_documents").score >= 7;
  }
  if (selectedMainDomain === "digital_identity_biometrics") {
    return getPersonalDomainContextProfile(context, "digital_identity_biometrics").score >= 7;
  }
  return false;
}

function isBanknotePrimary(article) {
  return getCachedArticleValue(article, "isBanknotePrimary", () => {
    const signals = getBanknoteInterestSignals(article);
    return signals.isAuthoritySource || signals.hasBanknoteTopic || signals.coreHits >= 4;
  });
}

function isBanknoteAdjacent(article) {
  return getCachedArticleValue(article, "isBanknoteAdjacent", () => {
    const signals = getBanknoteInterestSignals(article);
    return !signals.isAuthoritySource
      && signals.contextHits >= 3
      && (signals.securityFeatureHits >= 3 || signals.securityPrintingHits >= 3);
  });
}

function isBanknoteContaminated(article) {
  return getCachedArticleValue(article, "isBanknoteContaminated", () => {
    if (isBanknotePrimary(article) || isBanknoteAdjacent(article)) {
      return false;
    }

    const noiseAssessment = getBanknoteNoiseAssessment(article);
    if (noiseAssessment.contaminated) {
      return true;
    }

    const context = getPersonalBoostContext(article);
    const contaminationConcepts = [
      "digital identity",
      "digital wallet",
      "eid wallet",
      "identity verification",
      "identity proofing",
      "kyc",
      "onboarding",
      "liveness",
      "biometric",
      "biometrics",
      "biometric infrastructure",
      "mosip",
      "ees",
      "passport child support",
      "passport revocation",
      "passport legal debt",
      "passport legal-debt",
      "antivirus",
      "iphone security",
      "cybersecurity",
    ];
    const contaminationHits =
      countBoostKeywordMatches(context.titleText, contaminationConcepts) * 2 +
      countBoostKeywordMatches(context.tagText, contaminationConcepts) * 2 +
      countBoostKeywordMatches(context.metadataText, contaminationConcepts) +
      countBoostKeywordMatches(context.bodyText, contaminationConcepts);

    return contaminationHits > 0;
  });
}

function matchesBanknoteInterest(article, interestId) {
  return getCachedArticleValue(article, `matchesBanknoteInterest:${interestId}`, () => {
    if (getArticleDominantDomain(article) !== "banknotes") {
      return false;
    }

    const signals = getBanknoteInterestSignals(article);

    if (interestId === "banknotes") {
      return signals.isAuthoritySource || isBanknotePrimary(article) || signals.contextHits >= 3;
    }
    if (interestId === "polymer") {
      return signals.polymerHits >= 3 || signals.substrateHits >= 4;
    }
    if (interestId === "substrate") {
      return signals.substrateHits >= 4;
    }
    if (interestId === "security_features") {
      return signals.contextHits >= 3 && signals.securityFeatureHits >= 3;
    }
    if (interestId === "security_printing") {
      return signals.contextHits >= 3 && signals.securityPrintingHits >= 3;
    }
    if (interestId === "redesign") {
      return signals.contextHits >= 3 && signals.redesignHits >= 3;
    }
    if (interestId === "rollout") {
      return signals.contextHits >= 3 && signals.releaseHits >= 3;
    }
    if (interestId === "release") {
      return signals.contextHits >= 3 && signals.releaseHits >= 3;
    }
    if (interestId === "withdrawal") {
      return signals.contextHits >= 3 && signals.withdrawalHits >= 3;
    }
    if (interestId === "counterfeit") {
      return signals.counterfeitHits >= 3;
    }
    if (interestId === "central_bank") {
      return signals.contextHits >= 3 && signals.centralBankHits >= 3;
    }

    return false;
  });
}

function getPersonalDomainBucket(article, selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  const normalizedInterests = normalizePersonalDashboardInterests(selectedInterests);
  const signature = `${normalizePersonalDashboardMode(state.personalDashboard.mode)}:${normalizedInterests.join("|")}`;
  const cacheKey = `personalDomainBucket:${signature}`;

  return getCachedArticleValue(article, cacheKey, () => {
    const selectedMainDomains = getSelectedMainDomains(normalizedInterests);
    if (!selectedMainDomains.length) {
      return "other";
    }

    if (isBanknotesOnlyPersonalSelection(normalizedInterests)) {
      if (isBanknotePrimary(article)) {
        return "primary";
      }
      if (isBanknoteAdjacent(article)) {
        return "adjacent";
      }
      return "other";
    }

    const dominantDomain = getArticleDominantDomain(article);
    const hasAnySelectedDomainContext = selectedMainDomains.some((selectedDomain) =>
      hasSelectedDomainContext(article, selectedDomain)
    );

    if (selectedMainDomains.includes(dominantDomain)) {
      return "primary";
    }

    if (dominantDomain === "shared_security") {
      if (selectedMainDomains.length === 1 && selectedMainDomains[0] === "banknotes") {
        return isBanknoteAdjacent(article) ? "adjacent" : "other";
      }
      return hasAnySelectedDomainContext ? "adjacent" : "other";
    }

    if (selectedMainDomains.length === 1) {
      const selectedDomain = selectedMainDomains[0];
      if (selectedDomain === "banknotes") {
        return "other";
      }
      if (selectedDomain === "identity_documents") {
        return dominantDomain === "digital_identity_biometrics" && hasSelectedDomainContext(article, "identity_documents")
          ? "adjacent"
          : "other";
      }
      if (selectedDomain === "digital_identity_biometrics") {
        return dominantDomain === "identity_documents" && hasSelectedDomainContext(article, "digital_identity_biometrics")
          ? "adjacent"
          : "other";
      }
    }

    return hasAnySelectedDomainContext ? "adjacent" : "other";
  });
}

function getDomainDecayMultiplier(article, selectedMainDomains) {
  if (!Array.isArray(selectedMainDomains) || !selectedMainDomains.length) {
    return 1;
  }

  const dominantDomain = getArticleDominantDomain(article);

  if (selectedMainDomains.length === 1) {
    const selected = selectedMainDomains[0];

    if (dominantDomain === selected) {
      return 1.0;
    }
    if (dominantDomain === "shared_security") {
      return hasSelectedDomainContext(article, selected) ? 0.85 : 0.45;
    }
    if (selected === "banknotes" && dominantDomain === "identity_documents") {
      return 0.35;
    }
    if (selected === "banknotes" && dominantDomain === "digital_identity_biometrics") {
      return 0.15;
    }
    if (selected === "identity_documents" && dominantDomain === "banknotes") {
      return 0.35;
    }
    if (selected === "identity_documents" && dominantDomain === "digital_identity_biometrics") {
      return 0.45;
    }
    if (selected === "digital_identity_biometrics" && dominantDomain === "banknotes") {
      return 0.15;
    }
    if (selected === "digital_identity_biometrics" && dominantDomain === "identity_documents") {
      return 0.45;
    }
    return 0.75;
  }

  if (selectedMainDomains.includes(dominantDomain)) {
    return 1.0;
  }
  if (dominantDomain === "shared_security") {
    return selectedMainDomains.some((selected) => hasSelectedDomainContext(article, selected)) ? 0.85 : 0.5;
  }
  return 0.45;
}

function calculatePersonalDomainScore(article, selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)) {
  const normalizedInterests = normalizePersonalDashboardInterests(selectedInterests);
  const mode = normalizePersonalDashboardMode(state.personalDashboard.mode);
  const cacheKey = `personalDomainScore:${mode}:${normalizedInterests.join("|")}`;

  return getCachedArticleValue(article, cacheKey, () => {
    if (!normalizedInterests.length) {
      return {
        domainScore: 0,
        domain: "",
        relevanceBand: "",
      };
    }

    const context = getPersonalBoostContext(article);
    const selectedMainDomains = getSelectedMainDomains(normalizedInterests);
    const effectiveDomains = getEffectivePersonalDashboardDomains();
    const { mainDomainSelections, sharedInterestSelections } = getPersonalDashboardSelectedDomainConfig();
    const strongBanknoteSignals = getStrongBanknoteDomainSignalAssessment(article);

    let bestDomain = "";
    let bestScore = -120;

    effectiveDomains.forEach((groupId) => {
      const domainContext = getPersonalDomainContextProfile(context, groupId);
      const selectedDomainInterests = mainDomainSelections.get(groupId) || [];
      const specialistSourceMatch = contextMatchesSpecialistSource(context, groupId);
      const selectedInterestBoost = selectedDomainInterests.reduce((maxScore, interestId) => {
        return Math.max(maxScore, computePersonalInterestBoost(article, interestId).score);
      }, 0);
      const sharedInterestBoost = sharedInterestSelections.reduce((maxScore, interestId) => {
        return Math.max(maxScore, computePersonalInterestBoost(article, interestId).score);
      }, 0);

      let score = 0;

      if (groupId === "banknote_intelligence") {
        const banknoteAuthority = getBanknoteSourceAuthority(article);
        const banknoteNoise = getBanknoteNoiseAssessment(article);
        if (specialistSourceMatch) {
          score += 300;
        }
        if (isBanknoteAuthoritySource(article)) {
          score += 220;
        }
        if (context.topicType === "banknote" || context.domain === "banknote" || context.topic === "banknotes") {
          score += 170;
        }
        if (domainContext.score >= 10) {
          score += 130;
        } else if (domainContext.score >= 6) {
          score += 70;
        }
        if (selectedInterestBoost) {
          score += Math.min(250, selectedInterestBoost * 5);
        }
        if (sharedInterestBoost && domainContext.score >= 7) {
          score += Math.min(120, sharedInterestBoost * 3);
        }
        if (countBoostKeywordMatches(`${context.titleText} ${context.tagText} ${context.metadataText}`, ["banknote", "banknotes", "currency", "cash", "note", "central bank", "circulation", "mint"]) >= 2) {
          score += 55;
        }
        score += strongBanknoteSignals.boost * 4;
        score += Math.min(120, Math.round(banknoteNoise.positiveHits * 0.9));
        score -= Math.min(320, Math.round(banknoteNoise.totalNoiseHits * 3.2));
        if (banknoteNoise.weakTrumpDebate) {
          score -= 240;
        }
        if (isBanknoteSocialSource(article)) {
          score = Math.min(score, 60);
        }
        if (banknoteNoise.contaminated) {
          score -= 520;
        }
        score -= countBoostKeywordMatches(
          `${context.titleText} ${context.tagText} ${context.metadataText}`,
          ["kyc", "onboarding", "wallet", "eid", "digital identity", "authentication", "liveness", "biometric", "biometrics"]
        ) * 35;
        score = Math.round(score * banknoteAuthority.multiplier);
      } else if (groupId === "identity_documents") {
        const identityAuthority = getIdentityDocumentSourceAuthority(article);
        const identitySignals = getIdentityDocumentInterestSignals(article);
        const identitySubinterest = getIdentityDocumentSubinterestScore(article, normalizedInterests);
        const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests(normalizedInterests);
        const selectedSubinterest = selectedIdentityInterests.length === 1 ? selectedIdentityInterests[0] : "";
        const borderAuthorityAdjustment = selectedSubinterest === "border_control"
          ? getBorderControlAuthorityAdjustment(article, identityAuthority)
          : { multiplier: identityAuthority.multiplier, sourceBoostScale: 1 };
        const genericDmvNoise = isGenericDmvNoise(article);
        const requiredContext = selectedSubinterest ? hasRequiredContextCombo(article, selectedSubinterest) : { matched: false, matchedCombos: [] };
        const hardPenaltyBase = selectedSubinterest ? Number(IDENTITY_REQUIRED_CONTEXT_STRICT_PENALTIES[selectedSubinterest] || 0) : 0;
        const borderTravelNoise = hasIdentityTravelNoise(article, IDENTITY_BORDER_CONTROL_TRAVEL_NOISE_TERMS);
        const borderTechContext = hasIdentityTravelNoise(article, IDENTITY_BORDER_CONTROL_TECH_TERMS);
        const passportLifestyleNoise = hasIdentityTravelNoise(article, IDENTITY_PASSPORT_LIGHT_NOISE_TERMS);
        const passportAnchorContext = hasIdentityTravelNoise(article, IDENTITY_PASSPORT_ANCHOR_TERMS);
        const visaSpamNoise = hasIdentityTravelNoise(article, IDENTITY_VISA_SPAM_TERMS);
        const selectedIntent = selectedSubinterest
          ? (identitySubinterest.intentByInterest?.[selectedSubinterest] || {
            score: 0,
            matchedStrong: [],
            matchedWeak: [],
            matchedNegative: [],
          })
          : { score: 0, matchedStrong: [], matchedWeak: [], matchedNegative: [] };
        const selectedProfileSourcePriority = selectedSubinterest
          ? getIdentityProfileSourcePriorityBoost(article, selectedSubinterest)
          : { level: "none", boost: 0 };
        const selectedSoftNoise = selectedSubinterest
          ? getIdentityProfileSoftNoiseAssessment(article, selectedSubinterest)
          : { penalty: 0, hasNoise: false, hasStrongContext: false, matchedNoise: [], matchedStrongContext: [] };
        const borderMarketingPenalty = selectedSubinterest === "border_control"
          ? getBorderControlMarketingPagePenalty(article)
          : { penalty: 0 };
        const borderNewsPriority = selectedSubinterest === "border_control"
          ? getBorderControlNewsPriority(article)
          : { boost: 0, penalty: 0 };
        const borderGuidancePenalty = selectedSubinterest === "border_control"
          ? getBorderControlGuidancePenalty(article)
          : { penalty: 0, hasOperationalContext: false };
        const borderRecencyAdjustment = selectedSubinterest === "border_control"
          ? getBorderControlRecencyAdjustment(article)
          : { boost: 0, ageDays: Number.POSITIVE_INFINITY };
        const residencePermitIntentAdjustment = selectedSubinterest === "residence_permits"
          ? getResidencePermitIntentAdjustment(article)
          : { hasCardIntent: false, cardBoost: 0, officialSourceBoost: 0, guidePenalty: 0 };
        const googleNewsArticle = isGoogleNewsArticle(article);
        const visualQualityScore = getArticleVisualQualityScore(article);
        const activeIdentityProfile = selectedSubinterest || "";
        const recencyAdjustment = getIdentityRecencyAdjustment(article);
        const googleNewsPenalty = getIdentityGoogleNewsPenalty(article, activeIdentityProfile);
        const selectedProfile = selectedSubinterest
          ? (identitySubinterest.profileByInterest?.[selectedSubinterest] || {
            score: 0,
            authorityBoost: 0,
            matchedRequiredGroups: 0,
            matchedNegative: [],
            rejectionReasons: [],
          })
          : null;
        if (["travel_passport", "identity_document", "dmv_driver_license"].includes(context.topicType)) {
          score += 170;
        }
        if (domainContext.score >= 10) {
          score += 125;
        } else if (domainContext.score >= 6) {
          score += 65;
        }
        if (selectedInterestBoost) {
          score += Math.min(240, selectedInterestBoost * 5);
        }
        if (sharedInterestBoost && domainContext.score >= 7) {
          score += Math.min(110, sharedInterestBoost * 3);
        }
        if (countBoostKeywordMatches(`${context.titleText} ${context.tagText} ${context.metadataText}`, ["passport", "visa", "residence permit", "identity card", "id card", "border control", "polycarbonate", "laminate"]) >= 2) {
          score += 50;
        }
        score += Math.min(140, Math.round(identitySignals.primaryContextHits * 0.9));
        score += Math.round(identityAuthority.boost * borderAuthorityAdjustment.sourceBoostScale);
        score += Math.round(selectedProfileSourcePriority.boost * borderAuthorityAdjustment.sourceBoostScale);
        score += recencyAdjustment.boost;
        score -= selectedSoftNoise.penalty;
        if (selectedSubinterest === "border_control") {
          score += borderNewsPriority.boost;
          score -= borderNewsPriority.penalty;
          score += borderRecencyAdjustment.boost;
          score -= borderGuidancePenalty.penalty;
        }
        score += Math.max(-140, identitySubinterest.score);
        score -= Math.min(150, Math.round(identitySignals.noisyHits * 0.95));
        score -= Math.min(130, identitySubinterest.mismatchPenalty);
        if (googleNewsArticle) {
          score -= googleNewsPenalty.penalty;
          if (selectedSubinterest === "border_control" && borderRecencyAdjustment.ageDays > 365) {
            score -= borderRecencyAdjustment.ageDays > 365 * 3 ? 90 : 55;
          }
          if (selectedSubinterest === "border_control" && borderGuidancePenalty.penalty && !borderGuidancePenalty.hasOperationalContext) {
            score -= 60;
          }
        }
        if (selectedSubinterest && identitySubinterest.bestSelectedScore < 8 && selectedSubinterest !== "drivers_licenses") {
          score -= 400;
        }
        if (identitySubinterest.mismatchPenalty > HARD_SUBINTEREST_MISMATCH_THRESHOLD) {
          score -= 500;
        }
        if (genericDmvNoise && selectedSubinterest && selectedSubinterest !== "drivers_licenses") {
          score -= 700;
        }
        if (selectedSubinterest && ["passports", "residence_permits", "icao"].includes(selectedSubinterest)) {
          score += Math.min(150, Math.round(selectedIntent.score * 1.35));
          score += getIdentityIntentAuthorityBoost(article, selectedIntent.score);
          if (identitySubinterest.travelNoiseArticle) {
            score -= 300;
          }
        }
        if (selectedProfile) {
          score += Math.min(190, Math.round(selectedProfile.score * 1.1));
          if (selectedProfile.matchedNegative.length >= 2) {
            score -= 200;
          }
          if (selectedProfile.rejectionReasons.includes("missing_required_context")) {
            score -= 160;
          }
        }
        if (hardPenaltyBase && !requiredContext.matched) {
          score -= hardPenaltyBase;
        }
        if (selectedSubinterest === "border_control" && borderTravelNoise && !borderTechContext) {
          score -= 900;
        }
        if (selectedSubinterest === "border_control" && borderMarketingPenalty.penalty) {
          score -= borderMarketingPenalty.penalty;
        }
        if (selectedSubinterest === "passports" && passportLifestyleNoise && !passportAnchorContext) {
          score -= 260;
        }
        if (selectedSubinterest === "visas" && visaSpamNoise) {
          score -= 260;
        }
        if (selectedSubinterest === "passports") {
          score += Math.min(135, Math.round((identitySignals.passportHits * 0.45) + (identitySignals.icaoHits * 0.45) + (selectedIntent.score * 1.1)));
          score -= Math.min(220, Math.round(identitySignals.driverLicenseHits * 1.05));
          score -= Math.min(95, Math.round(identitySignals.visaHits * 0.4));
        } else if (selectedSubinterest === "id_cards") {
          score += Math.min(145, Math.round((identitySignals.idCardHits * 1.0) + ((selectedProfile?.score || 0) * 1.05)));
          score += Math.min(55, Math.round(identitySignals.polycarbonateHits * 0.65));
          score -= Math.min(120, Math.round(identitySignals.passportHits * 0.45));
        } else if (selectedSubinterest === "visas") {
          score += Math.min(145, Math.round((identitySignals.visaHits * 0.95) + (selectedIntent.score * 1.15)));
          score -= Math.min(240, Math.round(identitySignals.driverLicenseHits * 1.2));
          score -= Math.min(110, Math.round(identitySignals.passportHits * 0.55));
        } else if (selectedSubinterest === "residence_permits") {
          score += Math.min(145, Math.round((identitySignals.residencePermitHits * 1.0) + (selectedIntent.score * 1.0)));
          score += residencePermitIntentAdjustment.cardBoost;
          score += residencePermitIntentAdjustment.officialSourceBoost;
          score -= residencePermitIntentAdjustment.guidePenalty;
          score -= Math.min(240, Math.round(identitySignals.driverLicenseHits * 1.2));
          score -= Math.min(95, Math.round(identitySignals.passportHits * 0.45));
        } else if (selectedSubinterest === "icao") {
          score += Math.min(155, Math.round((identitySignals.icaoHits * 1.0) + (selectedIntent.score * 1.0)));
          score -= Math.min(240, Math.round(identitySignals.driverLicenseHits * 1.25));
        } else if (selectedSubinterest === "fraud") {
          score += Math.min(150, Math.round((identitySignals.fraudHits * 1.0) + (selectedProfile?.score || 0)));
          score -= Math.min(220, Math.round(identitySignals.driverLicenseHits * 1.05));
        } else if (selectedSubinterest === "border_control") {
          score += Math.min(240, Math.round((identitySignals.borderHits * 0.7) + ((selectedProfile?.score || 0) * 1.25)));
          if (selectedProfile?.rejectionReasons?.length) {
            score -= 160;
          }
        } else if (selectedSubinterest === "polycarbonate") {
          score += Math.min(130, Math.round(identitySignals.polycarbonateHits * 0.9));
          score -= Math.min(180, Math.round(identitySignals.driverLicenseHits * 0.9));
        } else if (selectedSubinterest === "laminate") {
          score += Math.min(120, Math.round(identitySignals.laminateHits * 0.85));
          score -= Math.min(180, Math.round(identitySignals.driverLicenseHits * 0.9));
        } else if (selectedSubinterest === "issuance") {
          score += Math.min(150, Math.round((identitySignals.issuanceHits * 0.85) + (selectedProfile?.score || 0)));
          score -= Math.min(180, Math.round(identitySignals.driverLicenseHits * 0.8));
        }
        score -= countBoostKeywordMatches(
          `${context.titleText} ${context.tagText} ${context.metadataText}`,
          ["banknote", "banknotes", "central bank", "currency", "commemorative note", "cash circulation"]
        ) * 32;
        score -= strongBanknoteSignals.identityPenalty * 4;
        score = Math.round(score * borderAuthorityAdjustment.multiplier);
      } else if (groupId === "digital_identity_biometrics") {
        if (context.topicType === "digital_identity" || context.domain === "digital_identity") {
          score += 175;
        }
        if (domainContext.score >= 10) {
          score += 130;
        } else if (domainContext.score >= 6) {
          score += 70;
        }
        if (selectedInterestBoost) {
          score += Math.min(240, selectedInterestBoost * 5);
        }
        if (countBoostKeywordMatches(`${context.titleText} ${context.tagText} ${context.metadataText}`, ["digital identity", "biometric", "biometrics", "eid", "wallet", "kyc", "authentication", "liveness", "identity verification"]) >= 2) {
          score += 55;
        }
        score -= countBoostKeywordMatches(
          `${context.titleText} ${context.tagText} ${context.metadataText}`,
          ["banknote", "banknotes", "central bank", "currency", "cash", "commemorative note", "demonetisation"]
        ) * 35;
      }

      if (domainContext.excludedHits > 0 && !specialistSourceMatch) {
        score -= domainContext.excludedHits * 24;
      }

      if (domainContext.score < 4 && !specialistSourceMatch && selectedInterestBoost < 20) {
        score = Math.min(score, 28);
      }

      if (score > bestScore) {
        bestScore = score;
        bestDomain = groupId;
      }
    });

    const modeMultiplier = PERSONAL_DASHBOARD_MODES[mode] || 1;
    const decayMultiplier = getDomainDecayMultiplier(article, selectedMainDomains);
    const domainScore = Math.round(Math.max(-120, bestScore) * modeMultiplier * decayMultiplier);
    const relevanceBand = domainScore >= 320 ? "high" : domainScore >= 180 ? "relevant" : domainScore >= 80 ? "related" : "";

    return {
      domainScore,
      domain: bestDomain,
      relevanceBand,
    };
  });
}

function getPersonalDashboardDomainThreshold() {
  const mode = normalizePersonalDashboardMode(state.personalDashboard.mode);
  if (mode === "strict") {
    return 20;
  }
  if (mode === "broad") {
    return 8;
  }
  return 12;
}

function getPersonalDashboardDomainMatch(article) {
  const selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests);
  const signature = getPersonalInterestSignature();
  const cacheKey = `personalDomainMatch:${signature}`;

  return getCachedArticleValue(article, cacheKey, () => {
    if (!selectedInterests.length) {
      return {
        matched: true,
        matchedDomains: [],
        selectedDomains: [],
        domainScores: {},
      };
    }

    const { mainDomainSelections, sharedInterestSelections } = getPersonalDashboardSelectedDomainConfig();
    const context = getPersonalBoostContext(article);
    const selectedDomains = Array.from(mainDomainSelections.keys());
    const effectiveDomains = selectedDomains.length
      ? selectedDomains
      : sharedInterestSelections.length
        ? ["banknote_intelligence", "identity_documents"]
        : [];
    const domainScores = {};
    const strongBanknoteSignals = getStrongBanknoteDomainSignalAssessment(article);

    effectiveDomains.forEach((groupId) => {
      const domainContext = getPersonalDomainContextProfile(context, groupId);
      const specialistSourceScore = contextMatchesSpecialistSource(context, groupId)
        ? (groupId === "banknote_intelligence" ? 18 : 10)
        : 0;
      const selectedDomainInterests = mainDomainSelections.get(groupId) || [];
      const directInterestScore = selectedDomainInterests.reduce((maxScore, interestId) => {
        const interestScore = computePersonalInterestBoost(article, interestId).score;
        return Math.max(maxScore, interestScore);
      }, 0);
      const sharedInterestScore = sharedInterestSelections.reduce((maxScore, interestId) => {
        const interestScore = computePersonalInterestBoost(article, interestId).score;
        return Math.max(maxScore, interestScore);
      }, 0);

      let score = Math.max(
        directInterestScore,
        specialistSourceScore + domainContext.score,
      );

      if (sharedInterestScore && domainContext.score >= 8) {
        score = Math.max(score, Math.round(sharedInterestScore * 0.85) + domainContext.score);
      }

      if (!selectedDomainInterests.length && !sharedInterestSelections.length) {
        score = domainContext.score;
      }

      if (groupId === "banknote_intelligence") {
        score += strongBanknoteSignals.boost;
      } else if (groupId === "identity_documents") {
        score -= strongBanknoteSignals.identityPenalty;
      }

      const hasExplicitDomainAffinity =
        specialistSourceScore > 0
        || (groupId === "banknote_intelligence" && (domainContext.score >= 8 || context.topicType === "banknote" || context.domain === "banknote"))
        || (groupId === "identity_documents" && (domainContext.score >= 7 || ["travel_passport", "identity_document", "dmv_driver_license"].includes(context.topicType)))
        || (groupId === "digital_identity_biometrics" && (domainContext.score >= 7 || context.topicType === "digital_identity"))
        || (groupId === PERSONAL_DASHBOARD_SHARED_GROUP_ID && domainContext.score >= 7);

      if (!hasExplicitDomainAffinity) {
        score = Math.min(score, Math.round(domainContext.score * 0.75));
      }

      if (domainContext.excludedHits > 0 && directInterestScore < 18 && specialistSourceScore === 0) {
        score -= domainContext.excludedHits * 10;
      }

      domainScores[groupId] = Math.max(0, Math.round(score));
    });

    const threshold = getPersonalDashboardDomainThreshold();
    const matchedDomains = effectiveDomains.filter((groupId) => Number(domainScores[groupId]) >= threshold);

    const matched = effectiveDomains.length ? matchedDomains.length > 0 : true;

    return {
      matched,
      matchedDomains,
      selectedDomains: effectiveDomains,
      domainScores,
    };
  });
}

function articleMatchesPersonalDashboardSelection(article) {
  const selectedInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests);
  if (!selectedInterests.length) {
    return true;
  }

  if (isSharedSecurityOnlyPersonalSelection(selectedInterests)) {
    const selectedSharedInterests = getSelectedSharedSecuritySubinterests(selectedInterests);
    const matched = matchesSelectedSharedSecurityTechnique(article, selectedInterests);

    if (DEBUG_PERSONAL_DASHBOARD && selectedSharedInterests.length) {
      debugPersonalDashboardLog("[shared-security-standalone-filter]", {
        title: article?.title || "Untitled article",
        source: article?.source || article?.feedTitle || "",
        selectedSharedInterests,
        matched,
        assessments: selectedSharedInterests.map((interestId) => ({
          interestId,
          ...getSharedSecurityStandaloneAssessment(article, interestId),
        })),
      });
    }

    return matched;
  }

  const selectedMainDomains = getSelectedMainDomains(selectedInterests);
  const selectedSharedInterests = getSelectedSharedSecuritySubinterests(selectedInterests);
  const identityTechniqueBridgeMatched = articleMatchesSelectedIdentityTechniqueBridge(article, selectedInterests);
  const primaryDomain = getArticleDominantDomain(article);
  if (primaryDomain === "other" && !identityTechniqueBridgeMatched) {
    return false;
  }

  if (selectedMainDomains.length && !selectedMainDomains.includes(primaryDomain)) {
    if (!identityTechniqueBridgeMatched || !selectedMainDomains.includes("identity_documents")) {
      return false;
    }
  }

  // Main filters define the scope ("what document / market is this about?").
  // Shared Security Printing filters define the technique ("which security-printing method is involved?").
  // When both are selected together, the article must satisfy scope AND technique.
  const sharedSecurityTechniqueMatched = !selectedSharedInterests.length
    || matchesSelectedSharedSecurityTechnique(article, selectedInterests)
    || identityTechniqueBridgeMatched;

  if (isBanknotesOnlyPersonalSelection(selectedInterests)) {
    if (isBanknoteContaminated(article)) {
      return false;
    }

    const banknoteInterestIds = selectedInterests.filter(
      (interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "banknote_intelligence"
    );

    if (!banknoteInterestIds.length) {
      return (isBanknotePrimary(article) || isBanknoteAdjacent(article)) && sharedSecurityTechniqueMatched;
    }

    return banknoteInterestIds.some((interestId) => matchesBanknoteInterest(article, interestId))
      && sharedSecurityTechniqueMatched;
  }

  if (primaryDomain === "identity_documents") {
    if (isIdentityNavigationPageArticle(article)) {
      return false;
    }

    const selectedIdentityInterests = selectedInterests.filter(
      (interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "identity_documents"
    );
    const idCardsHolographyOvdBridgeMatched = matchesIdCardsHolographyOvdCombinationBridge(
      article,
      selectedIdentityInterests,
      selectedSharedInterests
    );
    const identityScopeMatched = !selectedIdentityInterests.length
      || selectedIdentityInterests.some((interestId) => computePersonalInterestBoost(article, interestId).score >= 18)
      || idCardsHolographyOvdBridgeMatched;
    return identityScopeMatched && sharedSecurityTechniqueMatched;
  }

  if (primaryDomain === "digital_identity_biometrics") {
    const selectedDigitalInterests = selectedInterests.filter(
      (interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "digital_identity_biometrics"
    );
    const digitalScopeMatched = !selectedDigitalInterests.length
      || selectedDigitalInterests.some((interestId) => getDigitalSubgroupHybridAssessment(article, interestId).included);
    return digitalScopeMatched && sharedSecurityTechniqueMatched;
  }

  return sharedSecurityTechniqueMatched;
}

function getPersonalIntelligenceLane(article) {
  const domainMatch = getPersonalDashboardDomainMatch(article);
  const score = computePersonalBoost(article).score;

  if (!domainMatch.matched) {
    return {
      lane: "broader",
      score,
      reasons: ["outside-selected-domain"],
    };
  }

  if (score >= 26) {
    return {
      lane: "primary",
      score,
      reasons: ["strong-selected-domain"],
    };
  }

  if (score >= 12) {
    return {
      lane: "related",
      score,
      reasons: ["selected-domain"],
    };
  }

  return {
    lane: "broader",
    score,
    reasons: ["selected-domain"],
  };
}

function getPersonalLaneRenderPlan(articles) {
  if (!hasPersonalDashboardSelections() || !Array.isArray(articles) || !articles.length) {
    return {
      orderedArticles: Array.isArray(articles) ? articles : [],
      laneCounts: null,
      hasLanes: false,
    };
  }

  const laneBuckets = {
    primary: [],
    related: [],
    broader: [],
  };

  articles.forEach((article) => {
    const laneResult = getPersonalIntelligenceLane(article);
    const bucket = laneBuckets[laneResult.lane] || laneBuckets.broader;
    bucket.push({
      article,
      laneScore: Number(laneResult.score) || 0,
    });
  });

  const sortLaneEntries = (left, right) => {
    if (right.laneScore !== left.laneScore) {
      return right.laneScore - left.laneScore;
    }
    return compareArticlesForDisplay(left.article, right.article);
  };

  laneBuckets.primary.sort(sortLaneEntries);
  laneBuckets.related.sort(sortLaneEntries);
  laneBuckets.broader.sort(sortLaneEntries);

  return {
    orderedArticles: [
      ...laneBuckets.primary.map((entry) => entry.article),
      ...laneBuckets.related.map((entry) => entry.article),
      ...laneBuckets.broader.map((entry) => entry.article),
    ],
    laneCounts: {
      primary: laneBuckets.primary.length,
      related: laneBuckets.related.length,
      broader: laneBuckets.broader.length,
    },
    hasLanes: true,
  };
}

function getPersonalDashboardSortMode() {
  return DEFAULT_PERSONAL_DASHBOARD_SORT;
}

function getArticlePublishedTimestamp(article) {
  const timestamp = toDate(article?.pubDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function comparePersonalDashboardArticlesByNewest(left, right) {
  return compareArticlesByPublicationDate(left, right);
}

function comparePersonalDashboardArticlesByRelevance(left, right) {
  const selectedMainDomains = getSelectedMainDomains();
  if (selectedMainDomains.length === 1 && selectedMainDomains[0] === "identity_documents") {
    const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests();
    const selectedSubinterest = selectedIdentityInterests.length === 1 ? selectedIdentityInterests[0] : "";
    if (selectedSubinterest === "border_control") {
      const leftContentType = getBorderControlContentType(left);
      const rightContentType = getBorderControlContentType(right);
      if (leftContentType.rank !== rightContentType.rank) {
        return leftContentType.rank - rightContentType.rank;
      }
    }
  }

  const rightScore = calculatePersonalDomainScore(right).domainScore;
  const leftScore = calculatePersonalDomainScore(left).domainScore;
  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  const leftTimestamp = getArticlePublishedTimestamp(left);
  const rightTimestamp = getArticlePublishedTimestamp(right);
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  const relevanceOrder = compareArticlesForDisplay(left, right);
  if (relevanceOrder !== 0) {
    return relevanceOrder;
  }

  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function getPersonalDashboardSourceKey(article) {
  const context = getPersonalBoostContext(article);
  return String(
    article?.source
    || article?.sourceName
    || article?.feedTitle
    || context.sourceText
    || context.domainText
    || "unknown-source"
  )
    .trim()
    .toLowerCase();
}

function getSourceDiversificationPenalty(sourceKey, consecutiveCount) {
  if (!sourceKey) {
    return 0;
  }
  if (consecutiveCount >= 5) {
    return 120;
  }
  if (consecutiveCount >= 3) {
    return 45;
  }
  return 0;
}

function diversifyPersonalDashboardResults(sortedArticles) {
  if (!Array.isArray(sortedArticles) || sortedArticles.length <= 3) {
    return Array.isArray(sortedArticles) ? sortedArticles : [];
  }

  const remaining = sortedArticles.map((article, index) => ({
    article,
    originalRank: index + 1,
    sourceKey: getPersonalDashboardSourceKey(article),
  }));
  const diversified = [];
  const debugMoves = [];
  const MAX_LOOKAHEAD = 10;

  while (remaining.length) {
    const lastSourceKey = diversified.length ? diversified[diversified.length - 1].sourceKey : "";
    let consecutiveCount = 0;
    for (let index = diversified.length - 1; index >= 0; index -= 1) {
      if (diversified[index].sourceKey !== lastSourceKey) {
        break;
      }
      consecutiveCount += 1;
    }

    let bestIndex = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    let bestPenalty = 0;
    const searchLimit = Math.min(MAX_LOOKAHEAD, remaining.length);

    for (let index = 0; index < searchLimit; index += 1) {
      const candidate = remaining[index];
      const nextConsecutiveCount =
        candidate.sourceKey && candidate.sourceKey === lastSourceKey
          ? consecutiveCount + 1
          : 1;
      const diversificationPenalty = getSourceDiversificationPenalty(
        candidate.sourceKey,
        nextConsecutiveCount
      );
      const rankDriftPenalty = index * 12;
      const candidateCost = diversificationPenalty + rankDriftPenalty;

      if (candidateCost < bestCost) {
        bestCost = candidateCost;
        bestIndex = index;
        bestPenalty = diversificationPenalty;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    diversified.push(selected);

    if (
      DEBUG_PERSONAL_DASHBOARD
      && (bestPenalty > 0 || selected.originalRank !== diversified.length)
    ) {
      debugMoves.push({
        source: selected.article?.source || selected.article?.feedTitle || "Unknown source",
        originalRank: selected.originalRank,
        diversifiedRank: diversified.length,
        diversificationPenalty: bestPenalty,
      });
    }
  }

  if (DEBUG_PERSONAL_DASHBOARD && debugMoves.length) {
    debugPersonalDashboardLog("[source-diversification]", debugMoves);
  }

  return diversified.map((entry) => entry.article);
}

function sortPersonalDashboardResults(articles, options = {}) {
  if (!Array.isArray(articles) || !articles.length) {
    return Array.isArray(articles) ? articles : [];
  }

  const sortMode = options.sortMode || getPersonalDashboardSortMode();
  const sortedArticles = articles.slice().sort((left, right) => {
    if (sortMode === "relevance") {
      return comparePersonalDashboardArticlesByRelevance(left, right);
    }
    return comparePersonalDashboardArticlesByNewest(left, right);
  });

  if (DEBUG_PERSONAL_DASHBOARD) {
    const firstArticle = sortedArticles[0] || null;
    const lastArticle = sortedArticles[sortedArticles.length - 1] || null;
    debugPersonalDashboardLog("[personal-dashboard-sort]", {
      sortMode,
      firstDate: firstArticle?.pubDate || "",
      lastDate: lastArticle?.pubDate || "",
      totalArticles: sortedArticles.length,
    });
  }

  return sortedArticles;
}

function sortArticlesForCurrentDashboardMode(articles, options = {}) {
  if (!Array.isArray(articles) || !articles.length) {
    return Array.isArray(articles) ? articles : [];
  }

  return hasPersonalDashboardSelections()
    ? sortPersonalDashboardResults(articles, options)
    : sortArticlesByPublicationDate(articles);
}

function renderPersonalLaneSections(container, articles, laneCounts) {
  if (!container || !Array.isArray(articles) || !articles.length) {
    return;
  }

  const laneSections = {
    primary: [],
    related: [],
    broader: [],
  };

  articles.forEach((article) => {
    const laneResult = getPersonalIntelligenceLane(article);
    (laneSections[laneResult.lane] || laneSections.broader).push(article);
  });

  const laneDefinitions = [
    { key: "primary", title: "Primary intelligence" },
    { key: "related", title: "Related intelligence" },
    { key: "broader", title: "Broader intelligence" },
  ];

  laneDefinitions.forEach(({ key, title }) => {
    const laneArticles = laneSections[key];
    if (!Array.isArray(laneArticles) || !laneArticles.length) {
      return;
    }

    const section = document.createElement("section");
    section.className = "intelligence-lane-section";

    const header = document.createElement("div");
    header.className = "intelligence-lane-header";
    header.textContent = `${title} · ${Number(laneCounts?.[key]) || laneArticles.length}`;
    section.appendChild(header);

    const cardsGrid = document.createElement("div");
    cardsGrid.className = "intelligence-lane-cards";
    laneArticles.forEach((article) => {
      cardsGrid.appendChild(renderArticleCard(article));
    });
    section.appendChild(cardsGrid);

    container.appendChild(section);
  });
}

function compareArticlesForDisplay(left, right) {
  const leftBucketOrder = getPersonalBucketOrder(getPersonalDomainBucket(left));
  const rightBucketOrder = getPersonalBucketOrder(getPersonalDomainBucket(right));
  if (leftBucketOrder !== rightBucketOrder) {
    return leftBucketOrder - rightBucketOrder;
  }

  const selectedMainDomains = getSelectedMainDomains();

  if (isBanknotesOnlyPersonalSelection()) {
    const leftAuthoritySource = isBanknoteAuthoritySource(left);
    const rightAuthoritySource = isBanknoteAuthoritySource(right);
    if (leftAuthoritySource !== rightAuthoritySource) {
      return rightAuthoritySource ? 1 : -1;
    }
  }

  if (selectedMainDomains.length === 1 && selectedMainDomains[0] === "identity_documents") {
    const selectedIdentityInterests = getSelectedIdentityDocumentSubinterests();
    const selectedSubinterest = selectedIdentityInterests.length === 1 ? selectedIdentityInterests[0] : "";
    if (selectedSubinterest) {
      if (selectedSubinterest === "border_control") {
        const leftContentType = getBorderControlContentType(left);
        const rightContentType = getBorderControlContentType(right);
        if (leftContentType.rank !== rightContentType.rank) {
          return leftContentType.rank - rightContentType.rank;
        }
      }

      const leftSourcePriority = getIdentityProfileSourcePriorityBoost(left, selectedSubinterest).boost;
      const rightSourcePriority = getIdentityProfileSourcePriorityBoost(right, selectedSubinterest).boost;
      if (rightSourcePriority !== leftSourcePriority) {
        return rightSourcePriority - leftSourcePriority;
      }
    }

    const leftAuthority = getIdentityDocumentSourceAuthority(left);
    const rightAuthority = getIdentityDocumentSourceAuthority(right);
    if (rightAuthority.multiplier !== leftAuthority.multiplier) {
      return rightAuthority.multiplier - leftAuthority.multiplier;
    }

    const leftContext = getIdentityDocumentInterestSignals(left);
    const rightContext = getIdentityDocumentInterestSignals(right);
    const leftContextScore = leftContext.primaryContextHits - leftContext.noisyHits;
    const rightContextScore = rightContext.primaryContextHits - rightContext.noisyHits;
    if (rightContextScore !== leftContextScore) {
      return rightContextScore - leftContextScore;
    }

    const leftVisualQuality = getArticleVisualQualityScore(left);
    const rightVisualQuality = getArticleVisualQualityScore(right);
    if (rightVisualQuality !== leftVisualQuality) {
      return rightVisualQuality - leftVisualQuality;
    }
  }

  const leftBoost = calculatePersonalDomainScore(left).domainScore;
  const rightBoost = calculatePersonalDomainScore(right).domainScore;
  if (rightBoost !== leftBoost) {
    return rightBoost - leftBoost;
  }

  const leftAuthority = getBanknoteSourceAuthority(left);
  const rightAuthority = getBanknoteSourceAuthority(right);
  if (rightAuthority.multiplier !== leftAuthority.multiplier) {
    return rightAuthority.multiplier - leftAuthority.multiplier;
  }

  const leftIntelligence = left?._intelligence || primeArticleIntelligence(left) || {};
  const rightIntelligence = right?._intelligence || primeArticleIntelligence(right) || {};
  const leftBaseScore =
    (Number(left?.sourceCount) || 0) * 8
    + (leftIntelligence.normalizedEvent?.confidence === "high" ? 40 : leftIntelligence.normalizedEvent?.confidence === "medium" ? 20 : 0)
    + Math.round(Number(leftIntelligence.identityDocumentRelevance || 0))
    + Math.round(Number(leftIntelligence.banknoteIntelligenceRelevance?.score || 0) * 0.35);
  const rightBaseScore =
    (Number(right?.sourceCount) || 0) * 8
    + (rightIntelligence.normalizedEvent?.confidence === "high" ? 40 : rightIntelligence.normalizedEvent?.confidence === "medium" ? 20 : 0)
    + Math.round(Number(rightIntelligence.identityDocumentRelevance || 0))
    + Math.round(Number(rightIntelligence.banknoteIntelligenceRelevance?.score || 0) * 0.35);
  if (rightBaseScore !== leftBaseScore) {
    return rightBaseScore - leftBaseScore;
  }

  const leftDate = toDate(left?.pubDate).getTime() || 0;
  const rightDate = toDate(right?.pubDate).getTime() || 0;

  if (rightDate !== leftDate) {
    return rightDate - leftDate;
  }

  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function logIdentityDocumentTopResults(articles) {
  if (!DEBUG_PERSONAL_DASHBOARD) {
    return;
  }

  const selectedMainDomains = getSelectedMainDomains();
  if (selectedMainDomains.length !== 1 || selectedMainDomains[0] !== "identity_documents") {
    return;
  }

  const selectedIdentityInterests = normalizePersonalDashboardInterests(state.personalDashboard.interests)
    .filter((interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "identity_documents");

  const topResults = (Array.isArray(articles) ? articles : []).slice(0, 10).map((article) => {
    const authority = getIdentityDocumentSourceAuthority(article);
    const context = getIdentityDocumentInterestSignals(article);
    const subinterest = getIdentityDocumentSubinterestScore(article);
    const selectedProfile = subinterest.selectedSubinterest
      ? subinterest.profileByInterest?.[subinterest.selectedSubinterest]
      : null;
    const sourcePriority = subinterest.selectedSubinterest
      ? getIdentityProfileSourcePriorityBoost(article, subinterest.selectedSubinterest)
      : { level: "none", boost: 0 };
    const finalScore = calculatePersonalDomainScore(article).domainScore;
    const matchedInterests = selectedIdentityInterests.filter(
      (interestId) => computePersonalInterestBoost(article, interestId).score >= 18
    );

    return {
      title: article?.title || "Untitled article",
      source: article?.source || article?.feedTitle || "",
      sourceAuthority: `${authority.level} (${authority.multiplier})`,
      contextScore: context.primaryContextHits - context.noisyHits,
      selectedSubinterest: subinterest.selectedSubinterest,
      subinterestScore: subinterest.score,
      mismatchPenalty: subinterest.mismatchPenalty,
      sourcePriorityLevel: sourcePriority.level,
      sourcePriorityBoost: sourcePriority.boost,
      googleNewsArticle: isGoogleNewsArticle(article),
      visualQualityScore: getArticleVisualQualityScore(article),
      profileScore: selectedProfile?.score || 0,
      profileRejections: selectedProfile?.rejectionReasons || [],
      travelNoiseArticle: Boolean(subinterest.travelNoiseArticle),
      finalScore,
      detectedSubinterestMatch: matchedInterests.join(", ") || subinterest.matchedSubinterest || "none",
    };
  });

  debugPersonalDashboardLog("[personal-dashboard-identity-top-results]", topResults);
}

function logDigitalIdentitySubgroupDiagnostics(articles) {
  if (!DEBUG_PERSONAL_DASHBOARD) {
    return;
  }

  const selectedMainDomains = getSelectedMainDomains();
  if (selectedMainDomains.length !== 1 || selectedMainDomains[0] !== "digital_identity_biometrics") {
    return;
  }

  const digitalInterests = PERSONAL_DASHBOARD_GROUPS.find((group) => group.id === "digital_identity_biometrics")?.interests || [];
  const digitalArticles = (Array.isArray(articles) ? articles : [])
    .filter((article) => getArticleDominantDomain(article) === "digital_identity_biometrics");

  const diagnostics = digitalInterests.map((interest) => {
    let beforeCount = 0;
    let afterCount = 0;
    let directMatches = 0;
    let hybridMatches = 0;
    let excludedWeakMatches = 0;
    let walletRelatedIncluded = 0;
    let walletRelatedExcluded = 0;
    let eidRelatedIncluded = 0;
    let eidRelatedExcluded = 0;

    digitalArticles.forEach((article) => {
      const assessment = getDigitalSubgroupHybridAssessment(article, interest.id);
      if (assessment.beforeIncluded) {
        beforeCount += 1;
      }
      if (assessment.included) {
        afterCount += 1;
      }
      if (assessment.directMatch) {
        directMatches += 1;
      }
      if (assessment.hybridMatch) {
        hybridMatches += 1;
      }
      if (assessment.excludedWeakMatch) {
        excludedWeakMatches += 1;
      }
      if (interest.id === "eid") {
        if (assessment.crossHits > 0 && assessment.included) {
          walletRelatedIncluded += 1;
        }
        if (assessment.crossHits > 0 && !assessment.included) {
          walletRelatedExcluded += 1;
        }
      }
      if (interest.id === "digital_wallet") {
        if (assessment.crossHits > 0 && assessment.included) {
          eidRelatedIncluded += 1;
        }
        if (assessment.crossHits > 0 && !assessment.included) {
          eidRelatedExcluded += 1;
        }
      }
    });

    const row = {
      subgroup: interest.label,
      beforeCount,
      afterCount,
      directMatches,
      hybridMatches,
      excludedWeakMatches,
      averageNetEvidence:
        afterCount > 0
          ? Math.round(
            (digitalArticles
              .filter((article) => getDigitalSubgroupHybridAssessment(article, interest.id).included)
              .reduce((sum, article) => sum + (getDigitalSubgroupHybridAssessment(article, interest.id).netEvidence || 0), 0) / afterCount) * 10
          ) / 10
          : 0,
    };

    if (interest.id === "eid") {
      row.walletRelatedIncluded = walletRelatedIncluded;
      row.walletRelatedExcluded = walletRelatedExcluded;
    }

    if (interest.id === "digital_wallet") {
      row.eidRelatedIncluded = eidRelatedIncluded;
      row.eidRelatedExcluded = eidRelatedExcluded;
    }

    return row;
  });

  debugPersonalDashboardLog("[digital-subgroup-hybrid-diagnostics]", diagnostics);
}

function isFeedPanelCollapsed() {
  return window.localStorage.getItem(FEED_PANEL_COLLAPSED_STORAGE_KEY) === "true";
}

function getFeedName(feedId) {
  return resolveFeedByIdentity(feedId)?.name || "Unknown feed";
}

function getFeedTopic(feedId) {
  return resolveFeedByIdentity(feedId)?.topic || "";
}

function normalizeFeedExactUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const normalizedUrl = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return raw;
  }
}

function getUniqueFeedIdentity(feed) {
  if (!feed || typeof feed !== "object") {
    return "";
  }

  const feedId = String(feed.id || "").trim();
  if (feedId) {
    return `feed-id:${feedId}`;
  }

  const sourceId = String(feed.sourceId || feed.uuid || "").trim();
  if (sourceId) {
    return `source-id:${sourceId}`;
  }

  const exactUrl = normalizeFeedExactUrl(
    feed.rssUrl || feed.url || feed.officialUrl || feed.siteUrl || feed.homepage || ""
  );
  if (exactUrl) {
    return `feed-url:${exactUrl}`;
  }

  const exactHost = getFeedMatchDomain(
    feed.rssUrl || feed.url || feed.officialUrl || feed.siteUrl || feed.homepage || ""
  );
  if (exactHost) {
    return `feed-host:${exactHost}`;
  }

  const normalizedHostFallback = normalizeFeedMatchValue(
    feed.rssUrl || feed.url || feed.officialUrl || feed.siteUrl || feed.homepage || ""
  );
  return normalizedHostFallback ? `feed-host-fallback:${normalizedHostFallback}` : "";
}

function getFeedDiagnosticDomain(feed) {
  if (!feed || typeof feed !== "object") {
    return "";
  }

  return getFeedMatchDomain(
    feed.rssUrl || feed.url || feed.officialUrl || feed.siteUrl || feed.homepage || feed.name || ""
  );
}

function getFeedLookupKey() {
  return state.feeds
    .map((feed) => [
      String(feed?.id || "").trim(),
      String(feed?.sourceId || "").trim(),
      normalizeFeedExactUrl(feed?.rssUrl || feed?.url || feed?.officialUrl || feed?.siteUrl || feed?.homepage || ""),
    ].join("|"))
    .join(";");
}

function rebuildArticleFeedIndexes() {
  runtime.articlesByFeedId = new Map();

  state.articles.forEach((article) => {
    const feedId = String(article?.feedId || "").trim();
    if (!feedId) {
      return;
    }

    const items = runtime.articlesByFeedId.get(feedId) || [];
    items.push(article);
    runtime.articlesByFeedId.set(feedId, items);
  });
}

function clearFeedRenderCaches() {
  runtime.groupedFeedCache = new Map();
  runtime.backendArticleQueryCache = new Map();
}

function getFeedRenderFilterSignature() {
  return JSON.stringify({
    search: state.filters.search || "",
    topic: state.filters.topic || "",
    tag: state.filters.tag || "",
    signalCategory: state.filters.signalCategory || "",
    date: state.filters.date || "",
    articleIds: Array.isArray(state.filters.articleIds) ? state.filters.articleIds.slice().sort() : [],
    alertLabel: state.filters.alertLabel || "",
    sourceGroup: state.filters.sourceGroup || "all",
    dashboardMode: state.dashboardMode || "normal",
    includeKeywords: Array.isArray(state.keywordFilters?.include) ? state.keywordFilters.include.slice().sort() : [],
    excludeKeywords: Array.isArray(state.keywordFilters?.exclude) ? state.keywordFilters.exclude.slice().sort() : [],
    personalDashboardInterests: Array.isArray(state.personalDashboard?.interests) ? state.personalDashboard.interests.slice().sort() : [],
    personalDashboardMode: normalizePersonalDashboardMode(state.personalDashboard?.mode),
  });
}

function getGroupedFeedCacheKey(feedIdentity) {
  return [
    `revision:${runtime.articleDataRevision}`,
    `feed:${String(feedIdentity || "").trim()}`,
    `filters:${getFeedRenderFilterSignature()}`,
  ].join("|");
}

function getCachedGroupedFeedResult(feedIdentity) {
  const cacheKey = getGroupedFeedCacheKey(feedIdentity);
  if (runtime.groupedFeedCache.has(cacheKey)) {
    return runtime.groupedFeedCache.get(cacheKey);
  }

  const selectedFeedResolution = getSelectedFeedResolution(feedIdentity);
  const candidateArticles = selectedFeedResolution?.selectedFeedId
    ? (runtime.articlesByFeedId.get(selectedFeedResolution.selectedFeedId) || [])
    : state.articles.filter((article) => articleMatchesSelectedFeed(article, feedIdentity));
  const rawMatches = sortArticlesByPublicationDate(candidateArticles);
  const filteredCandidates = candidateArticles.filter((article) => articleMatchesFilters(article, { ignoreFeedId: true }));
  const filteredMatches = hasPersonalDashboardSelections()
    ? sortArticlesForCurrentDashboardMode(filteredCandidates)
    : sortArticlesByPublicationDate(filteredCandidates);
  const groupedArticles = hasPersonalDashboardSelections()
    ? prepareDateFirstGroupedArticles(filteredMatches)
    : prepareSelectedFeedGroupedArticles(filteredMatches);
  const result = {
    selectedFeedResolution,
    rawMatches,
    filteredMatches,
    groupedArticles,
  };
  runtime.groupedFeedCache.set(cacheKey, result);
  return result;
}

function rebuildFeedLookupCaches() {
  runtime.feedByUniqueIdentity = new Map();
  runtime.feedById = new Map();
  runtime.feedBySourceId = new Map();
  runtime.duplicateFeedIds = new Set();
  runtime.duplicateSourceIds = new Set();
  runtime.selectedFeedResolutionCache = new Map();
  runtime.feedLookupKey = getFeedLookupKey();

  state.feeds.forEach((feed) => {
    const uniqueIdentity = getUniqueFeedIdentity(feed);
    const feedId = String(feed?.id || "").trim();
    const sourceId = String(feed?.sourceId || "").trim();

    if (uniqueIdentity && !runtime.feedByUniqueIdentity.has(uniqueIdentity)) {
      runtime.feedByUniqueIdentity.set(uniqueIdentity, feed);
    }

    if (feedId) {
      if (runtime.feedById.has(feedId)) {
        runtime.duplicateFeedIds.add(feedId);
      } else {
        runtime.feedById.set(feedId, feed);
      }
    }

    if (sourceId) {
      if (runtime.feedBySourceId.has(sourceId)) {
        runtime.duplicateSourceIds.add(sourceId);
      } else {
        runtime.feedBySourceId.set(sourceId, feed);
      }
    }
  });
}

function ensureFeedLookupCaches() {
  const nextLookupKey = getFeedLookupKey();
  if (runtime.feedLookupKey !== nextLookupKey) {
    rebuildFeedLookupCaches();
  }
}

function resolveFeedByIdentity(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return null;
  }

  ensureFeedLookupCaches();

  if (runtime.feedByUniqueIdentity.has(rawValue)) {
    return runtime.feedByUniqueIdentity.get(rawValue) || null;
  }

  if (runtime.feedById.has(rawValue)) {
    return runtime.feedById.get(rawValue) || null;
  }

  if (runtime.feedBySourceId.has(rawValue)) {
    return runtime.feedBySourceId.get(rawValue) || null;
  }

  const normalizedExactUrl = normalizeFeedExactUrl(rawValue);
  if (normalizedExactUrl) {
    const urlIdentity = `feed-url:${normalizedExactUrl}`;
    if (runtime.feedByUniqueIdentity.has(urlIdentity)) {
      return runtime.feedByUniqueIdentity.get(urlIdentity) || null;
    }
  }

  return null;
}

function resolveFeedForDiagnostics(value) {
  return resolveFeedByIdentity(value);
}

function getNonDmvFeeds() {
  return state.feeds.filter((feed) => !isDmvWrapperFeed(feed));
}

function getDmvFeeds() {
  return state.feeds.filter(isDmvWrapperFeed);
}

function isCanadianDmvAbbr(abbr) {
  return ["AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "NT", "NU", "YT"].includes(
    String(abbr || "").toUpperCase()
  );
}

function normalizeCountry(value) {
  const country = String(value || "").trim().toLowerCase();
  if (country === "usa" || country === "united states" || country === "united states of america") {
    return "us";
  }
  if (country === "ca") {
    return "canada";
  }
  return country;
}

function getCountryLabel(country) {
  const normalized = normalizeCountry(country);
  if (normalized === "us") {
    return "USA";
  }
  if (normalized === "canada") {
    return "Canada";
  }
  return normalized
    ? normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "";
}

function getCatalogEntryCountry(entry) {
  if (!entry) {
    return "";
  }

  return (
    normalizeCountry(entry?.country || entry?.dmvCountry || entry?.region) ||
    (isCanadianDmvAbbr(entry?.abbr) ? "canada" : "us")
  );
}

function getFeedCountry(feed) {
  return (
    normalizeCountry(feed?.country || feed?.dmvCountry || feed?.dmvRegion) ||
    (isCanadianDmvAbbr(feed?.dmvAbbr) ? "canada" : "")
  );
}

function getCatalogEntrySubdivisionLabel(entry) {
  return entry?.subdivision || entry?.province || entry?.state || entry?.abbr || "Untitled Feed";
}

function getSourceFamily(item) {
  return String(item?.sourceFamily || item?.dmvSourceFamily || item?.source_family || "")
    .trim()
    .toLowerCase();
}

function isDmvSource(item) {
  return (
    getSourceFamily(item) === "dmv" ||
    Boolean(item?.dmvState || item?.dmvRegion || item?.dmvCountry)
  );
}

function getCatalogEntryMode(entry) {
  const rssUrl = entry?.rssUrl || entry?.rss_url || "";
  return String(entry?.mode || (rssUrl ? "rss" : "link-only")).toLowerCase();
}

function getCatalogEntryRssUrl(entry) {
  return String(entry?.rssUrl || entry?.rss_url || "").trim();
}

function getUsDmvFeeds() {
  return getDmvFeeds().filter((feed) => {
    const country = getFeedCountry(feed);
    return country === "us" || (!country && !isCanadianDmvAbbr(feed.dmvAbbr));
  });
}

function getCanadaImportedDmvFeeds() {
  return getDmvFeeds().filter(isCanadaRssBackedFeed);
}

function getUsDmvCatalogEntries() {
  return state.dmvCatalog
    .filter((entry) => getCatalogEntryCountry(entry) === "us")
    .slice()
    .sort((left, right) =>
      String(getCatalogEntrySubdivisionLabel(left)).localeCompare(String(getCatalogEntrySubdivisionLabel(right)))
    );
}

function getCanadaDmvCatalogEntries() {
  return state.dmvCatalog
    .filter((entry) => getCatalogEntryCountry(entry) === "canada")
    .slice()
    .sort((left, right) =>
      String(getCatalogEntrySubdivisionLabel(left)).localeCompare(String(getCatalogEntrySubdivisionLabel(right)))
    );
}

function isUsLinkOnlyEntry(entry) {
  return getCatalogEntryCountry(entry) === "us" && getCatalogEntryMode(entry) === "link-only";
}

function isCanadaLinkOnlyEntry(entry) {
  return getCatalogEntryCountry(entry) === "canada" && getCatalogEntryMode(entry) === "link-only";
}

function isCanadaLinkOnlyFeed(feed) {
  const catalogEntry = getCanadaCatalogEntryForFeed(feed);

  if (catalogEntry) {
    if (getCatalogEntryMode(catalogEntry) === "rss") {
      return false;
    }

    return isCanadaLinkOnlyEntry(catalogEntry);
  }

  const name = String(feed?.name || "").toLowerCase();
  const country = getFeedCountry(feed);

  return (
    country === "canada" ||
    isCanadianDmvAbbr(feed?.dmvAbbr) ||
    isCanadianDmvName(name)
  );
}

function isCanadaRssBackedFeed(feed) {
  const catalogEntry = getCanadaCatalogEntryForFeed(feed);
  const catalogRssUrl = getCatalogEntryRssUrl(catalogEntry);
  const feedRssUrl = String(feed?.rssUrl || "").trim();

  return Boolean(
    getCatalogEntryCountry(catalogEntry) === "canada" &&
      getCatalogEntryMode(catalogEntry) === "rss" &&
      catalogRssUrl &&
      feedRssUrl === catalogRssUrl
  );
}

function isLinkOnlyDmvSource(feed) {
  return Boolean(
    isCanadaLinkOnlyFeed(feed) ||
      feed?.isCatalogOnly ||
      feed?.sourceType === "link-only" ||
      feed?.dmvMode === "link-only"
  );
}

function isRssBackedDmvFeed(feed) {
  return Boolean(isCanadaRssBackedFeed(feed) || (isDmvSource(feed) && feed?.dmvMode === "rss"));
}

function isRssBackedFeed(feed) {
  if (!feed) {
    return false;
  }

  if (isLinkOnlyDmvSource(feed)) {
    return false;
  }

  return String(feed?.sourceType || "rss").trim().toLowerCase() === "rss" || isRssBackedDmvFeed(feed);
}

function getRssBackedFeedCount(feeds = state.feeds) {
  return Array.isArray(feeds) ? feeds.filter((feed) => isRssBackedFeed(feed)).length : 0;
}

function toCatalogSource(entry, { idPrefix = "catalog-dmv", topic = "DMV Directory" } = {}) {
  const stateName = String(getCatalogEntrySubdivisionLabel(entry) || "DMV Directory").trim();
  const title = stateName.toLowerCase().includes("dmv") ? stateName : `${stateName} DMV`;
  const country = getCatalogEntryCountry(entry);

  return {
    id: `${idPrefix}-${country}-${entry?.feedPath || entry?.abbr || stateName}`,
    name: title,
    topic,
    rssUrl: entry?.officialUrl || "",
    officialUrl: entry?.officialUrl || "",
    sourceType: "link-only",
    isActive: true,
    isCatalogOnly: true,
    lastFetchedAt: null,
    lastStatus: "idle",
    dmvState: getCatalogEntrySubdivisionLabel(entry),
    dmvAbbr: entry?.abbr || null,
    dmvFeedPath: entry?.feedPath || null,
    dmvRegion: country,
    dmvCountry: country,
    dmvSubdivision: getCatalogEntrySubdivisionLabel(entry),
    dmvSubdivisionType: entry?.subdivisionType || (country === "canada" ? "province-territory" : "region"),
    dmvSourceFamily: entry?.sourceFamily || "dmv",
    dmvMode: getCatalogEntryMode(entry),
  };
}

function getCatalogOnlySourcesForCountry(country) {
  const normalizedCountry = normalizeCountry(country);
  const countryLabel = getCountryLabel(normalizedCountry) || "DMV";

  return state.dmvCatalog
    .filter(
      (entry) =>
        getCatalogEntryCountry(entry) === normalizedCountry &&
        getCatalogEntryMode(entry) === "link-only" &&
        !getFeedForCatalogEntry(entry)
    )
    .map((entry) =>
      toCatalogSource(entry, {
        idPrefix: `catalog-${normalizedCountry}`,
        topic: `${countryLabel} DMV`,
      })
    );
}

function getNonUsCatalogOnlySources() {
  return state.dmvCatalog
    .filter(
      (entry) =>
        getCatalogEntryCountry(entry) !== "us" &&
        getCatalogEntryMode(entry) === "link-only" &&
        !getFeedForCatalogEntry(entry)
    )
    .map((entry) => {
      const country = getCatalogEntryCountry(entry);
      const countryLabel = getCountryLabel(country) || "DMV";
      return toCatalogSource(entry, {
        idPrefix: `catalog-${country}`,
        topic: `${countryLabel} DMV`,
      });
    });
}

function getCanadaCatalogOnlySources() {
  return getCatalogOnlySourcesForCountry("canada");
}

function isGoogleAlertsFeed(feed) {
  const name = String(feed?.name || "").toLowerCase();
  const rssUrl = String(feed?.rssUrl || "").toLowerCase();

  return (
    feed?.sourceType === "google" ||
    name.includes("google") ||
    name.includes("alert") ||
    rssUrl.includes("google.com/alerts")
  );
}

function isCanadianDmvName(name) {
  return [
    "alberta",
    "british columbia",
    "manitoba",
    "new brunswick",
    "newfoundland and labrador",
    "nova scotia",
    "northwest territories",
    "nunavut",
    "ontario",
    "prince edward island",
    "quebec",
    "saskatchewan",
    "yukon",
  ].some((province) => name.includes(province));
}

function getFeedGroupName(feed) {
  const name = String(feed?.name || "").toLowerCase();
  const country = getFeedCountry(feed);

  if (isDmvSource(feed) && country) {
    return getCountryLabel(country);
  }

  if (
    isCanadianDmvAbbr(feed?.dmvAbbr) ||
    isCanadianDmvName(name) ||
    name.includes("canada")
  ) {
    return "Canada";
  }

  if (name.includes("dmv")) {
    return "USA";
  }

  if (isGoogleAlertsFeed(feed)) {
    return "Google Alerts";
  }

  return "Other";
}

function getSourceGroupLabels(feeds) {
  const labels = new Set(DEFAULT_SOURCE_GROUPS.filter((label) => label !== "Other"));
  feeds.forEach((feed) => {
    const label = getFeedGroupName(feed);
    if (label && label !== "Other") {
      labels.add(label);
    }
  });
  return Array.from(labels).concat("Other");
}

function getSourceGroupTabLabels() {
  return ["all"].concat(getSourceGroupLabels(state.feeds.concat(getNonUsCatalogOnlySources())));
}

function getActiveArticleFeedId() {
  if (state.filters.feedId) {
    return state.filters.feedId;
  }

  if (state.filters.dmvFeedId) {
    return getSelectedDmvFeed()?.id || "";
  }

  const selectedCanadaFeed = getSelectedCanadaFeed();
  return selectedCanadaFeed?.id || "";
}

function getActiveSidebarFeedId() {
  if (state.filters.feedId) {
    return state.filters.feedId;
  }

  if (state.filters.dmvFeedId) {
    return state.filters.dmvFeedId;
  }

  const selectedCanadaFeed = getSelectedCanadaFeed();
  return selectedCanadaFeed?.id || "";
}

function getSourceListMode() {
  if (state.filters.feedId) {
    return "normal-feed";
  }

  if (state.filters.canadaDmvFeedPath) {
    return "canada-entry";
  }

  if (state.filters.dmvFeedId) {
    return "dmv-feed";
  }

  if (state.filters.canadaDmvAll) {
    return "canada-all";
  }

  if (state.dashboardMode === "usa") {
    return "dmv-only";
  }

  if (state.dashboardMode === "canada") {
    return "canada-all";
  }

  return "all";
}

function getSelectedUsDmvCatalogEntry() {
  if (!state.filters.dmvFeedId) {
    return null;
  }

  return state.dmvCatalog.find(
    (entry) => getCatalogEntryCountry(entry) === "us" && entry.abbr === state.filters.dmvFeedId
  ) || null;
}

function getSelectedCanadaCatalogEntry() {
  if (!state.filters.canadaDmvFeedPath) {
    return null;
  }

  return state.dmvCatalog.find((entry) => entry.feedPath === state.filters.canadaDmvFeedPath) || null;
}

function getFeedForCatalogEntry(entry) {
  if (!entry) {
    return null;
  }

  if (getCatalogEntryCountry(entry) !== "us") {
    const entryRssUrl = getCatalogEntryRssUrl(entry);

    if (getCatalogEntryMode(entry) !== "rss" || !entryRssUrl) {
      return null;
    }

    return state.feeds.find((feed) => String(feed.rssUrl || "").trim() === entryRssUrl) || null;
  }

  return state.feeds.find((feed) => {
    const entryState = String(getCatalogEntrySubdivisionLabel(entry) || "").toLowerCase();
    const feedName = String(feed.name || "").toLowerCase();
    const entryRssUrl = getCatalogEntryRssUrl(entry);

    if (entryRssUrl && String(feed.rssUrl || "").trim() === entryRssUrl) {
      return true;
    }

    if (entry.abbr && feed.dmvAbbr === entry.abbr) {
      return true;
    }

    if (entryState && feedName.includes(entryState) && feedName.includes("dmv")) {
      return true;
    }

    return false;
  }) || null;
}

function getCanadaCatalogEntryForFeed(feed) {
  if (!feed) {
    return null;
  }

  const feedName = String(feed.name || "").toLowerCase();
  const feedUrl = String(feed.rssUrl || "").trim();
  const feedAbbr = String(feed.dmvAbbr || "").toUpperCase();

  return getCanadaDmvCatalogEntries().find((entry) => {
    const entryMode = getCatalogEntryMode(entry);
    const entryUrl = getCatalogEntryRssUrl(entry);
    const entryState = String(getCatalogEntrySubdivisionLabel(entry)).toLowerCase();
    const entryAbbr = String(entry.abbr || "").toUpperCase();

    if (entryMode === "rss") {
      return Boolean(entryUrl && feedUrl === entryUrl);
    }

    return (
      (entryAbbr && feedAbbr === entryAbbr) ||
      (entryState && feedName.includes(entryState))
    );
  }) || null;
}

function getSelectedDmvFeed() {
  return getFeedForCatalogEntry(getSelectedUsDmvCatalogEntry());
}

function getSelectedCanadaFeed() {
  return getFeedForCatalogEntry(getSelectedCanadaCatalogEntry());
}

function isDmvFeedId(feedId) {
  return state.feeds.some((feed) => feed.id === feedId && isDmvWrapperFeed(feed));
}

function isOfficialFallbackArticle(article) {
  const title = String(article?.title || "").toLowerCase();
  return (
    title.includes("dmv official site") ||
    article?.sourceType === "dmv-official" ||
    article?.isOfficialFallback === true
  );
}

function getFeedStatusPresentation(feed) {
  if (isLinkOnlyDmvSource(feed)) {
    return {
      text: "No RSS",
      tone: "is-idle",
    };
  }

  const tone =
    feed.lastStatus === "error"
      ? "is-error"
      : feed.lastStatus === "success"
        ? "is-success"
        : "is-idle";

  return {
    text: feed.lastStatus || "idle",
    tone,
  };
}

function isFeedError(feed) {
  return feed?.lastStatus === "error" && !isLinkOnlyDmvSource(feed);
}

function syncFeedErrorNotifications() {
  const errorFeeds = state.feeds.filter(isFeedError);
  const currentErrorFeedIds = new Set(errorFeeds.map((feed) => feed.id));

  if (runtime.snapshotLoaded) {
    errorFeeds
      .filter((feed) => !runtime.knownErrorFeedIds.has(feed.id))
      .slice(0, 3)
      .forEach((feed) => {
        showNotification({
          title: "Feed error detected",
          message: feed.name || "A feed reported an error.",
          type: "warning",
        });
      });
  }

  runtime.knownErrorFeedIds = currentErrorFeedIds;
  runtime.snapshotLoaded = true;
}

function syncNewArticleNotifications(articles) {
  const realArticles = articles.filter((article) => !isOfficialFallbackArticle(article));
  const currentArticleIds = new Set(realArticles.map((article) => article.id).filter(Boolean));

  if (!runtime.snapshotLoaded) {
    runtime.knownArticleIds = currentArticleIds;
    return;
  }

  if (!runtime.realtimeEnabled) {
    const newArticles = realArticles.filter((article) => article.id && !runtime.knownArticleIds.has(article.id));
    if (newArticles.length) {
      const firstArticle = newArticles
        .slice()
        .sort((left, right) => toDate(right.pubDate).getTime() - toDate(left.pubDate).getTime())[0];
      showNotification({
        title: "New articles detected",
        message:
          newArticles.length === 1
            ? firstArticle.title || "A new article was added."
            : `${newArticles.length} new articles were added. Latest: ${firstArticle.title || "Untitled article"}`,
        type: "info",
      });
    }
  }

  runtime.knownArticleIds = currentArticleIds;
}

function getSummaryMetrics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const realArticles = state.articles.filter((article) => !isOfficialFallbackArticle(article));

  return {
    activeFeeds: state.feeds.filter((feed) => feed.isActive !== false).length,
    topics: new Set(
      state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean)
    ).size,
    articlesToday: realArticles.filter((article) => toDate(article.pubDate) >= startOfToday).length,
    totalArticles: Number(state.articleStats.totalAvailable) || realArticles.length,
  };
}

function getFeedArticleCounts(articles) {
  return articles.reduce((counts, article) => {
    const feedId = article.feedId || "";
    if (!feedId) {
      return counts;
    }

    counts.set(feedId, (counts.get(feedId) || 0) + 1);
    return counts;
  }, new Map());
}

function getRecentWindowStart() {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isAnalyticsFeed(feed) {
  return Boolean(feed?.sourceType !== "link-only" && !isLinkOnlyDmvSource(feed));
}

function getAnalyticsFeedsForScope(feeds, articleCounts) {
  const analyticsFeeds = feeds.filter(isAnalyticsFeed);
  if (state.analyticsScope === "active") {
    return analyticsFeeds.filter((feed) => feed.isActive !== false && (articleCounts.get(feed.id) || 0) > 0);
  }

  return analyticsFeeds;
}

function getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, filter = state.analyticsQualityFilter) {
  switch (filter) {
    case "high":
      return feeds.filter((feed) => (articleCounts.get(feed.id) || 0) > 0 && (qualityStats.get(feed.id)?.qualityScore || 0) >= 0.75);
    case "inactive":
      return feeds.filter((feed) => (articleCounts.get(feed.id) || 0) > 0 && (recentCounts.get(feed.id) || 0) === 0);
    case "zero":
      return feeds.filter((feed) => (articleCounts.get(feed.id) || 0) === 0);
    default:
      return feeds;
  }
}

function getAnalyticsQualityFilterCounts(feeds, articleCounts, recentCounts, qualityStats) {
  return {
    all: feeds.length,
    high: getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, "high").length,
    inactive: getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, "inactive").length,
    zero: getAnalyticsFeedsForQualityFilter(feeds, articleCounts, recentCounts, qualityStats, "zero").length,
  };
}

function getFeedActivityStats(feeds, articles) {
  const recentWindowStart = getRecentWindowStart();
  const stats = new Map(
    feeds
      .filter(isAnalyticsFeed)
      .map((feed) => [
        feed.id,
        {
          feed,
          total: 0,
          recent: 0,
          lastArticleDate: null,
          status: "",
        },
      ])
  );

  articles.forEach((article) => {
    const feedStats = stats.get(article.feedId);
    if (!feedStats) {
      return;
    }

    const articleDate = toDate(article.pubDate);
    feedStats.total += 1;
    if (articleDate >= recentWindowStart) {
      feedStats.recent += 1;
    }
    if (!feedStats.lastArticleDate || articleDate > feedStats.lastArticleDate) {
      feedStats.lastArticleDate = articleDate;
    }
  });

  stats.forEach((feedStats) => {
    feedStats.status =
      feedStats.total === 0
        ? "dead"
        : feedStats.recent === 0
          ? "inactive"
          : feedStats.total < LOW_VALUE_ARTICLE_THRESHOLD
            ? "low-value"
            : "healthy";
  });

  return stats;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function isArticleNoiseForFeedQuality(article, feed) {
  const feedRule = getTopicKeywordRule(feed?.topic) || getTopicKeywordRule(article?.topic);
  if (feedRule) {
    return isKeywordRuleFalsePositive(article, feedRule);
  }

  return (
    isPassportFalsePositive(article) ||
    isDriverLicenseMusicFalsePositive(article) ||
    isCoinGamingFalsePositive(article)
  );
}

function getFeedQualityExclusionReason(article, feed) {
  if (isPassportFalsePositive(article)) {
    return "carFalsePositive";
  }
  if (isDriverLicenseMusicFalsePositive(article)) {
    return "musicFalsePositive";
  }
  if (isCoinGamingFalsePositive(article)) {
    return "gamingFalsePositive";
  }

  const feedRule = getTopicKeywordRule(feed?.topic) || getTopicKeywordRule(article?.topic);
  if (feedRule && isKeywordRuleFalsePositive(article, feedRule)) {
    return "keywordNoise";
  }

  return "";
}

function articleMatchesCurrentViewFilters(article) {
  if (state.filters.tag && !getArticleFilterTags(article).includes(normalizeFilterTag(state.filters.tag))) {
    return false;
  }

  if (state.filters.signalCategory && !getArticleSignalCategories(article).includes(state.filters.signalCategory)) {
    return false;
  }

  if (state.filters.topic && article.topic !== state.filters.topic) {
    return false;
  }

  if (state.filters.date && toDateInputValue(article.pubDate) !== state.filters.date) {
    return false;
  }

  if (state.filters.search && !getArticleSearchText(article).includes(state.filters.search.toLowerCase())) {
    return false;
  }

  const exactArticleIds = Array.isArray(state.filters.articleIds) ? state.filters.articleIds : [];
  if (exactArticleIds.length && !exactArticleIds.includes(article.id)) {
    return false;
  }

  const activeFeedId = getActiveArticleFeedId();
  if (activeFeedId && article.feedId !== activeFeedId) {
    return false;
  }

  return true;
}

function getFeedQualityStats(feeds, articles) {
  const stats = new Map(
    feeds
      .filter(isAnalyticsFeed)
      .map((feed) => [
        feed.id,
        {
          feed,
          totalArticles: 0,
          totalFetched: 0,
          relevantArticles: 0,
          shownArticles: 0,
          filteredArticles: 0,
          filteredOut: 0,
          filterReasons: {
            keywordNoise: 0,
            carFalsePositive: 0,
            musicFalsePositive: 0,
            gamingFalsePositive: 0,
          },
          relevanceRatio: 0,
          normalizedActivity: 0,
          viewMatchedArticles: 0,
          viewMatchScore: 0,
          qualityScore: 0,
          qualityTone: "low",
        },
      ])
  );

  articles.forEach((article) => {
    const feedStats = stats.get(article.feedId);
    if (!feedStats) {
      return;
    }

    feedStats.totalArticles += 1;
    feedStats.totalFetched += 1;
    const exclusionReason = getFeedQualityExclusionReason(article, feedStats.feed);
    if (exclusionReason) {
      feedStats.filteredArticles += 1;
      feedStats.filteredOut += 1;
      feedStats.filterReasons[exclusionReason] = (feedStats.filterReasons[exclusionReason] || 0) + 1;
    } else {
      feedStats.relevantArticles += 1;
      feedStats.shownArticles += 1;
      if (articleMatchesCurrentViewFilters(article)) {
        feedStats.viewMatchedArticles += 1;
      }
    }
  });

  const maxArticles = Math.max(1, ...Array.from(stats.values()).map((item) => item.totalArticles));

  stats.forEach((feedStats) => {
    feedStats.relevanceRatio = feedStats.totalFetched
      ? feedStats.shownArticles / feedStats.totalFetched
      : 0;
    feedStats.normalizedActivity = clampNumber(feedStats.totalArticles / maxArticles, 0, 1);
    feedStats.qualityScore = feedStats.relevanceRatio;
    feedStats.viewMatchScore = feedStats.shownArticles
      ? feedStats.viewMatchedArticles / feedStats.shownArticles
      : 0;
    feedStats.filteredRatio = feedStats.totalFetched ? feedStats.filteredOut / feedStats.totalFetched : 0;
    feedStats.dominantNoiseCount = Math.max(
      feedStats.filterReasons.carFalsePositive || 0,
      feedStats.filterReasons.musicFalsePositive || 0,
      feedStats.filterReasons.gamingFalsePositive || 0
    );
    feedStats.isNoisyFeed =
      feedStats.filteredRatio > 0.15 ||
      (feedStats.totalFetched > 0 && feedStats.dominantNoiseCount / feedStats.totalFetched > 0.15);
    feedStats.qualityTone =
      feedStats.qualityScore >= 0.75 ? "high" : feedStats.qualityScore >= 0.4 ? "medium" : "low";
  });

  return stats;
}

function getCombinedFeedRankings(feeds, totalCounts, todayCounts, recentCounts, qualityStats, limit = 50) {
  return feeds
    .filter(isAnalyticsFeed)
    .map((feed) => {
      const feedId = feed.id;
      const quality = qualityStats.get(feedId) || {};
      return {
        feedId,
        total: totalCounts.get(feedId) || 0,
        today: todayCounts.get(feedId) || 0,
        recent: recentCounts.get(feedId) || 0,
        name: feed.name || getFeedName(feedId),
        topic: feed.topic || getFeedTopic(feedId),
        isActive: feed.isActive !== false,
        isInactive: feed.isInactive === true || feed.isActive === false,
        totalFetched: quality.totalFetched || 0,
        shownArticles: quality.shownArticles || 0,
        filteredOut: quality.filteredOut || 0,
        filteredRatio: quality.filteredRatio || 0,
        dominantNoiseCount: quality.dominantNoiseCount || 0,
        isNoisyFeed: quality.isNoisyFeed === true,
        filterReasons: quality.filterReasons || {},
        relevantArticles: quality.relevantArticles || 0,
        filteredArticles: quality.filteredArticles || 0,
        relevanceRatio: quality.relevanceRatio || 0,
        normalizedActivity: quality.normalizedActivity || 0,
        viewMatchedArticles: quality.viewMatchedArticles || 0,
        viewMatchScore: quality.viewMatchScore || 0,
        qualityScore: quality.qualityScore || 0,
        qualityTone: quality.qualityTone || "low",
      };
    })
    .sort(
      (left, right) =>
        right.qualityScore - left.qualityScore ||
        right.normalizedActivity - left.normalizedActivity ||
        right.today - left.today ||
        right.recent - left.recent ||
        right.total - left.total ||
        left.name.localeCompare(right.name)
    )
    .slice(0, limit);
}

function getFeedInsightRows(feeds, totalCounts, todayCounts, recentCounts, qualityStats) {
  return getCombinedFeedRankings(feeds, totalCounts, todayCounts, recentCounts, qualityStats, 100);
}

function getNewlyActiveFeedInsights(rows, excludedFeedIds = new Set(), limit = 5) {
  return rows
    .filter((row) => !excludedFeedIds.has(row.feedId) && row.today > 0)
    .sort((left, right) => right.today - left.today || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function getFeedInsights(rows) {
  const getReviewSignal = (row) => {
    const filteredPercent = Math.round((row.filteredRatio || 0) * 100);
    const primaryReason = getPrimaryFeedQualityReason(row.filterReasons);

    if (row.isInactive) {
      return {
        label: "Inactive too long",
        priority: "high",
        reason: "No recent activity detected.",
      };
    }
    if (row.total === 0) {
      return {
        label: "Zero article feed",
        priority: "high",
        reason: "Zero articles since import.",
      };
    }
    if (row.qualityScore < 0.95) {
      return {
        label: "Review",
        priority: "medium",
        reason: `${Math.round((row.qualityScore || 0) * 100)}% clean`,
      };
    }
    if (row.filteredRatio > 0.1) {
      return {
        label: "Noisy",
        priority: "medium",
        reason: primaryReason ? `${filteredPercent}% filtered, mostly ${primaryReason}` : `${filteredPercent}% filtered`,
      };
    }
    if (row.filteredRatio > 0.03) {
      return {
        label: "Noisy",
        priority: "low",
        reason: primaryReason ? `${filteredPercent}% filtered, mostly ${primaryReason}` : "minor noise detected",
      };
    }
    if (row.isActive && row.total > 0 && row.total < 5) {
      return {
        label: "Low value",
        priority: "low",
        reason: "Low useful output so far.",
      };
    }
    return null;
  };

  const getReviewPriorityRank = (priority) => {
    if (priority === "high") {
      return 0;
    }
    if (priority === "medium") {
      return 1;
    }
    return 2;
  };

  const getAttentionReason = (row) => {
    return getReviewSignal(row)?.label || "";
  };
  const needsAttention = rows
    .map((row) => ({ ...row, attentionReason: getAttentionReason(row) }))
    .filter((row) => row.attentionReason)
    .sort((left, right) => {
      const priority = (row) =>
        row.isInactive ? 0 : row.total === 0 ? 1 : row.qualityScore < 0.9 ? 2 : 3;
      return priority(left) - priority(right) || right.qualityScore - left.qualityScore || left.name.localeCompare(right.name);
    })
    .slice(0, 5);
  const reviewCandidates = rows
    .map((row) => {
      const reviewSignal = getReviewSignal(row);
      return reviewSignal
        ? {
            ...row,
            reviewLabel: reviewSignal.label,
            reviewPriority: reviewSignal.priority,
            reviewReason: reviewSignal.reason,
          }
        : null;
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        getReviewPriorityRank(left.reviewPriority) - getReviewPriorityRank(right.reviewPriority) ||
        right.filteredRatio - left.filteredRatio ||
        left.name.localeCompare(right.name)
    )
    .slice(0, 5);
  const needsAttentionIds = new Set(needsAttention.map((row) => row.feedId));
  const isBestPerformer = (row) => row.qualityScore >= 0.98 && row.today > 0 && row.total >= 20;
  const bestPerformers = rows
    .filter((row) => !needsAttentionIds.has(row.feedId) && isBestPerformer(row))
    .sort((left, right) => right.qualityScore - left.qualityScore || right.today - left.today || left.name.localeCompare(right.name))
    .slice(0, 5);
  const bestPerformerIds = new Set(bestPerformers.map((row) => row.feedId));
  const goodFeeds = rows
    .filter(
      (row) =>
        !needsAttentionIds.has(row.feedId) &&
        !bestPerformerIds.has(row.feedId) &&
        row.qualityScore >= 0.9 &&
        row.today === 0 &&
        !row.isInactive
    )
    .sort((left, right) => right.total - left.total || right.qualityScore - left.qualityScore || left.name.localeCompare(right.name))
    .slice(0, 5);

  return {
    bestPerformers,
    goodFeeds,
    needsAttention,
    reviewCandidates,
    newlyActive: getNewlyActiveFeedInsights(rows, new Set(bestPerformers.map((row) => row.feedId))),
  };
}

function getLowValueFeeds(articles, limit = 8) {
  return Array.from(getFeedActivityStats(state.feeds, articles).values())
    .filter((stats) => stats.status !== "healthy")
    .map((stats) => ({
      id: stats.feed.id,
      name: stats.feed.name || "Untitled feed",
      total: stats.total,
      lastArticleDate: stats.lastArticleDate,
      status: stats.status,
    }))
    .sort((left, right) => {
      const statusPriority = { dead: 0, inactive: 1, "low-value": 2 };
      const leftPriority = statusPriority[left.status] ?? 3;
      const rightPriority = statusPriority[right.status] ?? 3;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftTime = left.lastArticleDate ? left.lastArticleDate.getTime() : 0;
      const rightTime = right.lastArticleDate ? right.lastArticleDate.getTime() : 0;
      return leftTime - rightTime || left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

function renderAnalyticsRows(items, emptyText) {
  if (!items.length) {
    return `<p class="analytics-empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ol class="analytics-list">
      ${items
        .map(
          (item) => `
            <li>
              <span>${escapeHtml(item.name)}</span>
              <strong>${item.count}</strong>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function formatFeedQualityReasons(reasons = {}) {
  const labels = {
    keywordNoise: "keyword noise",
    carFalsePositive: "car-related",
    musicFalsePositive: "music-related",
    gamingFalsePositive: "gaming-related",
  };
  const parts = Object.entries(labels)
    .map(([key, label]) => [label, reasons[key] || 0])
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}`);

  return parts.length ? parts.join(", ") : "no filtered articles";
}

function getPrimaryFeedQualityReason(reasons = {}) {
  const entries = Object.entries(reasons).filter(([, count]) => count > 0);
  if (!entries.length) {
    return "";
  }
  const [reasonKey, count] = entries.sort((left, right) => right[1] - left[1])[0];
  const labels = {
    keywordNoise: "keyword noise",
    carFalsePositive: "car false positives",
    musicFalsePositive: "music false positives",
    gamingFalsePositive: "gaming false positives",
  };
  return `${count} ${labels[reasonKey] || "filtered"}`;
}

function getFeedInsightLabel(item, section) {
  const qualityPercent = Math.round((item.qualityScore || 0) * 100);
  if (section === "best") {
    return `Best - ${qualityPercent}% clean`;
  }
  if (section === "good") {
    return `Quiet - ${qualityPercent}% clean`;
  }
  if (section === "new") {
    return `+${item.today} today`;
  }
  if (section === "attention" && item.attentionReason) {
    return item.attentionReason;
  }
  if (section === "review" && item.reviewLabel) {
    return item.reviewLabel;
  }
  if (item.total === 0) {
    return "Low volume";
  }
  if (item.recent === 0) {
    return "No recent activity";
  }
  if (item.qualityScore >= 0.4 && item.qualityScore < 0.75) {
    return `Review - ${qualityPercent}% clean`;
  }
  if (item.qualityScore >= 0.75 && !item.filteredOut) {
    return "Low activity";
  }
  if (item.qualityScore < 0.4) {
    return `Low quality · ${qualityPercent}% clean`;
  }
  return `${item.filteredOut} filtered · review`;
}

function renderFeedInsightList(items, section, emptyText) {
  if (!items.length) {
    return `<p class="analytics-empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ol class="analytics-list analytics-insight-list">
      ${items
        .map((item) => {
          const feedId = String(item.feedId || "");
          const clickableAttrs = feedId
            ? `class="analytics-clickable" data-analytics-feed-id="${escapeHtml(feedId)}" role="button" tabindex="0" title="Click to filter this feed"`
            : "";
          const todayClickableAttrs = feedId
            ? `class="analytics-clickable" data-analytics-feed-id="${escapeHtml(feedId)}" data-analytics-today-only="true" role="button" tabindex="0" title="Click to filter this feed from today"`
            : "";
          const qualityPercent = Math.round((item.qualityScore || 0) * 100);
          const filteredPercent = Math.max(0, 100 - qualityPercent);
          const qualityBreakdown = `${item.totalFetched} fetched, ${item.shownArticles} shown, ${item.filteredOut} filtered. Reasons: ${formatFeedQualityReasons(item.filterReasons)}`;
          const label = getFeedInsightLabel(item, section);
          return `
            <li>
              <span ${clickableAttrs}>
                ${escapeHtml(item.name)}
                <small class="analytics-row-detail">${escapeHtml(label)}</small>
                ${
                  item.filteredOut
                    ? `<small class="analytics-row-detail">${escapeHtml(getPrimaryFeedQualityReason(item.filterReasons))}</small>`
                    : ""
                }
                ${item.isNoisyFeed ? `<small class="analytics-row-detail is-warning">Noisy feed</small>` : ""}
                ${section === "review" && item.reviewReason ? `<small class="analytics-row-detail">${escapeHtml(item.reviewReason)}</small>` : ""}
              </span>
              <div class="analytics-count-pair">
                ${
                  section === "review" && item.reviewPriority
                    ? `<strong class="analytics-review-priority is-${escapeHtml(item.reviewPriority)}">${escapeHtml(item.reviewPriority)}</strong>`
                    : ""
                }
                <strong class="analytics-quality is-${item.qualityTone}" title="${escapeHtml(qualityBreakdown)}">
                  ${qualityPercent}% clean
                </strong>
                <strong>${item.total} total</strong>
                <strong ${todayClickableAttrs}>${item.today} today</strong>
              </div>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function renderFeedInsights(insights) {
  const sections = [
    ["Best performers", "best", insights.bestPerformers, renderFeedInsightList(insights.bestPerformers, "best", "")],
    [
      "Good feeds",
      "good",
      insights.goodFeeds,
      renderFeedInsightList(insights.goodFeeds, "good", "All high-quality feeds are currently active"),
    ],
    ["Needs attention", "attention", insights.needsAttention, renderFeedInsightList(insights.needsAttention, "attention", "")],
    [
      "Review candidates",
      "review",
      insights.reviewCandidates,
      renderFeedInsightList(insights.reviewCandidates, "review", "No feeds need review right now"),
    ],
  ].filter(([, sectionKey, sectionItems, content]) => {
    return (sectionKey === "good" || sectionKey === "review" || sectionItems.length > 0) && content;
  });

  if (!sections.length) {
    return `<p class="analytics-empty">No feed insights available for this scope.</p>`;
  }

  return `
    <div class="feed-insights-grid">
      ${sections
        .map(
          ([title, sectionKey, , content]) => `
            <section class="feed-insight-section is-${sectionKey}">
              <span class="feed-insight-title">${title}</span>
              ${content}
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAnalyticsQualityTabs(activeFilter, counts = {}) {
  const tabs = [
    ["all", "All"],
    ["high", "High quality"],
    ["inactive", "Inactive"],
    ["zero", "Zero articles"],
  ];

  return `
    <div class="analytics-quality-tabs" aria-label="Feed ranking quick filters">
      ${tabs
        .map(([value, label]) => {
          const isActive = activeFilter === value;
          return `
            <button class="${isActive ? "is-active" : ""}" type="button" data-analytics-quality-filter="${value}" aria-pressed="${isActive}">
              <span>${label}</span>
              <strong>${counts[value] || 0}</strong>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderLowValueFeedRows(items) {
  if (!items.length) {
    return `<p class="analytics-empty">No dead or inactive feeds detected.</p>`;
  }

  return `
    <ol class="analytics-list analytics-low-value-list">
      ${items
        .map((item) => {
          const lastArticle = item.lastArticleDate ? formatDate(item.lastArticleDate) : "never";
          return `
            <li>
              <span>
                ${escapeHtml(item.name)}
                <small>${item.total} total - last: ${escapeHtml(lastArticle)}</small>
              </span>
              <strong class="analytics-status is-${item.status}">${item.status}</strong>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function addDashboardAlert({
  title,
  detail = "",
  contextLine = "",
  totalLine = "",
  type = "info",
  topic = "",
  todayOnly = false,
  articleIds = [],
  priorityLevel = "low",
  isDmvAlert = false,
  isSystemMessage = false,
  delta = 0,
  baselineAverage = 0,
  interpretation = "",
}) {
  const exactArticleIds = Array.from(new Set((articleIds || []).filter(Boolean))).sort();
  if (isSystemMessage) {
    runtime.dashboardAlerts = runtime.dashboardAlerts.filter(
      (alert) => !(alert.isSystemMessage && alert.title === title && alert.detail === detail)
    );
  }
  runtime.dashboardAlertId += 1;
  runtime.dashboardAlerts.unshift({
    id: String(runtime.dashboardAlertId),
    title,
    detail,
    contextLine,
    totalLine,
    type,
    topic,
    todayOnly,
    articleIds: exactArticleIds,
    priorityLevel,
    isDmvAlert,
    isSystemMessage,
    delta,
    baselineAverage,
    interpretation,
    createdAt: new Date(),
  });
  runtime.dashboardAlerts = runtime.dashboardAlerts.slice(0, DASHBOARD_ALERT_LIMIT);
}

function dismissDashboardAlert(alertId) {
  runtime.dashboardAlerts = runtime.dashboardAlerts.filter((alert) => alert.id !== alertId);
  renderSummary();
}

function renderActivityLog() {
  const activityItems = runtime.activityLog;
  if (!activityItems.length) {
    return `<p class="analytics-empty">No recent activity yet.</p>`;
  }

  return `
    <div class="activity-log-actions">
      <button type="button" data-clear-activity-log="true">Clear activity</button>
    </div>
    <ol class="dashboard-alert-list activity-log-list">
      ${activityItems
        .map((item) => {
          const isClickable =
            (Array.isArray(item.articleIds) && item.articleIds.length > 0) || Boolean(item.feedId);
          const relativeTime = formatRelativeTime(item.createdAt);
          return `
            <li
              class="dashboard-alert activity-log-item is-${item.tone || "info"} priority-${item.priorityLevel || "low"}${isClickable ? " analytics-clickable" : ""}"
              ${isClickable ? `data-activity-id="${escapeHtml(item.id)}" role="button" tabindex="0" title="Click to view related items"` : ""}
            >
              <div>
                <strong>
                  <span class="dashboard-alert-priority is-${escapeHtml(item.priorityLevel || "low")}">${escapeHtml(item.priorityLevel || "low")}</span>
                  ${escapeHtml(item.title)}
                </strong>
                ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}
                ${item.recommendation ? `<small class="activity-log-recommendation">Next: ${escapeHtml(item.recommendation)}</small>` : ""}
                ${relativeTime ? `<small class="activity-log-meta">${escapeHtml(relativeTime)}</small>` : ""}
              </div>
              <button type="button" data-dismiss-activity-item="${item.id}" aria-label="Dismiss activity item">Dismiss</button>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function renderDashboardAlerts() {
  const meaningfulAlerts = runtime.dashboardAlerts.filter((alert) => !alert.isSystemMessage);
  const latestSystemMessage = runtime.dashboardAlerts.find((alert) => alert.isSystemMessage);
  const systemMessage = !meaningfulAlerts.length && latestSystemMessage
    ? `<p class="analytics-empty">System: ${escapeHtml(latestSystemMessage.title)}</p>`
    : "";

  if (!meaningfulAlerts.length) {
    return systemMessage || `<p class="analytics-empty">No recent feed alerts this session.</p>`;
  }

  return `
    ${systemMessage}
    <ol class="dashboard-alert-list">
      ${meaningfulAlerts
        .map((alert) => {
          const isClickable = Array.isArray(alert.articleIds) && alert.articleIds.length > 0;
          return `
            <li
              class="dashboard-alert is-${alert.type} priority-${alert.priorityLevel || "low"}${isClickable ? " analytics-clickable" : ""}"
              ${isClickable ? `data-alert-id="${escapeHtml(alert.id)}" role="button" tabindex="0" title="Click to view exact matching articles"` : ""}
            >
              <div>
                <strong>
                  <span class="dashboard-alert-priority is-${escapeHtml(alert.priorityLevel || "low")}">${escapeHtml(getAlertPriorityLabel(alert.priorityLevel || "low"))}</span>
                  ${escapeHtml(alert.title)}
                </strong>
                ${alert.contextLine ? `<small>${escapeHtml(alert.contextLine)}</small>` : alert.detail ? `<small>${escapeHtml(alert.detail)}</small>` : ""}
                ${alert.totalLine ? `<small>${escapeHtml(alert.totalLine)}</small>` : ""}
              </div>
              <button type="button" data-dismiss-dashboard-alert="${alert.id}" aria-label="Dismiss alert">Dismiss</button>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function buildFeedStats(feeds, articles, todayStart) {
  const feedStats = feeds.reduce((stats, feed) => {
    stats[feed.id] = {
      total: 0,
      today: 0,
    };
    return stats;
  }, {});

  articles.forEach((article) => {
    if (!article.feedId || !feedStats[article.feedId]) {
      return;
    }

    feedStats[article.feedId].total += 1;
    if (toDate(article.pubDate) >= todayStart) {
      feedStats[article.feedId].today += 1;
    }
  });

  return feedStats;
}

function createSnapshotStats(feeds, articles) {
  const realArticles = articles.filter((article) => !isOfficialFallbackArticle(article));
  const articleIds = new Set(realArticles.map((article) => article.id).filter(Boolean));
  const feedActivity = getFeedActivityStats(feeds, realArticles);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const feedStats = buildFeedStats(feeds, realArticles, todayStart);
  const snapshotArticles = realArticles.map((article) => ({
    id: article.id,
    feedId: article.feedId,
    pubDate: article.pubDate,
  }));
  const snapshotFeeds = feeds.map((feed) => ({
    id: feed.id,
    name: feed.name || "Untitled feed",
    topic: feed.topic || "",
    isActive: feed.isActive !== false,
    lastStatus: feed.lastStatus || "idle",
  }));
  const feedStates = new Map(
    snapshotFeeds.map((feed) => [
      feed.id,
      {
        id: feed.id,
        name: feed.name,
        isActive: feed.isActive,
        lastStatus: feed.lastStatus || "idle",
        isError: feed.lastStatus === "error",
        articlesToday: feedStats[feed.id]?.today || 0,
      },
    ])
  );
  const feedsById = new Map(feeds.map((feed) => [feed.id, feed]));

  return {
    articleIds,
    articles: snapshotArticles,
    totalArticles: snapshotArticles.length,
    articlesToday: snapshotArticles.filter((article) => toDate(article.pubDate) >= todayStart).length,
    feedStats,
    hasFeedStats: true,
    feeds: snapshotFeeds,
    feedActivity,
    feedStates,
    feedErrors: new Set(feeds.filter(isFeedError).map((feed) => feed.id)),
    feedsById,
  };
}

function serializeSnapshotStats(snapshot) {
  return {
    articleIds: Array.from(snapshot.articleIds),
    articles: snapshot.articles || [],
    totalArticles: snapshot.totalArticles,
    articlesToday: snapshot.articlesToday,
    feedStats: snapshot.feedStats || {},
    hasFeedStats: snapshot.hasFeedStats === true,
    feeds: snapshot.feeds || Array.from(snapshot.feedStates?.values?.() || []).map((feed) => ({
      id: feed.id,
      name: feed.name,
      topic: feed.topic || "",
      isActive: feed.isActive,
      lastStatus: feed.lastStatus,
      articleCountToday: Number(feed.articleCountToday ?? feed.articlesToday) || 0,
    })),
    feedErrors: Array.from(snapshot.feedErrors),
    feedStates: Array.from(snapshot.feedStates?.values?.() || []),
    feedActivity: Array.from(snapshot.feedActivity.entries()).map(([feedId, stats]) => ({
      feedId,
      name: stats.feed.name || "Untitled feed",
      isActive: stats.feed.isActive !== false,
      lastStatus: stats.feed.lastStatus || "idle",
      isDmvRssFeed: isDmvSource(stats.feed) && stats.feed.dmvMode === "rss",
      total: stats.total,
      recent: stats.recent,
      status: stats.status,
      lastArticleDate: stats.lastArticleDate ? stats.lastArticleDate.toISOString() : null,
    })),
  };
}

function hydrateSnapshotStats(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.articleIds)) {
    return null;
  }

  const feedActivityItems = Array.isArray(snapshot.feedActivity) ? snapshot.feedActivity : [];
  const feedActivity = new Map(
    feedActivityItems.map((item) => [
      item.feedId,
      {
        feed: {
          id: item.feedId,
          name: item.name,
          isActive: item.isActive,
          lastStatus: item.lastStatus,
          dmvMode: item.isDmvRssFeed ? "rss" : "",
          dmvCountry: item.isDmvRssFeed ? "stored" : "",
        },
        total: Number(item.total) || 0,
        recent: Number(item.recent) || 0,
        status: item.status || "",
        lastArticleDate: item.lastArticleDate ? new Date(item.lastArticleDate) : null,
        isDmvRssFeed: Boolean(item.isDmvRssFeed),
        isActive: item.isActive !== false,
        lastStatus: item.lastStatus || "idle",
      },
    ])
  );
  const fallbackFeedStates = feedActivityItems.map((item) => ({
    id: item.feedId,
    name: item.name,
    isActive: item.isActive !== false,
    lastStatus: item.lastStatus || "idle",
    isError: item.lastStatus === "error",
    articlesToday: 0,
  }));
  const snapshotFeeds = Array.isArray(snapshot.feeds)
    ? snapshot.feeds
    : (Array.isArray(snapshot.feedStates) ? snapshot.feedStates : fallbackFeedStates).map((item) => ({
        id: item.id,
        name: item.name || "Untitled feed",
        topic: item.topic || "",
        isActive: item.isActive !== false,
        lastStatus: item.lastStatus || "idle",
      }));
  const feedStats =
    snapshot.feedStats && typeof snapshot.feedStats === "object"
      ? snapshot.feedStats
      : snapshotFeeds.reduce((stats, feed) => {
          stats[feed.id] = {
            total: 0,
            today: Number(feed.articleCountToday ?? feed.articlesToday) || 0,
          };
          return stats;
        }, {});
  const hasFeedStats = snapshot.hasFeedStats === true;
  const feedStates = new Map(
    snapshotFeeds.map((item) => [
      item.id,
      {
        id: item.id,
        name: item.name || "Untitled feed",
        isActive: item.isActive !== false,
        lastStatus: item.lastStatus || "idle",
        isError: item.lastStatus === "error" || Boolean(item.isError),
        articlesToday: Number(feedStats[item.id]?.today) || 0,
      },
    ])
  );

  return {
    articleIds: new Set(snapshot.articleIds),
    articles: Array.isArray(snapshot.articles) ? snapshot.articles : snapshot.articleIds.map((id) => ({ id })),
    totalArticles: Number(snapshot.totalArticles) || snapshot.articleIds.length,
    articlesToday: Number(snapshot.articlesToday) || 0,
    feedStats,
    hasFeedStats,
    feeds: snapshotFeeds,
    feedErrors: new Set(Array.isArray(snapshot.feedErrors) ? snapshot.feedErrors : []),
    feedActivity,
    feedStates,
    feedsById: new Map(
      feedActivityItems.map((item) => [
        item.feedId,
        {
          id: item.feedId,
          name: item.name,
          isActive: item.isActive,
          lastStatus: item.lastStatus,
          dmvMode: item.isDmvRssFeed ? "rss" : "",
          dmvCountry: item.isDmvRssFeed ? "stored" : "",
        },
      ])
    ),
  };
}

function loadStoredAlertSnapshot() {
  try {
    return hydrateSnapshotStats(JSON.parse(window.localStorage.getItem(ALERT_SNAPSHOT_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function saveAlertSnapshot(snapshot) {
  try {
    window.localStorage.setItem(ALERT_SNAPSHOT_STORAGE_KEY, JSON.stringify(serializeSnapshotStats(snapshot)));
  } catch {
    // Storage can fail in private browsing or quota-constrained environments; alerts still work in-memory.
  }
}

function getAlertDedupeKey(alert) {
  const exactArticleIds = Array.isArray(alert.articleIds) ? alert.articleIds.join(",") : "";
  return [alert.type || "info", alert.title || "", alert.detail || "", exactArticleIds].join("|").toLowerCase();
}

function pruneActivityLogEntries(entries, now = Date.now()) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => {
      const createdAt = Number(new Date(entry?.createdAt).getTime());
      return entry?.key && Number.isFinite(createdAt) && now - createdAt <= ACTIVITY_LOG_TTL_MS;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, ACTIVITY_LOG_LIMIT);
}

function loadStoredActivityLog() {
  try {
    return pruneActivityLogEntries(JSON.parse(window.localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function saveActivityLog(entries) {
  const nextEntries = pruneActivityLogEntries(entries);
  runtime.activityLog = nextEntries;
  try {
    window.localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(nextEntries));
  } catch {
    // Activity history is a convenience layer; the dashboard still works without storage access.
  }
}

function buildActivityRecommendation(activity) {
  const title = String(activity?.title || "").toLowerCase();
  const detail = String(activity?.detail || "").toLowerCase();

  if (title.includes("initial load")) {
    return "Review source history; likely backfill";
  }
  if (title.includes("active again") || title.includes("started producing")) {
    return "Check new articles";
  }
  if (title.includes("noisy") || detail.includes("filtered")) {
    return "Consider adding exclusion keywords";
  }
  if (activity?.priorityLevel === "high" && title.includes("article")) {
    return "Review latest articles";
  }
  if ((activity?.tone || activity?.type) === "error") {
    return "Check feed health and recent source changes";
  }
  return "";
}

function buildActivityKey(activity) {
  const articleIds = Array.isArray(activity?.articleIds) ? activity.articleIds.join(",") : "";
  return [
    activity?.type || "status",
    activity?.title || "",
    activity?.detail || "",
    activity?.feedId || "",
    activity?.priorityLevel || "low",
    articleIds,
  ]
    .join("|")
    .toLowerCase();
}

function createActivityEntry(activity) {
  runtime.activityLogId += 1;
  const articleIds = Array.from(new Set((activity.articleIds || []).filter(Boolean))).sort();
  const priority = activity.priority || activity.priorityLevel || "low";
  const createdAt = activity.createdAt || new Date().toISOString();
  return {
    id: String(runtime.activityLogId),
    key: activity.key || buildActivityKey(activity),
    title: activity.title || "",
    detail: activity.detail || "",
    recommendation: activity.recommendation || buildActivityRecommendation(activity),
    priority,
    priorityLevel: priority,
    type: activity.type || "status",
    tone: activity.tone || activity.visualTone || "info",
    topic: activity.topic || "",
    todayOnly: Boolean(activity.todayOnly),
    articleIds,
    feedId: activity.feedId || "",
    timestamp: createdAt,
    createdAt,
  };
}

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function persistActivityEntries(entries) {
  const nextEntries = (Array.isArray(entries) ? entries : []).map(createActivityEntry);
  if (!nextEntries.length) {
    saveActivityLog(runtime.activityLog);
    return;
  }

  const existing = loadStoredActivityLog();
  const seenKeys = new Set(existing.map((entry) => entry.key));
  const merged = [...existing];

  nextEntries.forEach((entry) => {
    if (seenKeys.has(entry.key)) {
      return;
    }
    merged.unshift(entry);
    seenKeys.add(entry.key);
  });

  saveActivityLog(merged);
}

function dismissActivityItem(activityId) {
  saveActivityLog(runtime.activityLog.filter((item) => item.id !== activityId));
  renderSummary();
}

function clearActivityLog() {
  saveActivityLog([]);
  renderSummary();
}

function loadRecentAlertKeys() {
  try {
    const now = Date.now();
    return JSON.parse(window.localStorage.getItem(ALERT_DEDUPE_STORAGE_KEY) || "[]").filter(
      (entry) => entry?.key && now - Number(entry.shownAt || 0) < ALERT_DEDUPE_WINDOW_MS
    );
  } catch {
    return [];
  }
}

function saveRecentAlertKeys(entries) {
  try {
    window.localStorage.setItem(ALERT_DEDUPE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Alert dedupe is a convenience; alerts can still render without storage access.
  }
}

function shouldShowDashboardAlert(alert) {
  const key = getAlertDedupeKey(alert);
  const recentKeys = loadRecentAlertKeys();
  if (recentKeys.some((entry) => entry.key === key)) {
    return false;
  }

  recentKeys.unshift({ key, shownAt: Date.now() });
  saveRecentAlertKeys(recentKeys.slice(0, 50));
  return true;
}

function getAlertPriorityRank(priorityLevel) {
  if (priorityLevel === "high") {
    return 1;
  }
  if (priorityLevel === "medium") {
    return 2;
  }
  return 3;
}

function getAlertCandidateRank(candidate) {
  const dmvBoost = candidate.isDmvAlert ? 0.5 : 0;
  const summaryPenalty = candidate.dedupeScope === "global-new-articles" ? 1 : 0;
  return getAlertPriorityRank(candidate.alert.priorityLevel) + summaryPenalty - dmvBoost;
}

function getVolumeAlertPriority(delta) {
  if (delta > 25) {
    return "high";
  }
  if (delta > 5) {
    return "medium";
  }
  return "low";
}

function getAlertPriorityLabel(priorityLevel) {
  if (priorityLevel === "high") {
    return "Spike";
  }
  if (priorityLevel === "medium") {
    return "Elevated";
  }
  return "Normal";
}

function getFeedBaselineAverage(stats) {
  const recent = Number(stats?.recent) || 0;
  if (recent <= 0) {
    return 0;
  }
  return recent / 30;
}

function formatBaselineAverage(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}/day`;
}

function getAlertInterpretation(delta, baselineAverage, priorityLevel, isInitialLoadSpike = false) {
  if (isInitialLoadSpike) {
    return "Initial load spike detected";
  }
  if (!Number.isFinite(delta) || delta <= 0) {
    return "Normal activity";
  }
  if (priorityLevel === "high" || (baselineAverage > 0 && delta >= baselineAverage * 3)) {
    return "Spike detected";
  }
  if (baselineAverage > 0 && delta > baselineAverage) {
    return "Above normal activity";
  }
  return "Normal activity";
}

function getAlertArticleIdKey(alert) {
  const articleIds = Array.isArray(alert.articleIds) ? alert.articleIds : [];
  return articleIds.slice().sort().join("|");
}

function alertArticleIdsOverlap(leftAlert, rightAlert) {
  const leftIds = Array.isArray(leftAlert.articleIds) ? leftAlert.articleIds : [];
  const rightIds = new Set(Array.isArray(rightAlert.articleIds) ? rightAlert.articleIds : []);
  return leftIds.some((articleId) => rightIds.has(articleId));
}

function dedupeAlertCandidates(candidates) {
  const selected = [];

  candidates
    .slice()
    .sort((left, right) => getAlertCandidateRank(left) - getAlertCandidateRank(right) || right.score - left.score)
    .forEach((candidate) => {
      const articleIdKey = getAlertArticleIdKey(candidate.alert);
      if (articleIdKey && selected.some((item) => getAlertArticleIdKey(item.alert) === articleIdKey)) {
        return;
      }

      if (
        candidate.dedupeScope === "global-new-articles" &&
        selected.some((item) => getAlertArticleIdKey(item.alert) && alertArticleIdsOverlap(item.alert, candidate.alert))
      ) {
        return;
      }

      selected.push(candidate);
    });

  return selected;
}

function getSnapshotFeedStats(snapshot, feedId) {
  const snapshotArticles = Array.isArray(snapshot?.articles) ? snapshot.articles : [];
  const articlesHaveFeedIds = snapshotArticles.some((article) => article.feedId);
  if (articlesHaveFeedIds) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const feedArticles = snapshotArticles.filter((article) => article.feedId === feedId);
    return {
      total: feedArticles.length,
      today: feedArticles.filter((article) => toDate(article.pubDate) >= todayStart).length,
      source: "articles",
    };
  }

  if (snapshot?.hasFeedStats === true && snapshot?.feedStats?.[feedId]) {
    return {
      total: Number(snapshot.feedStats[feedId].total) || 0,
      today: Number(snapshot.feedStats[feedId].today) || 0,
      source: "feedStats",
    };
  }

  const activityStats = snapshot?.feedActivity?.get?.(feedId);
  if (activityStats) {
    return {
      total: Number(activityStats.total) || 0,
      today: 0,
      source: "feedActivity",
    };
  }

  return null;
}

function generateAlerts(previous, current) {
  intelligenceLog("[alerts][snapshot-compare]", { previous, current });
  const candidates = [];
  const feedDiffs = [];
  const queueAlert = (priorityLevel, alert, score = 0, options = {}) => {
    const articleIds = Array.from(new Set((alert.articleIds || []).filter(Boolean))).sort();
    const isDmvAlert = Boolean(options.isDmvAlert);
    const isSystemMessage = Boolean(options.isSystemMessage);
    candidates.push({
      score,
      dedupeScope: options.dedupeScope || "",
      isDmvAlert,
      alert: {
        ...alert,
        articleIds,
        priorityLevel,
        isDmvAlert,
        isSystemMessage,
      },
    });
  };

  if (!previous) {
    addDashboardAlert({
      title: "Monitoring started",
      detail: "Alerts will compare future snapshots against this baseline.",
      type: "info",
    });
    return;
  }

  const previousArticleIds = previous.articleIds instanceof Set
    ? previous.articleIds
    : new Set(Array.isArray(previous.articleIds) ? previous.articleIds : []);
  const newArticles = (current.articles || []).filter((article) => article.id && !previousArticleIds.has(article.id));
  const newArticleIds = newArticles.map((article) => article.id);
  const newArticleIdsByFeed = newArticles.reduce((groups, article) => {
    if (!article.feedId) {
      return groups;
    }

    const feedArticleIds = groups.get(article.feedId) || [];
    feedArticleIds.push(article.id);
    groups.set(article.feedId, feedArticleIds);
    return groups;
  }, new Map());
  const newArticleCount = newArticleIds.length;
  if (newArticleCount > 0) {
    const globalPriority = getVolumeAlertPriority(newArticleCount);
    queueAlert(globalPriority, {
      title: `All feeds: +${newArticleCount} article${newArticleCount === 1 ? "" : "s"}`,
      contextLine: `${getAlertInterpretation(newArticleCount, 0, globalPriority)} since the previous snapshot.`,
      totalLine: `${current.totalArticles} total articles`,
      detail: "Total article count increased since the previous snapshot.",
      type: "info",
      articleIds: newArticleIds,
      delta: newArticleCount,
      baselineAverage: 0,
      interpretation: getAlertInterpretation(newArticleCount, 0, globalPriority),
    }, newArticleCount, { dedupeScope: "global-new-articles" });
  }

  const previousFeedsById = new Map((previous.feeds || []).map((feed) => [feed.id, feed]));

  (current.feeds || []).forEach((feed) => {
    const previousFeed = previousFeedsById.get(feed.id);
    const previousStats = getSnapshotFeedStats(previous, feed.id);
    const currentStats = getSnapshotFeedStats(current, feed.id);
    if (!previousFeed || !currentStats) {
      return;
    }

    const previousTotal = previousStats ? Number(previousStats.total) || 0 : null;
    const currentTotal = Number(currentStats.total) || 0;
    const totalDiff = previousTotal === null ? 0 : currentTotal - previousTotal;
    const previousToday = previousStats ? Number(previousStats.today) || 0 : null;
    const currentToday = Number(currentStats.today) || 0;
    const todayDiff = previousToday === null ? 0 : currentToday - previousToday;
    const enteredError = previousFeed.lastStatus !== "error" && feed.lastStatus === "error";
    const alertScore = currentToday * 3 + currentTotal * 0.1;
    const canCompareFeedStats = previousTotal !== null;
    const isInitialLoadSpike = canCompareFeedStats && previousTotal < 100 && totalDiff > 100;
    const feedNewArticleIds = newArticleIdsByFeed.get(feed.id) || [];
    const liveFeed = current.feedsById?.get(feed.id) || feed;
    const isDmvFeed = isDmvSource(liveFeed);
    const totalDiffPriority = getVolumeAlertPriority(totalDiff);
    const todayDiffPriority = getVolumeAlertPriority(todayDiff);
    const statusAlertPriority = "medium";
    const baselineAverage = getFeedBaselineAverage(current.feedActivity.get(feed.id));
    const baselineLabel = formatBaselineAverage(baselineAverage);
    const totalInterpretation = getAlertInterpretation(totalDiff, baselineAverage, totalDiffPriority, isInitialLoadSpike);
    const todayInterpretation = getAlertInterpretation(todayDiff, baselineAverage, todayDiffPriority, false);
    const totalContextLine = baselineLabel
      ? `${totalInterpretation} (avg: ${baselineLabel})`
      : totalInterpretation;
    const todayContextLine = baselineLabel
      ? `${todayInterpretation} (avg: ${baselineLabel})`
      : todayInterpretation;
    const totalLine = `${currentTotal} total article${currentTotal === 1 ? "" : "s"}`;
    const todayTotalLine = `${currentToday} article${currentToday === 1 ? "" : "s"} today`;

    if ((canCompareFeedStats && (totalDiff !== 0 || todayDiff !== 0)) || enteredError) {
      feedDiffs.push({
        id: feed.id,
        name: feed.name,
        previousTotal,
        currentTotal,
        totalDiff,
        previousToday,
        currentToday,
        todayDiff,
        previousSource: previousStats?.source || "",
        currentSource: currentStats?.source || "",
        score: alertScore,
        previousStatus: previousFeed.lastStatus,
        currentStatus: feed.lastStatus,
      });
    }

    if (enteredError) {
      queueAlert("high", {
        title: `${feed.name} entered error state`,
        detail: "The feed reported an error in the latest snapshot.",
        type: "error",
        topic: feed.topic || "",
        todayOnly: false,
      }, alertScore, { isDmvAlert: isDmvFeed });
    }

    if (canCompareFeedStats && previousTotal === 0 && currentTotal > 0 && totalDiff > 0) {
      queueAlert(statusAlertPriority, {
        title: `${feed.name}: +${totalDiff} article${totalDiff === 1 ? "" : "s"}`,
        contextLine: baselineLabel
          ? `${totalContextLine}; started producing articles`
          : "Started producing articles",
        totalLine,
        detail: `${totalDiff} new article${totalDiff === 1 ? "" : "s"} since the previous snapshot.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: false,
        articleIds: feedNewArticleIds,
        delta: totalDiff,
        baselineAverage,
        interpretation: totalInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    } else if (canCompareFeedStats && totalDiff > 0) {
      queueAlert(totalDiffPriority, {
        title: `${feed.name}: +${totalDiff} article${totalDiff === 1 ? "" : "s"}${isInitialLoadSpike ? " (initial load)" : ""}`,
        contextLine: totalContextLine,
        totalLine,
        detail: `${currentTotal} total article${currentTotal === 1 ? "" : "s"} for this feed.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: false,
        articleIds: feedNewArticleIds,
        delta: totalDiff,
        baselineAverage,
        interpretation: totalInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    }

    if (canCompareFeedStats && previousToday === 0 && currentToday > 0 && todayDiff > 0) {
      queueAlert(statusAlertPriority, {
        title: `${feed.name}: +${todayDiff} article${todayDiff === 1 ? "" : "s"}`,
        contextLine: baselineLabel
          ? `${todayContextLine}; active again today`
          : "Active again today",
        totalLine: todayTotalLine,
        detail: `+${todayDiff} new article${todayDiff === 1 ? "" : "s"} today.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: true,
        articleIds: feedNewArticleIds,
        delta: todayDiff,
        baselineAverage,
        interpretation: todayInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    } else if (canCompareFeedStats && todayDiff > 0) {
      queueAlert(todayDiffPriority, {
        title: `${feed.name}: +${todayDiff} article${todayDiff === 1 ? "" : "s"}`,
        contextLine: todayContextLine,
        totalLine: todayTotalLine,
        detail: `${currentToday} article${currentToday === 1 ? "" : "s"} today.`,
        type: "success",
        topic: feed.topic || "",
        todayOnly: true,
        articleIds: feedNewArticleIds,
        delta: todayDiff,
        baselineAverage,
        interpretation: todayInterpretation,
      }, alertScore, { dedupeScope: "feed-new-articles", isDmvAlert: isDmvFeed });
    } else if (canCompareFeedStats && previousToday > 0 && currentToday === 0) {
      queueAlert("medium", {
        title: `${feed.name} stopped producing`,
        detail: "No articles today in the latest snapshot.",
        type: "warning",
        topic: feed.topic || "",
        todayOnly: true,
      }, alertScore, { isDmvAlert: isDmvFeed });
    }
  });

  intelligenceLog("ALERT DIFF", {
    totalDiff: newArticleCount,
    feedDiffs,
  });

  current.feedActivity.forEach((stats, feedId) => {
    const previousStats = previous.feedActivity.get(feedId);
    if (!previousStats) {
      return;
    }

    const feedName = stats.feed.name || "Untitled feed";
    const liveFeed = current.feedsById?.get(feedId) || stats.feed;
    const isDmvFeed = isDmvSource(liveFeed);
    const isDmvRssFeed = isDmvFeed && liveFeed.dmvMode === "rss";
    const wasDmvRssFeed = previousStats.isDmvRssFeed || (isDmvSource(previousStats.feed) && previousStats.feed.dmvMode === "rss");

    if (stats.status === "dead" && previousStats.status !== "dead") {
      queueAlert("high", {
        title: `${feedName} is now dead`,
        detail: "No imported articles are available for this feed.",
        type: "error",
        topic: stats.feed.topic || "",
        todayOnly: false,
      }, 0, { isDmvAlert: isDmvFeed });
    } else if (stats.status === "inactive" && previousStats.status !== "inactive") {
      queueAlert("medium", {
        title: `${feedName} is now inactive`,
        detail: "No articles in the last 30 days.",
        type: "warning",
        topic: stats.feed.topic || "",
        todayOnly: false,
      }, 0, { isDmvAlert: isDmvFeed });
    }

    if ((isDmvRssFeed || wasDmvRssFeed) && stats.status === "inactive" && previousStats.status !== "inactive") {
      queueAlert("medium", {
        title: `${feedName} DMV activity stopped`,
        detail: "No DMV RSS articles in the last 30 days.",
        type: "warning",
        topic: stats.feed.topic || "",
        todayOnly: false,
      }, 0, { isDmvAlert: true });
    }
  });

  if (!candidates.length) {
    queueAlert("low", {
      title: "Sources refreshed — no significant changes detected",
      detail: "Article counts and feed status are unchanged since the previous snapshot.",
      type: "info",
    }, 0, { dedupeScope: "system-no-change", isSystemMessage: true });
  }

  const selectedAlerts = [];
  dedupeAlertCandidates(candidates)
    .forEach((candidate) => {
      if (selectedAlerts.length < 5 && shouldShowDashboardAlert(candidate.alert)) {
        selectedAlerts.push(candidate);
      }
    });

  selectedAlerts
    .slice()
    .reverse()
    .forEach(({ alert }) => addDashboardAlert(alert));
}

function syncDashboardAlerts(feeds, articles) {
  if (!SHOW_RECENT_ALERTS && !SHOW_ACTIVITY_LOG) {
    runtime.dashboardAlerts = [];
    runtime.previousSnapshotStats = createSnapshotStats(feeds, articles);
    saveAlertSnapshot(runtime.previousSnapshotStats);
    return;
  }

  const previous = loadStoredAlertSnapshot();
  const current = createSnapshotStats(feeds, articles);

  generateAlerts(previous, current);
  runtime.previousSnapshotStats = current;
  saveAlertSnapshot(current);
}

function buildReviewActivityEntries() {
  const reviewCandidates = getDashboardAnalytics().feedInsights.reviewCandidates || [];

  return reviewCandidates.map((item) => ({
    key: `review|${item.feedId}|${item.reviewLabel}|${item.reviewPriority}|${item.reviewReason}`.toLowerCase(),
    title: `${item.name} — ${item.reviewLabel}`,
    detail: item.reviewReason || "",
    recommendation:
      item.reviewLabel === "Noisy" ? "Consider adding exclusion keywords" : "Review feed quality and recent output",
    priorityLevel: item.reviewPriority || "low",
    type: "recommendation",
    tone: item.reviewPriority === "high" ? "error" : item.reviewPriority === "medium" ? "warning" : "info",
    feedId: item.feedId,
    topic: item.topic || "",
    createdAt: new Date().toISOString(),
  }));
}

function syncActivityLog() {
  if (!SHOW_ACTIVITY_LOG) {
    runtime.activityLog = [];
    return;
  }

  const alertActivityEntries = runtime.dashboardAlerts
    .filter((alert) => !alert.isSystemMessage)
    .map((alert) => ({
      key: `alert|${getAlertDedupeKey(alert)}`,
      title: alert.title,
      detail: alert.detail,
      priorityLevel: alert.priorityLevel || "low",
      type:
        alert.title.includes("active again") || alert.title.includes("started producing")
          ? "status"
          : "alert",
      tone: alert.type || "info",
      topic: alert.topic || "",
      todayOnly: alert.todayOnly === true,
      articleIds: Array.isArray(alert.articleIds) ? alert.articleIds : [],
      createdAt: new Date().toISOString(),
    }));

  persistActivityEntries([...alertActivityEntries, ...buildReviewActivityEntries()]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getDashboardAnalytics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const realArticles = state.articles.filter((article) => !isOfficialFallbackArticle(article));
  const todayArticles = realArticles.filter((article) => toDate(article.pubDate) >= startOfToday);
  const startOfRecentWindow = new Date();
  startOfRecentWindow.setDate(startOfRecentWindow.getDate() - 30);
  startOfRecentWindow.setHours(0, 0, 0, 0);
  const recentArticles = realArticles.filter((article) => toDate(article.pubDate) >= startOfRecentWindow);
  const articleCounts = getFeedArticleCounts(realArticles);
  const todayCounts = getFeedArticleCounts(todayArticles);
  const recentCounts = getFeedArticleCounts(recentArticles);
  const qualityStats = getFeedQualityStats(state.feeds, realArticles);
  const analyticsFeeds = state.feeds.filter(isAnalyticsFeed);
  const scopedAnalyticsFeeds = getAnalyticsFeedsForScope(state.feeds, articleCounts);
  const rankingFeeds = getAnalyticsFeedsForQualityFilter(
    scopedAnalyticsFeeds,
    articleCounts,
    recentCounts,
    qualityStats
  );
  const feedInsightRows = getFeedInsightRows(scopedAnalyticsFeeds, articleCounts, todayCounts, recentCounts, qualityStats);
  const qualityFilterCounts = getAnalyticsQualityFilterCounts(
    scopedAnalyticsFeeds,
    articleCounts,
    recentCounts,
    qualityStats
  );
  const includedFeedCount = scopedAnalyticsFeeds.length;
  const zeroArticleFeeds = scopedAnalyticsFeeds.filter((feed) => (articleCounts.get(feed.id) || 0) === 0).length;
  const highQualityFeeds = scopedAnalyticsFeeds.filter((feed) => {
    const quality = qualityStats.get(feed.id);
    return (articleCounts.get(feed.id) || 0) > 0 && (quality?.qualityScore || 0) >= 0.75;
  }).length;
  const qualityTotal = scopedAnalyticsFeeds.reduce(
    (sum, feed) => sum + (qualityStats.get(feed.id)?.qualityScore || 0),
    0
  );
  const averageQualityScore = includedFeedCount ? Math.round((qualityTotal / includedFeedCount) * 100) : 0;
  const activeFeeds = state.feeds.filter((feed) => feed.isActive !== false).length;
  const errorFeeds = state.feeds.filter(isFeedError).length;
  const rssFeedCount = getRssBackedFeedCount(state.feeds);
  const catalogOnlySources = getNonUsCatalogOnlySources();
  const linkOnlyCount =
    state.feeds.filter((feed) => feed.sourceType === "link-only" || isLinkOnlyDmvSource(feed)).length +
    catalogOnlySources.length;
  const feedCount = state.feeds.length + catalogOnlySources.length || 1;
  const lowValueFeeds = getLowValueFeeds(realArticles);
  const deadFeeds = lowValueFeeds.filter((feed) => feed.status === "dead").length;
  const inactiveFeeds = lowValueFeeds.filter((feed) => feed.status === "inactive").length;
  const lowValueCount = lowValueFeeds.filter((feed) => feed.status === "low-value").length;
  const feedInsights = getFeedInsights(feedInsightRows);
  const hasHighPriorityReviewSignal = feedInsights.reviewCandidates.some((feed) => feed.reviewPriority === "high");
  const systemHealthMessage =
    averageQualityScore > 95 && inactiveFeeds === 0 && deadFeeds === 0 && !hasHighPriorityReviewSignal
      ? "All feeds are performing well"
      : "";

  return {
    feedInsights,
    systemHealthMessage,
    averageArticlesPerFeed: (realArticles.length / feedCount).toFixed(1),
    averageArticlesTodayPerFeed: (todayArticles.length / feedCount).toFixed(1),
    analyticsScope: state.analyticsScope,
    analyticsQualityFilter: state.analyticsQualityFilter,
    qualityFilterCounts,
    rankingFeedCount: rankingFeeds.length,
    analyticsScopeLabel:
      state.analyticsScope === "active"
        ? "Active RSS feeds with article history"
        : "All imported RSS feeds",
    analyticsScopeNote:
      state.analyticsScope === "active"
        ? "Excludes link-only/catalog-only sources, inactive feeds, and zero-article feeds."
        : "Includes active, inactive, and zero-article imported RSS feeds; excludes link-only/catalog-only sources.",
    totalAnalyticsFeeds: analyticsFeeds.length,
    includedFeedCount,
    zeroArticleFeeds,
    highQualityFeeds,
    averageQualityScore,
    activeFeeds,
    inactiveFeeds,
    errorFeeds,
    deadFeeds,
    lowValueCount,
    rssFeedCount,
    linkOnlyCount,
    usaFeeds: getUsDmvCatalogEntries().length,
    canadaRssFeeds: getCanadaImportedDmvFeeds().length,
    canadaLinkOnly: getCanadaCatalogOnlySources().length,
    googleAlertsFeeds: state.feeds.filter(isGoogleAlertsFeed).length,
  };
}

function renderAnalyticsCard() {
  if (!SHOW_FEED_INSIGHTS && !SHOW_RECENT_ALERTS && !SHOW_ACTIVITY_LOG) {
    return null;
  }

  const analytics = getDashboardAnalytics();
  const analyticsPanels = [];

  if (SHOW_FEED_INSIGHTS) {
    analyticsPanels.push(`
      <div class="analytics-panel analytics-panel-wide analytics-panel-ranking">
        <span class="analytics-label">Feed insights</span>
        <p class="analytics-panel-note">${escapeHtml(analytics.analyticsScopeLabel)}</p>
        <p class="analytics-panel-note">Signals combine quality, recent activity, and article history.</p>
        ${analytics.systemHealthMessage ? `<p class="analytics-empty">${escapeHtml(analytics.systemHealthMessage)}</p>` : ""}
        ${renderFeedInsights(analytics.feedInsights)}
      </div>
    `);
  }

  if (SHOW_RECENT_ALERTS) {
    analyticsPanels.push(`
      <div class="analytics-panel analytics-panel-wide analytics-panel-alerts">
        <span class="analytics-label">Recent alerts</span>
        ${renderDashboardAlerts()}
      </div>
    `);
  }

  if (SHOW_ACTIVITY_LOG) {
    analyticsPanels.push(`
      <div class="analytics-panel analytics-panel-wide analytics-panel-activity">
        <span class="analytics-label">Activity log</span>
        <p class="analytics-panel-note">Recent meaningful events and recommended next steps from the last 24 hours.</p>
        ${renderActivityLog()}
      </div>
    `);
  }

  const card = document.createElement("article");
  card.className = "summary-card analytics-card";
  card.innerHTML = `
    <div class="analytics-card-head">
      <span class="summary-label">Feed analytics</span>
      <strong class="summary-value">${analytics.averageArticlesPerFeed}</strong>
      <span class="analytics-note">articles per feed</span>
      <div class="analytics-scope-tabs" aria-label="Feed analytics scope">
        <button class="${analytics.analyticsScope === "all" ? "is-active" : ""}" type="button" data-analytics-scope="all" aria-pressed="${analytics.analyticsScope === "all"}">
          All RSS feeds
        </button>
        <button class="${analytics.analyticsScope === "active" ? "is-active" : ""}" type="button" data-analytics-scope="active" aria-pressed="${analytics.analyticsScope === "active"}">
          Active feeds only
        </button>
      </div>
      <span class="analytics-scope-note">${escapeHtml(analytics.analyticsScopeNote)}</span>
    </div>
    <div class="analytics-grid">
      ${analyticsPanels.join("")}
      <div class="analytics-panel">
        <span class="analytics-label">Analytics scope</span>
        <p>${analytics.includedFeedCount} included of ${analytics.totalAnalyticsFeeds} RSS feeds, ${analytics.zeroArticleFeeds} zero-article, ${analytics.highQualityFeeds} high quality, ${analytics.averageQualityScore}% avg quality</p>
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">Feed health</span>
        <p>${analytics.activeFeeds} active, ${analytics.errorFeeds} errors, ${analytics.deadFeeds} dead, ${analytics.inactiveFeeds} inactive, ${analytics.lowValueCount} low value</p>
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">Source mix</span>
        <p>${analytics.rssFeedCount} RSS-backed, ${analytics.linkOnlyCount} link-only</p>
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">DMV directory</span>
        <p>${analytics.usaFeeds} USA, ${analytics.canadaRssFeeds} Canada RSS, ${analytics.canadaLinkOnly} Canada link-only</p>
      </div>
      <div class="analytics-panel">
        <span class="analytics-label">Google Alerts</span>
        <p>${analytics.googleAlertsFeeds} feeds, ${analytics.averageArticlesTodayPerFeed} articles today/feed</p>
      </div>
    </div>
  `;

  return card;
}

function renderSummary() {
  const metrics = getSummaryMetrics();
  elements.summaryGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const todayFilterActive = state.filters.date === toDateInputValue(new Date());

  SUMMARY_METRICS.forEach((item) => {
    const card = elements.summaryCardTemplate.content.cloneNode(true);
    const summaryCard = card.querySelector(".summary-card");
    card.querySelector(".summary-label").textContent = item.label;
    card.querySelector(".summary-value").textContent = String(metrics[item.key]);

    if (item.key === "articlesToday") {
      summaryCard.classList.add("is-clickable");
      summaryCard.classList.toggle("is-active", todayFilterActive);
      summaryCard.dataset.action = "filter-today";
      summaryCard.setAttribute("role", "button");
      summaryCard.setAttribute("tabindex", "0");
      summaryCard.setAttribute("aria-pressed", String(todayFilterActive));
      summaryCard.setAttribute("aria-label", "Show today's articles");
    }

    fragment.appendChild(card);
  });

  const analyticsCard = renderAnalyticsCard();
  if (analyticsCard) {
    fragment.appendChild(analyticsCard);
  }
  elements.summaryGrid.appendChild(fragment);
}

function applyTodayArticleFilter() {
  const today = toDateInputValue(new Date());
  const nextDate = state.filters.date === today ? "" : today;
  clearExactArticleFilter();
  state.filters.date = nextDate;
  elements.dateFilter.value = nextDate;
  renderSummary();
  scheduleRenderArticles("today-filter");
}

function loadStoredExactArticleFilter() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(ALERT_ARTICLE_FILTER_STORAGE_KEY) || "null");
    if (!stored || !Array.isArray(stored.articleIds)) {
      return null;
    }

    return {
      articleIds: Array.from(new Set(stored.articleIds.filter(Boolean))),
      label: String(stored.label || "").trim(),
    };
  } catch {
    return null;
  }
}

function saveExactArticleFilter(articleIds, label) {
  try {
    window.sessionStorage.setItem(
      ALERT_ARTICLE_FILTER_STORAGE_KEY,
      JSON.stringify({
        articleIds: Array.from(new Set((articleIds || []).filter(Boolean))),
        label: String(label || "").trim(),
      })
    );
  } catch {
    // Session storage is a convenience; the in-memory alert filter still works without it.
  }
}

function clearStoredExactArticleFilter() {
  try {
    window.sessionStorage.removeItem(ALERT_ARTICLE_FILTER_STORAGE_KEY);
  } catch {
    // Ignore storage failures; clearing the in-memory filter is the important part.
  }
}

function clearExactArticleFilter(options = {}) {
  const { clearStorage = true } = options;
  state.filters.articleIds = [];
  state.filters.alertLabel = "";
  if (clearStorage) {
    clearStoredExactArticleFilter();
  }
}

function restoreExactArticleFilterFromSession() {
  const storedFilter = loadStoredExactArticleFilter();
  if (!storedFilter?.articleIds?.length) {
    return;
  }

  const availableArticleIds = new Set(state.articles.map((article) => article.id).filter(Boolean));
  const restoredArticleIds = storedFilter.articleIds.filter((articleId) => availableArticleIds.has(articleId));

  if (!restoredArticleIds.length) {
    clearExactArticleFilter();
    return;
  }

  state.filters.articleIds = restoredArticleIds;
  state.filters.alertLabel = storedFilter.label || `${restoredArticleIds.length} articles`;
  saveExactArticleFilter(restoredArticleIds, state.filters.alertLabel);
}

function applyAlertArticleFilter(alert) {
  const articleIds = Array.isArray(alert?.articleIds) ? alert.articleIds.filter(Boolean) : [];
  if (!articleIds.length) {
    return;
  }

  state.filters.articleIds = Array.from(new Set(articleIds));
  state.filters.alertLabel = alert.title || `${state.filters.articleIds.length} articles`;
  state.filters.search = "";
  state.filters.topic = "";
  state.filters.tag = "";
  state.filters.date = "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  elements.searchFilter.value = "";
  elements.topicFilter.value = state.filters.topic;
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
  elements.dateFilter.value = state.filters.date;
  elements.feedFilter.value = "";
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = "";
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = "";
  }

  saveExactArticleFilter(state.filters.articleIds, state.filters.alertLabel);
  renderDashboard();
}

function applyActivityItemFilter(activityItem) {
  if (!activityItem) {
    return;
  }

  if (Array.isArray(activityItem.articleIds) && activityItem.articleIds.length) {
    applyAlertArticleFilter(activityItem);
    return;
  }

  if (activityItem.feedId) {
    applyAnalyticsFeedFilter({
      feedId: activityItem.feedId,
      todayOnly: activityItem.todayOnly === true,
    });
  }
}

function applyAnalyticsFilter({ topic, todayOnly = false }) {
  const nextTopic = String(topic || "").trim();
  if (!nextTopic) {
    return;
  }

  clearExactArticleFilter();
  state.filters.topic = nextTopic;
  state.filters.tag = "";
  state.filters.date = todayOnly ? toDateInputValue(new Date()) : "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  elements.topicFilter.value = nextTopic;
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
  elements.dateFilter.value = state.filters.date;
  elements.feedFilter.value = "";
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = "";
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = "";
  }

  renderDashboard();
}

function getUsDmvCatalogEntryForFeed(feed) {
  if (!feed) {
    return null;
  }

  return getUsDmvCatalogEntries().find((entry) => getFeedForCatalogEntry(entry)?.id === feed.id) || null;
}

function applyAnalyticsFeedFilter({ feedId, todayOnly = false }) {
  const selectedFeed = state.feeds.find((feed) => feed.id === feedId);
  if (!selectedFeed) {
    return;
  }

  clearExactArticleFilter();
  state.filters.search = "";
  state.filters.topic = "";
  state.filters.tag = "";
  state.filters.date = todayOnly ? toDateInputValue(new Date()) : "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  const feedCountry = getFeedCountry(selectedFeed);
  const isDmvLikeFeed =
    isDmvWrapperFeed(selectedFeed) || Boolean(selectedFeed.dmvAbbr) || feedCountry === "us" || feedCountry === "canada";
  const usDmvEntry = isDmvLikeFeed ? getUsDmvCatalogEntryForFeed(selectedFeed) : null;
  const canadaDmvEntry = isDmvLikeFeed ? getCanadaCatalogEntryForFeed(selectedFeed) : null;

  if (usDmvEntry?.abbr) {
    state.filters.dmvFeedId = usDmvEntry.abbr;
  } else if (canadaDmvEntry?.feedPath) {
    state.filters.canadaDmvFeedPath = canadaDmvEntry.feedPath;
  } else {
    state.filters.feedId = getUniqueFeedIdentity(selectedFeed);
  }

  elements.searchFilter.value = "";
  elements.topicFilter.value = "";
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
  elements.dateFilter.value = state.filters.date;
  elements.feedFilter.value = state.filters.feedId;
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = state.filters.dmvFeedId;
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = state.filters.canadaDmvFeedPath;
  }

  renderDashboard();
}

function applySourceListFeedFilter(feedId) {
  const selectedFeed = state.feeds.find((feed) => feed.id === feedId);
  if (!selectedFeed) {
    return;
  }

  clearExactArticleFilter();
  state.filters.feedId = getUniqueFeedIdentity(selectedFeed);
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.dashboardMode = "normal";

  if (elements.feedFilter) {
    elements.feedFilter.value = state.filters.feedId;
  }
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = "";
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = "";
  }

  renderFeedList();
  renderDmvOfficialLink();
  renderDmvModeIndicator();
  scheduleRenderArticles("source-list-view-feed", { mode: "frame" });
}

function getTodaySummaryCardFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest('[data-action="filter-today"]');
}

function getAnalyticsFeedTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-feed-id]");
}

function getAnalyticsFilterTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-topic]");
}

function getDashboardAlertTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-alert-id]");
}

function getActivityLogTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-activity-id]");
}

function getAnalyticsScopeTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-scope]");
}

function getAnalyticsQualityFilterTargetFromEvent(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  return target?.closest("[data-analytics-quality-filter]");
}

function getSelectedOptionText(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function normalizeFilterTag(tag) {
  const normalized = String(tag || "").trim().toLowerCase().replace(/\s+/g, " ");
  return TAG_ALIASES[normalized] || normalized;
}

function normalizeTagList(tags) {
  return Array.from(new Set((Array.isArray(tags) ? tags : []).map(normalizeFilterTag).filter(Boolean)));
}

function normalizeKeyword(keyword) {
  return String(keyword || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeKeywordList(keywords, fallback = []) {
  const normalized = Array.from(
    new Set((Array.isArray(keywords) ? keywords : []).map(normalizeKeyword).filter(Boolean))
  );
  if (normalized.length) {
    return normalized;
  }
  return Array.from(new Set((Array.isArray(fallback) ? fallback : []).map(normalizeKeyword).filter(Boolean)));
}

function parseKeywordInput(value, fallback = []) {
  return normalizeKeywordList(String(value || "").split(","), fallback);
}

function updateKeywordFilterInputs() {
  if (elements.includeKeywordsInput) {
    elements.includeKeywordsInput.value = state.keywordFilters.include.join(", ");
  }
  if (elements.excludeKeywordsInput) {
    elements.excludeKeywordsInput.value = state.keywordFilters.exclude.join(", ");
  }
}

function saveKeywordFilters() {
  window.localStorage.setItem(KEYWORD_FILTER_STORAGE_KEY, JSON.stringify(state.keywordFilters));
}

function setKeywordFilters({ include = state.keywordFilters.include, exclude = state.keywordFilters.exclude }, persist = true) {
  state.keywordFilters.include = normalizeKeywordList(include, DEFAULT_KEYWORD_INCLUDES);
  state.keywordFilters.exclude = normalizeKeywordList(exclude, DEFAULT_KEYWORD_EXCLUDES);
  if (persist) {
    saveKeywordFilters();
  }
  updateKeywordFilterInputs();
}

function loadKeywordFilters() {
  const storedFilters = window.localStorage.getItem(KEYWORD_FILTER_STORAGE_KEY);
  if (!storedFilters) {
    setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES, exclude: DEFAULT_KEYWORD_EXCLUDES }, false);
    return;
  }

  try {
    const parsedFilters = JSON.parse(storedFilters);
    setKeywordFilters(
      {
        include: parsedFilters?.include,
        exclude: parsedFilters?.exclude,
      },
      false
    );
  } catch (error) {
    console.warn("Unable to load keyword filters; using defaults.", error);
    setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES, exclude: DEFAULT_KEYWORD_EXCLUDES }, false);
  }
}

function resetKeywordFilters() {
  window.localStorage.removeItem(KEYWORD_FILTER_STORAGE_KEY);
  setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES, exclude: DEFAULT_KEYWORD_EXCLUDES }, false);
}

function isNoiseKeywordsExpanded() {
  return window.localStorage.getItem(NOISE_KEYWORDS_EXPANDED_STORAGE_KEY) === "true";
}

function syncNoiseKeywordVisibility() {
  if (!elements.keywordContent || !elements.keywordToggle) {
    return;
  }

  elements.keywordContent.hidden = !state.noiseKeywordsExpanded;
  elements.keywordToggle.setAttribute("aria-expanded", String(state.noiseKeywordsExpanded));
  elements.keywordToggle.textContent = state.noiseKeywordsExpanded ? "Hide ▴" : "Manage ▾";
}

function applyKeywordInputs() {
  setKeywordFilters({
    include: parseKeywordInput(elements.includeKeywordsInput?.value, DEFAULT_KEYWORD_INCLUDES),
    exclude: parseKeywordInput(elements.excludeKeywordsInput?.value, DEFAULT_KEYWORD_EXCLUDES),
  });
  scheduleRenderArticles("keyword-inputs");
}

function keywordListsMatch(left, right) {
  const normalizedLeft = normalizeKeywordList(left);
  const normalizedRight = normalizeKeywordList(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((keyword, index) => keyword === normalizedRight[index])
  );
}

function hasCustomIncludeKeywords() {
  return !keywordListsMatch(state.keywordFilters.include, DEFAULT_KEYWORD_INCLUDES);
}

function hasCustomExcludeKeywords() {
  return !keywordListsMatch(state.keywordFilters.exclude, DEFAULT_KEYWORD_EXCLUDES);
}

function getActiveTags() {
  if (!activeTagsLoaded) {
    activeTags = normalizeTagList(DEFAULT_TAGS);
    activeTagSet = new Set(activeTags);
    activeTagsLoaded = true;
  }
  return activeTags;
}

function getActiveTagSet() {
  getActiveTags();
  return activeTagSet;
}

function saveActiveTags(tags) {
  window.localStorage.setItem(TAG_LIST_STORAGE_KEY, JSON.stringify(tags));
}

function setActiveTags(tags, { persist = true } = {}) {
  activeTags = normalizeTagList(tags);
  activeTagSet = new Set(activeTags);
  activeTagsLoaded = true;
  if (persist) {
    saveActiveTags(activeTags);
  }
}

function loadActiveTags() {
  const storedTags = window.localStorage.getItem(TAG_LIST_STORAGE_KEY);
  if (!storedTags) {
    setActiveTags(DEFAULT_TAGS, { persist: false });
    return;
  }

  try {
    const parsedTags = JSON.parse(storedTags);
    if (!Array.isArray(parsedTags)) {
      setActiveTags(DEFAULT_TAGS, { persist: false });
      return;
    }

    setActiveTags(parsedTags, { persist: false });
  } catch (error) {
    console.warn("Unable to load saved tag list; using defaults.", error);
    setActiveTags(DEFAULT_TAGS, { persist: false });
  }
}

function resetActiveTags() {
  window.localStorage.removeItem(TAG_LIST_STORAGE_KEY);
  setActiveTags(DEFAULT_TAGS, { persist: false });
}

function getArticleTags(article) {
  return Array.from(
    new Set(
      []
        .concat(Array.isArray(article.tags) ? article.tags : [])
        .concat(Array.isArray(article.keywords) ? article.keywords : [])
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
    )
  );
}

function getArticleFilterTags(article) {
  return Array.from(
    new Set(
      getArticleTags(article)
        .map(normalizeFilterTag)
        .filter((tag) => getActiveTagSet().has(tag))
    )
  );
}

function getArticleSearchText(article) {
  return [
    article.title,
    article.source,
    article.topic,
    getFeedName(article.feedId),
    getArticleTags(article).join(" "),
    getArticleFilterTags(article).join(" "),
    article.summary,
    article.summaryShort,
    article.contentSnippet,
  ]
    .join(" ")
    .toLowerCase();
}

function getArticleKeywordText(article) {
  return [
    article.title,
    article.description,
    article.summary,
    article.summaryShort,
    article.contentSnippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getArticleSignalText(article) {
  return getCachedArticleValue(article, "articleSignalText", () =>
    [
      article.title,
      article.description,
      article.summary,
      article.summaryShort,
      article.contentSnippet,
      article.source,
      article.topic,
      getArticleTags(article).join(" "),
      getArticleFilterTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  );
}

function getArticleTopicClassifierText(article) {
  return getCachedArticleValue(article, "articleTopicClassifierText", () =>
    [
      article?.title,
      article?.description,
      article?.summary,
      article?.summaryShort,
      article?.contentSnippet,
      article?.source,
      article?.topic,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  );
}

function getArticleTopicType(article) {
  if (article?.topicType) {
    return String(article.topicType);
  }

  const text = getArticleTopicClassifierText(article);
  if (!text) {
    return "noise";
  }

  const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

  if (hasAny(ARTICLE_TOPIC_TYPE_NOISE_KEYWORDS)) {
    return "noise";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_BANKNOTE_KEYWORDS)) {
    return "banknote";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_DRIVER_LICENSE_KEYWORDS)) {
    return "dmv_driver_license";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_DIGITAL_IDENTITY_KEYWORDS)) {
    return "digital_identity";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_IDENTITY_DOCUMENT_KEYWORDS)) {
    return "identity_document";
  }

  if (hasAny(ARTICLE_TOPIC_TYPE_TRAVEL_PASSPORT_KEYWORDS)) {
    return "travel_passport";
  }

  return "noise";
}

function getArticleCardTopic(article) {
  const storedTopic = article?.topic || "General";
  const strongBanknoteSignals = getStrongBanknoteDomainSignalAssessment(article);

  if (
    strongBanknoteSignals.matched &&
    !strongBanknoteSignals.concreteIdentityMatches.length
  ) {
    return "Banknotes";
  }

  return storedTopic;
}

function getPassportEventType(article) {
  return getCachedArticleValue(article, "passportEventType", () => {
    const text = getArticleTopicClassifierText(article);
    if (!text) {
      return "passport_noise";
    }

    const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

    if (isPassportNoiseArticle(article) || hasAny(PASSPORT_EVENT_TYPE_RULES.passport_noise)) {
      return "passport_noise";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_ranking)) {
      return "passport_ranking";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.ees_border_control)) {
      return "ees_border_control";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_fraud)) {
      return "passport_fraud";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_processing)) {
      return "passport_processing";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_regulation)) {
      return "passport_regulation";
    }

    if (hasAny(PASSPORT_EVENT_TYPE_RULES.passport_design)) {
      return "passport_design";
    }

    if (
      [
        "passport",
        "passports",
        "biometric passport",
        "e-passport",
        "epassport",
        "state department passport",
      ].some((keyword) => textMatchesKeyword(text, keyword))
    ) {
      return isRealTravelDocumentArticle(article) ? "travel_passport_other" : "passport_noise";
    }

    return "passport_noise";
  });
}

function isPassportNoiseArticle(article) {
  return getCachedArticleValue(article, "passportNoiseArticle", () => {
    const text = getArticleTopicClassifierText(article);
    if (!text) {
      return true;
    }

    return normalizeKeywordList(PASSPORT_HARD_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  });
}

function isHardPassportNoise(article) {
  return getCachedArticleValue(article, "hardPassportNoise", () => {
    const text = [
      article?.title,
      article?.description,
      article?.summary,
      article?.source,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!text) {
      return false;
    }

    return normalizeKeywordList(PASSPORT_HARD_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  });
}

function getGovernmentDocumentConfidence(article) {
  return getCachedArticleValue(article, "governmentDocumentConfidence", () => {
    const text = [
      article?.title,
      article?.description,
      article?.summary,
      article?.source,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!text) {
      return 0;
    }

    let score = 0;
    GOVERNMENT_DOCUMENT_POSITIVE_SIGNALS.forEach(([keyword, value]) => {
      if (textMatchesKeyword(text, keyword)) {
        score += value;
      }
    });
    GOVERNMENT_DOCUMENT_NEGATIVE_SIGNALS.forEach(([keyword, value]) => {
      if (textMatchesKeyword(text, keyword)) {
        score += value;
      }
    });

    return score;
  });
}

function getIdentityDocumentContextText(article) {
  return getCachedArticleValue(article, "identityDocumentContextText", () =>
    [
      article?.title,
      article?.description,
      article?.summary,
      article?.source,
      article?.topic,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  );
}

function isPassportOrIdentityTopicArticle(article) {
  return getCachedArticleValue(article, "isPassportOrIdentityTopicArticle", () => {
    const topicText = [
      article?.title,
      article?.topic,
      article?.topicType,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return [
      article?.topicType === "travel_passport",
      article?.topicType === "identity_document",
      article?.topicType === "digital_identity",
      textMatchesKeyword(topicText, "passport"),
      textMatchesKeyword(topicText, "passports"),
      textMatchesKeyword(topicText, "identity document"),
      textMatchesKeyword(topicText, "identity documents"),
      textMatchesKeyword(topicText, "travel document"),
    ].some(Boolean);
  });
}

function getPrimaryPassportSubject(article) {
  return getCachedArticleValue(article, "primaryPassportSubject", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const descriptionText = String(article?.description || article?.summary || "").toLowerCase();
    const firstSentenceText = String(descriptionText.split(/(?<=[.!?])\s+/)[0] || descriptionText).toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const tagsText = getArticleTags(article).join(" ").toLowerCase();
    const bodyText = [descriptionText, tagsText].filter(Boolean).join(" ");

    const weights = {
      title: 4,
      firstSentence: 2,
      body: 1,
      source: 2,
    };

    const scores = Object.fromEntries(
      Object.keys(PRIMARY_PASSPORT_SUBJECT_RULES).map((subject) => [subject, 0])
    );

    Object.entries(PRIMARY_PASSPORT_SUBJECT_RULES).forEach(([subject, keywords]) => {
      normalizeKeywordList(keywords).forEach((keyword) => {
        if (textMatchesKeyword(titleText, keyword)) {
          scores[subject] += weights.title;
        }
        if (textMatchesKeyword(firstSentenceText, keyword)) {
          scores[subject] += weights.firstSentence;
        }
        if (textMatchesKeyword(bodyText, keyword)) {
          scores[subject] += weights.body;
        }
        if (textMatchesKeyword(sourceText, keyword)) {
          scores[subject] += weights.source;
        }
      });
    });

    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_POSITIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        scores.identity_infrastructure += 2;
        scores.passport_regulation += 1;
      }
    });
    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_NEGATIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        scores.unrelated += 3;
      }
    });

    const sortedSubjects = Object.entries(scores).sort((left, right) => right[1] - left[1]);
    const [primarySubject, primaryScore] = sortedSubjects[0] || ["unrelated", 0];
    const unrelatedScore = scores.unrelated || 0;

    if (!primaryScore || primarySubject === "unrelated" || unrelatedScore >= primaryScore) {
      return "unrelated";
    }

    return primarySubject;
  });
}

function getIdentityContextSignals(article) {
  return getCachedArticleValue(article, "identityContextSignals", () => {
    const text = getIdentityDocumentContextText(article);
    const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

    return {
      government: hasAny(IDENTITY_CONTEXT_KEYWORDS.government),
      border: hasAny(IDENTITY_CONTEXT_KEYWORDS.border),
      immigration: hasAny(IDENTITY_CONTEXT_KEYWORDS.immigration),
      fraud: hasAny(IDENTITY_CONTEXT_KEYWORDS.fraud),
      security: hasAny(IDENTITY_CONTEXT_KEYWORDS.security),
      issuance: hasAny(IDENTITY_CONTEXT_KEYWORDS.issuance),
      infrastructure: hasAny(IDENTITY_CONTEXT_KEYWORDS.infrastructure),
      travelRule: hasAny(IDENTITY_CONTEXT_KEYWORDS.travelRule),
      unrelatedLifestyle: hasAny(IDENTITY_CONTEXT_KEYWORDS.unrelatedLifestyle),
      sports: hasAny(IDENTITY_CONTEXT_KEYWORDS.sports),
      pets: hasAny(IDENTITY_CONTEXT_KEYWORDS.pets),
      entertainment: hasAny(IDENTITY_CONTEXT_KEYWORDS.entertainment),
      education: hasAny(IDENTITY_CONTEXT_KEYWORDS.education),
      genericTravel: hasAny(IDENTITY_CONTEXT_KEYWORDS.genericTravel),
    };
  });
}

function getIdentityDocumentRelevance(article) {
  return getCachedArticleValue(article, "identityDocumentRelevance", () => {
    const text = getIdentityDocumentContextText(article);

    if (!text) {
      return 0;
    }

    const context = getIdentityContextSignals(article);
    let score = 0;
    normalizeKeywordList(IDENTITY_DOCUMENT_HIGH_RELEVANCE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(text, keyword)) {
        score += 5;
      }
    });
    normalizeKeywordList(IDENTITY_DOCUMENT_MEDIUM_RELEVANCE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(text, keyword)) {
        score += 2;
      }
    });
    normalizeKeywordList(IDENTITY_DOCUMENT_NEGATIVE_RELEVANCE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(text, keyword)) {
        score -= 8;
      }
    });
    if (context.government) {
      score += 6;
    }
    if (context.border) {
      score += 6;
    }
    if (context.immigration) {
      score += 6;
    }
    if (context.fraud) {
      score += 6;
    }
    if (context.security) {
      score += 5;
    }
    if (context.issuance) {
      score += 5;
    }
    if (context.infrastructure) {
      score += 5;
    }
    if (context.travelRule) {
      score += 4;
    }
    if (context.unrelatedLifestyle) {
      score -= 10;
    }
    if (context.sports) {
      score -= 10;
    }
    if (context.pets) {
      score -= 10;
    }
    if (context.entertainment) {
      score -= 8;
    }
    if (context.education) {
      score -= 8;
    }
    if (context.genericTravel) {
      score -= 8;
    }

    return score;
  });
}

function getHighConfidencePassportAssessment(article) {
  return getCachedArticleValue(article, "highConfidencePassportAssessment", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const subtitleText = String(article?.summary || "").toLowerCase();
    const descriptionText = String(article?.description || "").toLowerCase();
    const firstSentenceText = String((article?.description || article?.summary || "").split(/(?<=[.!?])\s+/)[0] || "").toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const combinedText = getIdentityDocumentContextText(article);
    const primarySubject = getPrimaryPassportSubject(article);
    const context = getIdentityContextSignals(article);
    let score = getIdentityDocumentRelevance(article);

    normalizeKeywordList(HIGH_CONFIDENCE_PASSPORT_POSITIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(titleText, keyword)) {
        score += 6;
      }
      if (textMatchesKeyword(subtitleText, keyword)) {
        score += 4;
      }
      if (textMatchesKeyword(firstSentenceText, keyword)) {
        score += 3;
      }
      if (textMatchesKeyword(descriptionText, keyword)) {
        score += 1;
      }
    });

    normalizeKeywordList(HIGH_CONFIDENCE_PASSPORT_NEGATIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(titleText, keyword)) {
        score -= 8;
      }
      if (textMatchesKeyword(subtitleText, keyword)) {
        score -= 6;
      }
      if (textMatchesKeyword(firstSentenceText, keyword)) {
        score -= 5;
      }
      if (textMatchesKeyword(descriptionText, keyword)) {
        score -= 2;
      }
    });

    if (context.government || context.border || context.immigration || context.fraud || context.security || context.infrastructure) {
      score += 5;
    }
    if (primarySubject !== "unrelated") {
      score += 6;
    } else {
      score -= 12;
    }

    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_POSITIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        score += 4;
      }
    });
    normalizeKeywordList(PRIMARY_PASSPORT_SOURCE_NEGATIVE_SIGNALS).forEach((keyword) => {
      if (textMatchesKeyword(sourceText, keyword)) {
        score -= 5;
      }
    });

    const hasCentralSignal = normalizeKeywordList(HIGH_CONFIDENCE_PASSPORT_POSITIVE_SIGNALS).some((keyword) =>
      textMatchesKeyword(titleText, keyword)
      || textMatchesKeyword(subtitleText, keyword)
      || textMatchesKeyword(firstSentenceText, keyword)
      || textMatchesKeyword(sourceText, keyword)
    ) || (
      primarySubject !== "unrelated"
      && [
        "passport",
        "passports",
        "travel document",
        "identity card",
        "digital id",
        "eid",
        "immigration",
        "visa",
        "border",
      ].some((keyword) => textMatchesKeyword(titleText, keyword) || textMatchesKeyword(combinedText, keyword))
    );

    let rejectedReason = "";
    if (!hasCentralSignal) {
      rejectedReason = "no central identity signal";
    } else if (primarySubject === "unrelated") {
      rejectedReason = "primary subject unrelated";
    } else if (score < HIGH_CONFIDENCE_PASSPORT_THRESHOLD) {
      rejectedReason = "below high-confidence threshold";
    }

    return {
      score,
      primarySubject,
      kept: hasCentralSignal && primarySubject !== "unrelated" && score >= HIGH_CONFIDENCE_PASSPORT_THRESHOLD,
      rejectedReason,
    };
  });
}

function isHighConfidencePassportIntelligence(article) {
  return getHighConfidencePassportAssessment(article).kept;
}

function getKeesingIdentityRelevance(article) {
  return getCachedArticleValue(article, "keesingIdentityRelevance", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const subtitleText = String(article?.summary || "").toLowerCase();
    const descriptionText = String(article?.description || "").toLowerCase();
    const firstSentenceText = String((article?.description || article?.summary || "").split(/(?<=[.!?])\s+/)[0] || "").toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const combinedText = getIdentityDocumentContextText(article);
    const primarySubject = getPrimaryPassportSubject(article);
    const context = getIdentityContextSignals(article);

    let score = 0;
    const applyWeightedSignals = (keywords, weights) => {
      normalizeKeywordList(keywords).forEach((keyword) => {
        if (textMatchesKeyword(titleText, keyword)) {
          score += weights.title;
        }
        if (textMatchesKeyword(subtitleText, keyword)) {
          score += weights.subtitle;
        }
        if (textMatchesKeyword(firstSentenceText, keyword)) {
          score += weights.firstSentence;
        }
        if (textMatchesKeyword(descriptionText, keyword)) {
          score += weights.description;
        }
        if (textMatchesKeyword(sourceText, keyword)) {
          score += weights.source;
        }
      });
    };

    Object.values(KEESING_POSITIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: 6,
        subtitle: 4,
        firstSentence: 3,
        description: 1,
        source: 3,
      });
    });
    Object.values(KEESING_NEGATIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: -8,
        subtitle: -6,
        firstSentence: -5,
        description: -2,
        source: -4,
      });
    });
    normalizeKeywordList(KEESING_HARD_KEEP_SIGNALS).forEach((keyword) => {
      if (
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
        || textMatchesKeyword(sourceText, keyword)
      ) {
        score += 10;
      }
    });

    const hasRequiredComponent = normalizeKeywordList(KEESING_REQUIRED_COMPONENT_SIGNALS).some((keyword) =>
      textMatchesKeyword(titleText, keyword)
      || textMatchesKeyword(subtitleText, keyword)
      || textMatchesKeyword(firstSentenceText, keyword)
      || textMatchesKeyword(combinedText, keyword)
      || textMatchesKeyword(sourceText, keyword)
    );

    if (primarySubject !== "unrelated") {
      score += 6;
    } else {
      score -= 10;
    }

    if (
      context.government
      || context.border
      || context.immigration
      || context.fraud
      || context.security
      || context.issuance
      || context.infrastructure
      || context.travelRule
      || getGovernmentDocumentConfidence(article) >= 3
    ) {
      score += 4;
    }

    if (!hasRequiredComponent) {
      score -= 12;
    }

    return {
      score,
      primarySubject,
      hasRequiredComponent,
    };
  });
}

function isBanknoteTopicArticle(article) {
  return getCachedArticleValue(article, "isBanknoteTopicArticle", () => {
    const topicText = [
      article?.title,
      article?.topic,
      article?.topicType,
      getArticleTags(article).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return [
      article?.topicType === "banknote",
      textMatchesKeyword(topicText, "banknote"),
      textMatchesKeyword(topicText, "banknotes"),
      textMatchesKeyword(topicText, "currency note"),
      textMatchesKeyword(topicText, "paper money"),
    ].some(Boolean);
  });
}

function getBanknoteIntelligenceRelevance(article) {
  return getCachedArticleValue(article, "banknoteIntelligenceRelevance", () => {
    const titleText = String(article?.title || "").toLowerCase();
    const subtitleText = String(article?.summary || "").toLowerCase();
    const descriptionText = String(article?.description || "").toLowerCase();
    const firstSentenceText = String((article?.description || article?.summary || "").split(/(?<=[.!?])\s+/)[0] || "").toLowerCase();
    const sourceText = String(article?.source || "").toLowerCase();
    const combinedText = getArticleSignalText(article);
    const eventType = getBanknoteEventType(article);
    const noiseAssessment = getBanknoteNoiseAssessment(article);

    let score = 0;
    const applyWeightedSignals = (keywords, weights) => {
      normalizeKeywordList(keywords).forEach((keyword) => {
        if (textMatchesKeyword(titleText, keyword)) {
          score += weights.title;
        }
        if (textMatchesKeyword(subtitleText, keyword)) {
          score += weights.subtitle;
        }
        if (textMatchesKeyword(firstSentenceText, keyword)) {
          score += weights.firstSentence;
        }
        if (textMatchesKeyword(descriptionText, keyword)) {
          score += weights.description;
        }
        if (textMatchesKeyword(sourceText, keyword)) {
          score += weights.source;
        }
      });
    };

    Object.values(BANKNOTE_INTELLIGENCE_POSITIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: 6,
        subtitle: 4,
        firstSentence: 3,
        description: 1,
        source: 3,
      });
    });
    Object.values(BANKNOTE_INTELLIGENCE_NEGATIVE_SIGNALS).forEach((keywords) => {
      applyWeightedSignals(keywords, {
        title: -8,
        subtitle: -6,
        firstSentence: -5,
        description: -2,
        source: -4,
      });
    });
    normalizeKeywordList(BANKNOTE_INTELLIGENCE_HARD_KEEP_SIGNALS).forEach((keyword) => {
      if (
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
        || textMatchesKeyword(sourceText, keyword)
      ) {
        score += 10;
      }
    });
    normalizeKeywordList(BANKNOTE_INTELLIGENCE_HARD_REJECT_SIGNALS).forEach((keyword) => {
      if (
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
        || textMatchesKeyword(sourceText, keyword)
      ) {
        score -= 12;
      }
    });

    const hasRequiredComponent = normalizeKeywordList(BANKNOTE_REQUIRED_COMPONENT_SIGNALS).some((keyword) =>
      textMatchesKeyword(titleText, keyword)
      || textMatchesKeyword(subtitleText, keyword)
      || textMatchesKeyword(firstSentenceText, keyword)
      || textMatchesKeyword(combinedText, keyword)
      || textMatchesKeyword(sourceText, keyword)
    );

    const isSignatureOnly = (
      eventType === "banknote_signature_change"
      || normalizeKeywordList(BANKNOTE_SIGNATURE_ONLY_SIGNALS).some((keyword) =>
        textMatchesKeyword(titleText, keyword)
        || textMatchesKeyword(subtitleText, keyword)
        || textMatchesKeyword(firstSentenceText, keyword)
        || textMatchesKeyword(descriptionText, keyword)
      )
      || BANKNOTE_LOW_PRIORITY_CODE_PATTERN.test(combinedText)
    );

    if (eventType === "banknote_withdrawal" || eventType === "counterfeit_banknotes") {
      score += 10;
    } else if (eventType === "banknote_new_design" || eventType === "banknote_new_series" || eventType === "polymer_transition") {
      score += 8;
    } else if (eventType === "banknote_auction_noise") {
      score -= 14;
    } else if (eventType === "commemorative_note") {
      score -= 4;
    }

    if (isSignatureOnly) {
      score -= 10;
    }

    if (!hasRequiredComponent) {
      score -= 12;
    }

    score += Math.min(20, Math.round(noiseAssessment.positiveHits * 0.2));
    score -= Math.min(40, Math.round(noiseAssessment.totalNoiseHits * 0.35));
    if (noiseAssessment.weakTrumpDebate) {
      score -= 24;
    }
    if (noiseAssessment.contaminated) {
      score -= 36;
    }

    let rejectedReason = "";
    if (!hasRequiredComponent) {
      rejectedReason = "missing central-bank/document component";
    } else if (noiseAssessment.contaminated) {
      rejectedReason = "collector/social/market noise";
    } else if (noiseAssessment.weakTrumpDebate) {
      rejectedReason = "non-official political banknote debate";
    } else if (eventType === "banknote_auction_noise") {
      rejectedReason = "collector or auction noise";
    } else if (isSignatureOnly && score < BANKNOTE_RELEVANCE_THRESHOLD) {
      rejectedReason = "signature/date-only update";
    } else if (score < BANKNOTE_RELEVANCE_THRESHOLD) {
      rejectedReason = "below banknote relevance threshold";
    }

    return {
      score,
      eventType,
      hasRequiredComponent,
      kept: hasRequiredComponent && score >= BANKNOTE_RELEVANCE_THRESHOLD,
      rejectedReason,
    };
  });
}

function isPrimaryPassportIntelligence(article) {
  const titleText = String(article?.title || "").toLowerCase();
  const combinedText = getIdentityDocumentContextText(article);
  const primarySubject = getPrimaryPassportSubject(article);
  const hasCentralIdentityTopic = [
    "passport",
    "passports",
    "travel document",
    "identity",
    "visa",
    "immigration",
    "border",
    "etias",
    "ees",
    "digital id",
    "eid",
    "icao",
  ].some((keyword) => textMatchesKeyword(titleText, keyword) || textMatchesKeyword(combinedText, keyword));

  if (!hasCentralIdentityTopic) {
    return false;
  }

  return primarySubject !== "unrelated";
}

function shouldRejectPassportArticle(article) {
  if (!isPassportOrIdentityTopicArticle(article)) {
    return false;
  }

  if (!isHighConfidencePassportIntelligence(article)) {
    return true;
  }

  const keesingAssessment = getKeesingIdentityRelevance(article);
  if (!keesingAssessment.hasRequiredComponent) {
    return true;
  }
  if (keesingAssessment.primarySubject === "unrelated") {
    return true;
  }
  if (keesingAssessment.score < KEESING_RELEVANCE_THRESHOLD) {
    return true;
  }

  const context = getIdentityContextSignals(article);
  const hasStrongPositiveContext = context.government
    || context.border
    || context.immigration
    || context.fraud
    || context.security
    || context.issuance
    || context.infrastructure
    || context.travelRule;

  if (hasStrongPositiveContext) {
    return false;
  }

  const negativeContextCount = [
    context.unrelatedLifestyle,
    context.sports,
    context.pets,
    context.entertainment,
    context.education,
    context.genericTravel,
  ].filter(Boolean).length;

  return negativeContextCount > 0 && getIdentityDocumentRelevance(article) < IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD;
}

function isLowRelevancePassportArticle(article) {
  const topicText = [
    article?.topic,
    article?.topicType,
    getArticleTags(article).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasPassportTopic = article?.topicType === "travel_passport"
    || textMatchesKeyword(topicText, "passport")
    || textMatchesKeyword(topicText, "passports");

  if (!hasPassportTopic) {
    return false;
  }

  return shouldRejectPassportArticle(article)
    || getIdentityDocumentRelevance(article) < IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD;
}

function isRealTravelDocumentArticle(article) {
  return getCachedArticleValue(article, "realTravelDocumentArticle", () => {
    const text = getArticleTopicClassifierText(article);
    if (!text) {
      return false;
    }

    if (isPassportNoiseArticle(article) || isHardPassportNoise(article) || shouldRejectPassportArticle(article)) {
      return false;
    }

    return normalizeKeywordList(REAL_TRAVEL_DOCUMENT_POSITIVE_SIGNALS).some((keyword) => textMatchesKeyword(text, keyword))
      || getGovernmentDocumentConfidence(article) >= 3;
  });
}

function normalizeLoadedArticle(article) {
  const trimmedArticle = {
    id: article?.id || "",
    title: article?.title || "",
    normalizedTitle: article?.normalizedTitle || "",
    link: article?.link || "",
    canonicalLink: article?.canonicalLink || article?.link || "",
    pubDate: article?.pubDate || "",
    source: article?.source || "",
    sourceName: article?.sourceName || article?.source || "",
    feedTitle: article?.feedTitle || "",
    feedId: article?.feedId || "",
    feedUrl: article?.feedUrl || article?.rssUrl || "",
    sourceId: article?.sourceId || "",
    topic: article?.topic || "",
    thumbnail: article?.thumbnail || "",
    summary: article?.summary || "",
    summaryShort: article?.summaryShort || "",
    contentSnippet: article?.contentSnippet || "",
    author: article?.author || "",
    tags: Array.isArray(article?.tags) ? article.tags : [],
    keywords: Array.isArray(article?.keywords) ? article.keywords : [],
    clusterId: article?.clusterId || null,
    duplicateGroupId: article?.duplicateGroupId || null,
    isDuplicate: article?.isDuplicate === true,
    duplicateOf: article?.duplicateOf || null,
    language: article?.language || "unknown",
    fetchStatus: article?.fetchStatus || "pending",
    createdAt: article?.createdAt || "",
    updatedAt: article?.updatedAt || "",
  };
  const topicType = getArticleTopicType(trimmedArticle);
  const normalizedArticle = {
    ...trimmedArticle,
    topicType,
    eventType: getArticleEventTypeForTopic(trimmedArticle, topicType),
  };
  primeArticleIntelligence(normalizedArticle);
  return normalizedArticle;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function intelligenceDebug(...args) {
  if (DEBUG_INTELLIGENCE) {
    console.debug(...args);
  }
}

function intelligenceLog(...args) {
  if (DEBUG_INTELLIGENCE) {
    console.log(...args);
  }
}

function intelligenceTime(label) {
  if (DEBUG_INTELLIGENCE) {
    console.time(label);
  }
}

function intelligenceTimeEnd(label) {
  if (DEBUG_INTELLIGENCE) {
    console.timeEnd(label);
  }
}

function getArticleStableCacheKey(article) {
  return String(
    article?.id
      || article?.url
      || `${article?.title || "untitled"}|${article?.pubDate || ""}|${article?.feedId || ""}`
  );
}

function getCachedArticleValue(article, cacheKey, computeValue) {
  const articleKey = getArticleStableCacheKey(article);
  let articleCache = runtime.articleComputationCache.get(articleKey);
  if (!articleCache) {
    articleCache = new Map();
    runtime.articleComputationCache.set(articleKey, articleCache);
  }

  if (articleCache.has(cacheKey)) {
    return articleCache.get(cacheKey);
  }

  const value = computeValue();
  articleCache.set(cacheKey, value);
  return value;
}

function getCachedArticlePairValue(leftArticle, rightArticle, cacheKey, computeValue) {
  const leftKey = getArticleStableCacheKey(leftArticle);
  const rightKey = getArticleStableCacheKey(rightArticle);
  const pairKey = [leftKey, rightKey].sort().join("::");
  let pairCache = runtime.articlePairComputationCache.get(pairKey);
  if (!pairCache) {
    pairCache = new Map();
    runtime.articlePairComputationCache.set(pairKey, pairCache);
  }

  if (pairCache.has(cacheKey)) {
    return pairCache.get(cacheKey);
  }

  const value = computeValue();
  pairCache.set(cacheKey, value);
  return value;
}

function primeArticleIntelligence(article) {
  if (!article || article._intelligence) {
    return article?._intelligence || null;
  }

  try {
    const intelligence = {
      cacheKey: getArticleStableCacheKey(article),
      topicType: getArticleTopicType(article),
      eventType: String(article?.eventType || ""),
      normalizedEvent: normalizeIntelligenceEvent(article),
      canonicalEventClusterKey: getCanonicalEventClusterKey(article),
      detectedEventEntity: getDetectedEventEntity(article),
      eventFingerprint: extractEventFingerprint(article),
      identityDocumentRelevance: getIdentityDocumentRelevance(article),
      highConfidencePassportAssessment: getHighConfidencePassportAssessment(article),
      keesingIdentityRelevance: getKeesingIdentityRelevance(article),
      banknoteIntelligenceRelevance: getBanknoteIntelligenceRelevance(article),
      governmentDocumentConfidence: getGovernmentDocumentConfidence(article),
      passportNoiseArticle: isPassportNoiseArticle(article),
      realTravelDocumentArticle: isRealTravelDocumentArticle(article),
    };

    article._intelligence = intelligence;
    return intelligence;
  } catch (error) {
    article._intelligence = {
      cacheKey: getArticleStableCacheKey(article),
      bootstrapError: error instanceof Error ? error.message : String(error),
    };
    intelligenceDebug("[intelligence-prime-failed]", {
      title: article?.title || "Untitled article",
      message: article._intelligence.bootstrapError,
    });
    return article._intelligence;
  }
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

function getTopicKeywordRuleKey(value) {
  const normalizedValue = normalizeFilterTag(value);
  return TOPIC_KEYWORD_RULE_ALIASES[normalizedValue] || normalizedValue;
}

function getTopicKeywordRule(value) {
  return TOPIC_KEYWORD_RULES[getTopicKeywordRuleKey(value)] || null;
}

function getActiveTopicKeywordRule() {
  return getTopicKeywordRule(state.filters.tag) || getTopicKeywordRule(state.filters.topic);
}

function getSignalCategoryById(signalCategoryId) {
  return SIGNAL_CATEGORY_BY_ID.get(String(signalCategoryId || "").trim()) || null;
}

function countMatchedKeywords(text, keywords = []) {
  return normalizeKeywordList(keywords).filter((keyword) => textMatchesKeyword(text, keyword)).length;
}

function hasSignalCoreObject(text) {
  return normalizeKeywordList(SIGNAL_CORE_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasSignalNoiseContext(text) {
  return normalizeKeywordList(SIGNAL_NOISE_CONTEXT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function isRelevantSignalText(text) {
  const hasNoiseKeyword = normalizeKeywordList(SIGNAL_RELEVANCE_NOISE_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (hasNoiseKeyword) {
    return false;
  }

  const hasIdObject = normalizeKeywordList(ID_SIGNAL_OBJECT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (hasIdObject) {
    const hasIdNoise = normalizeKeywordList(ID_SIGNAL_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
    if (hasIdNoise) {
      return false;
    }

    return isAllowedIdentityIntent(text);
  }

  if (hasBanknoteSignalObject(text) && (hasBanknoteHighPrioritySignal(text) || hasBanknoteLowPrioritySignal(text))) {
    return true;
  }

  const hasStrictIncludeKeyword = normalizeKeywordList(SIGNAL_STRICT_INCLUDE_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (hasStrictIncludeKeyword) {
    return true;
  }

  const hasReleaseVariantKeyword = normalizeKeywordList(SIGNAL_RELEASE_VARIANT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
  if (!hasReleaseVariantKeyword) {
    return false;
  }

  return normalizeKeywordList(SIGNAL_RELEASE_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function isWeakIdentityIntent(text) {
  return normalizeKeywordList(ID_SIGNAL_WEAK_INTENT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isValidIdentityContext(text) {
  return normalizeKeywordList(ID_SIGNAL_VALID_CONTEXT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isNoiseContext(text) {
  return normalizeKeywordList(ID_SIGNAL_NOISE_CONTEXT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isIdentitySystemEvent(text) {
  return normalizeKeywordList(ID_SIGNAL_SYSTEM_EVENT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isNonSystemIdentityNoise(text) {
  return normalizeKeywordList(ID_SIGNAL_NON_SYSTEM_NOISE_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function hasIdentitySystemImpact(text) {
  return normalizeKeywordList(ID_SIGNAL_SYSTEM_IMPACT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isNonImpactIdentityContent(text) {
  return normalizeKeywordList(ID_SIGNAL_NON_IMPACT_KEYWORDS).some((keyword) =>
    textMatchesKeyword(text, keyword)
  );
}

function isStrongIdentityIntent(text) {
  return normalizeKeywordList(ID_SIGNAL_HIGH_INTENT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasIdentityOverrideSignal(text) {
  return normalizeKeywordList(ID_SIGNAL_OVERRIDE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function isAllowedIdentityIntent(text) {
  if (isWeakIdentityIntent(text) && !hasIdentityOverrideSignal(text)) {
    return false;
  }

  return isStrongIdentityIntent(text);
}

function hasBanknoteSignalObject(text) {
  return normalizeKeywordList(BANKNOTE_SIGNAL_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasBanknoteHighPrioritySignal(text) {
  return normalizeKeywordList(BANKNOTE_HIGH_PRIORITY_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
}

function hasBanknoteLowPrioritySignal(text) {
  return normalizeKeywordList(BANKNOTE_LOW_PRIORITY_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword))
    || BANKNOTE_LOW_PRIORITY_CODE_PATTERN.test(text);
}

function getBanknoteSignalMatches(text) {
  if (!hasBanknoteSignalObject(text)) {
    return [];
  }

  const matches = [];
  const pushMatch = (id, confidence) => {
    const existing = matches.find((match) => match.id === id);
    if (!existing) {
      matches.push({ id, confidence });
      return;
    }

    if (existing.confidence !== "high" && confidence === "high") {
      existing.confidence = "high";
    }
  };
  const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));

  const hasHighPriorityBanknoteSignal = hasBanknoteHighPrioritySignal(text);
  const hasLowPriorityBanknoteSignal = hasBanknoteLowPrioritySignal(text);

  if (hasAny([
    "counterfeit banknotes",
    "counterfeit notes",
    "fake banknote",
    "fake notes",
    "forged notes",
    "seizure",
    "police warning",
    "counterfeit alert",
  ])) {
    pushMatch("counterfeit", "high");
    pushMatch("fraud", "high");
  }

  if (hasAny(["law", "regulation", "regulations", "legislation", "mandate", "policy", "directive"])) {
    pushMatch("regulations", "high");
  }

  if (hasAny([
    "withdraw",
    "withdrawn",
    "withdrawal",
    "demonetised",
    "demonetized",
    "demonetisation",
    "demonetization",
    "out of circulation",
    "cease legal tender",
    "no longer legal tender",
    "legal tender until",
    "exchange deadline",
  ])) {
    pushMatch("withdrawal", "high");
    pushMatch("regulations", "high");
  }

  if (hasAny(["commemorative", "anniversary note", "centennial", "honouring", "honoring"])) {
    pushMatch("commemorative", "high");
    pushMatch("new-releases", "low");
  }

  if (hasAny(["banknote series", "new series", "new banknote family", "rolled out", "rollout", "launch"])) {
    pushMatch("rollout", "high");
    pushMatch("new-releases", "high");
  }

  if (hasAny(["redesigned", "redesign", "new design", "new banknote design"])) {
    pushMatch("redesign", "high");
    pushMatch("design-changes", "high");
  }

  if (hasAny([
    "security feature",
    "security features",
    "hologram",
    "windowed thread",
    "security thread",
    "polymer",
    "upgraded banknote",
    "enhanced security",
    "counterfeit prevention",
    "anti-counterfeit",
  ])) {
    pushMatch("security-features", "high");
  }

  if (hasAny(["polymer", "polymer substrate", "substrate migration", "polymer transition", "plastic banknote"])) {
    pushMatch("polymer", "high");
    pushMatch("redesign", hasAny(["substrate migration", "polymer transition"]) ? "high" : "low");
  }

  if (!hasHighPriorityBanknoteSignal && hasLowPriorityBanknoteSignal) {
    pushMatch("new-releases", "low");
  }

  return matches;
}

function getIdDocumentSignalMatches(text) {
  const hasIdObject = normalizeKeywordList(ID_SIGNAL_OBJECT_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  if (!hasIdObject) {
    return [];
  }

  if (isNoiseContext(text)) {
    return [];
  }

  if (!isValidIdentityContext(text)) {
    return [];
  }

  if (isNonImpactIdentityContent(text)) {
    return [];
  }

  if (!hasIdentitySystemImpact(text)) {
    return [];
  }

  if (isNonSystemIdentityNoise(text)) {
    return [];
  }

  if (!isIdentitySystemEvent(text)) {
    return [];
  }

  const hasIdNoise = normalizeKeywordList(ID_SIGNAL_NOISE_KEYWORDS).some((keyword) => textMatchesKeyword(text, keyword));
  if (hasIdNoise) {
    return [];
  }

  if (!isAllowedIdentityIntent(text)) {
    return [];
  }

  const hasAny = (keywords) => normalizeKeywordList(keywords).some((keyword) => textMatchesKeyword(text, keyword));
  const matches = [];
  const pushMatch = (id, confidence) => {
    if (!matches.some((match) => match.id === id)) {
      matches.push({ id, confidence });
    }
  };

  if (hasAny(ID_SIGNAL_REGULATION_KEYWORDS)) {
    pushMatch("regulations", "high");
  }

  if (hasAny(["delay", "delays", "queue", "queues", "disruption", "outage", "technical outage", "suspension", "suspended"])) {
    pushMatch("delay", "high");
  }

  if (hasAny(["travel disruption", "border delays", "border queue", "airport disruption", "passport stamping replacement"])) {
    pushMatch("travel-disruption", "high");
  }

  if (hasAny(["fake passport", "forged passport", "forged documents", "terrorist passport", "document fraud network"])) {
    pushMatch("criminal-misuse", "high");
    pushMatch("fraud", "high");
  }

  if (hasAny(["identity theft", "stolen identity"])) {
    pushMatch("identity-theft", "high");
    pushMatch("fraud", "high");
  }

  if (hasAny(["biometric", "biometric system", "biometric checks", "biometric border checks"])) {
    pushMatch("biometric", "high");
  }

  if (hasAny(["border control", "border checks", "border crossing", "customs", "ees", "etias", "entry exit system", "entry/exit system"])) {
    pushMatch("border-control", "high");
  }

  if (hasAny(ID_SIGNAL_SECURITY_STRONG_KEYWORDS)) {
    pushMatch("security-features", "high");
  }

  if (hasAny(ID_SIGNAL_TECHNOLOGY_STRONG_KEYWORDS)) {
    pushMatch("technology", "high");
  }

  if (hasAny(ID_SIGNAL_DESIGN_STRONG_KEYWORDS)) {
    pushMatch("redesign", "high");
    pushMatch("design-changes", "high");
  } else if (hasAny(ID_SIGNAL_DESIGN_WEAK_KEYWORDS)) {
    pushMatch("redesign", "low");
    pushMatch("design-changes", "low");
  }

  if (hasAny(ID_SIGNAL_RELEASE_STRONG_KEYWORDS)) {
    pushMatch("rollout", "high");
    pushMatch("new-releases", "high");
  } else if (hasAny(ID_SIGNAL_RELEASE_SUPPORT_KEYWORDS)) {
    pushMatch("rollout", "low");
    pushMatch("new-releases", "low");
  }

  return matches;
}

function getSignalConfidenceLabel(confidence) {
  if (confidence === "high") {
    return "high";
  }

  if (confidence === "low") {
    return "low";
  }

  return "";
}

function getPrimaryArticleSignalLabel(primarySignalCategory) {
  if (!primarySignalCategory) {
    return "";
  }

  return primarySignalCategory.badgeLabel || primarySignalCategory.label;
}

function getNormalizedEventSignalMatch(article) {
  return getCachedArticleValue(article, "normalizedEventSignalMatch", () => {
    const normalizedEvent = normalizeIntelligenceEvent(article);
    const canonicalEventType = normalizedEvent?.canonicalEventType || "";
    const action = normalizedEvent?.action || "";
    if (!canonicalEventType || canonicalEventType === "other") {
      return null;
    }

    const signalIdMap = {
      passport_fraud: "fraud",
      forged_document: "criminal-misuse",
      identity_theft: "identity-theft",
      passport_revocation: "regulations",
      citizenship_law: "regulations",
      visa_policy: "regulations",
      border_delay: "delay",
      border_rollout: "rollout",
      biometric_border_check: "biometric",
      ees_event: action === "delay" || action === "suspension" || action === "exemption" ? "delay"
        : action === "rollout" ? "rollout"
          : "border-control",
      etias_event: action === "delay" || action === "suspension" || action === "exemption" ? "delay"
        : action === "rollout" ? "rollout"
          : "border-control",
      digital_id_regulation: "regulations",
      identity_infrastructure: "technology",
      document_security_technology: "technology",
      banknote_withdrawal: "withdrawal",
      demonetisation: "withdrawal",
      counterfeit_banknotes: "counterfeit",
      banknote_redesign: "redesign",
      new_banknote_series: "redesign",
      polymer_migration: "polymer",
      security_feature_update: "security-features",
      commemorative_issue: "commemorative",
      circulation_policy: "regulations",
      central_bank_warning: "security-features",
      banknote_production: "technology",
    };

    const signalId = signalIdMap[canonicalEventType];
    if (!signalId) {
      return null;
    }

    return {
      id: signalId,
      confidence: normalizedEvent.confidence === "low" ? "low" : "high",
    };
  });
}

function getArticleSignalMatches(article) {
  return getCachedArticleValue(article, "articleSignalMatches", () => {
    const haystack = getArticleSignalText(article);
    if (!haystack) {
      return [];
    }

    if (!isRelevantSignalText(haystack)) {
      return [];
    }

    if (!hasSignalCoreObject(haystack) || hasSignalNoiseContext(haystack)) {
      return [];
    }

    const designChangeCategory = getSignalCategoryById("design-changes");
    const hasDesignChangeSignal = Boolean(
      designChangeCategory && countMatchedKeywords(haystack, designChangeCategory.strong) >= 1
    );
    const normalizedEventSignalMatch = getNormalizedEventSignalMatch(article);
    const idDocumentMatches = getIdDocumentSignalMatches(haystack);
    const banknoteMatches = getBanknoteSignalMatches(haystack);
    const heuristicMatches = idDocumentMatches.concat(banknoteMatches, SIGNAL_CATEGORIES.flatMap((category) => {
      if (
        idDocumentMatches.some((match) => match.id === category.id) ||
        banknoteMatches.some((match) => match.id === category.id)
      ) {
        return [];
      }

      const strongMatches = countMatchedKeywords(haystack, category.strong);
      const weakMatches = countMatchedKeywords(haystack, category.weak);
      const excludeKeywords = normalizeKeywordList(category.exclude);
      const requiredObjects = normalizeKeywordList(category.requiredObjects);
      const categoryNoise = normalizeKeywordList(category.noise);
      const hasExcludeMatch = excludeKeywords.some((keyword) => textMatchesKeyword(haystack, keyword));
      if (hasExcludeMatch) {
        return [];
      }

      if (category.id === "new-releases") {
        const hasRequiredObjectMatch = requiredObjects.some((keyword) => textMatchesKeyword(haystack, keyword));
        const hasCategoryNoise = categoryNoise.some((keyword) => textMatchesKeyword(haystack, keyword));
        const hasReleaseVariantKeyword = normalizeKeywordList(SIGNAL_RELEASE_VARIANT_KEYWORDS).some((keyword) =>
          textMatchesKeyword(haystack, keyword)
        );
        const hasReleaseObjectKeyword = normalizeKeywordList(SIGNAL_RELEASE_OBJECT_KEYWORDS).some((keyword) =>
          textMatchesKeyword(haystack, keyword)
        );
        if (!hasRequiredObjectMatch || hasCategoryNoise || hasDesignChangeSignal) {
          if (!(hasReleaseVariantKeyword && hasReleaseObjectKeyword) || hasCategoryNoise || hasDesignChangeSignal) {
            return [];
          }
        }

        if (strongMatches >= 1 || (hasReleaseVariantKeyword && hasReleaseObjectKeyword)) {
          return [{
            id: category.id,
            confidence: "high",
          }];
        }

        return [];
      }

      if (strongMatches >= 1) {
        return [{
          id: category.id,
          confidence: "high",
        }];
      }

      if (weakMatches >= 1) {
        return [{
          id: category.id,
          confidence: "low",
        }];
      }

      return [];
    }));

    if (
      normalizedEventSignalMatch &&
      !heuristicMatches.some((match) => match.id === normalizedEventSignalMatch.id)
    ) {
      return [normalizedEventSignalMatch].concat(heuristicMatches);
    }

    return heuristicMatches;
  });
}

function getArticleSignalCategories(article) {
  return getCachedArticleValue(article, "articleSignalCategories", () =>
    getArticleSignalMatches(article).map((match) => match.id)
  );
}

function isUiRelevantIntelligenceArticle(article) {
  const signalMatches = getArticleSignalMatches(article);
  if (signalMatches.length) {
    return true;
  }

  return isRelevantSignalText(getArticleSignalText(article));
}

function getPrimaryArticleSignalCategory(article) {
  return getCachedArticleValue(article, "primaryArticleSignalCategory", () => {
    const [primarySignalMatch] = getArticleSignalMatches(article);
    if (!primarySignalMatch) {
      return null;
    }

    const category = getSignalCategoryById(primarySignalMatch.id);
    if (!category) {
      return null;
    }

    const primarySignalCategory = {
      ...category,
      confidence: primarySignalMatch.confidence,
    };

    intelligenceDebug("[classification]", {
      title: article?.title || "Untitled article",
      signalType: primarySignalCategory.id,
      entity: getDetectedEventEntity(article),
      eventType: normalizeIntelligenceEvent(article)?.canonicalEventType || getDetailedArticleEventType(article),
      confidence: primarySignalCategory.confidence,
    });

    return primarySignalCategory;
  });
}

function isKeywordRuleFalsePositive(article, rule) {
  if (!rule) {
    return false;
  }

  const haystack = getArticleKeywordText(article);
  const hasExclusion = normalizeKeywordList(rule.exclude).some((keyword) => textMatchesKeyword(haystack, keyword));
  if (!hasExclusion) {
    return false;
  }

  return !normalizeKeywordList(rule.include).some((keyword) => textMatchesKeyword(haystack, keyword));
}

function isPassportFalsePositive(article) {
  const haystack = getArticleKeywordText(article);
  if (!textMatchesKeyword(haystack, "passport") && !textMatchesKeyword(haystack, "passports")) {
    return false;
  }

  const hasExclusion = state.keywordFilters.exclude.some((keyword) => textMatchesKeyword(haystack, keyword));
  if (!hasExclusion) {
    return false;
  }

  return !state.keywordFilters.include.some((keyword) => textMatchesKeyword(haystack, keyword));
}

function isDriverLicenseMusicFalsePositive(article) {
  const haystack = getArticleKeywordText(article);
  const hasDriverLicenseTerm = DRIVER_LICENSE_FALSE_POSITIVE_TERMS.some((keyword) =>
    textMatchesKeyword(haystack, keyword)
  );
  if (!hasDriverLicenseTerm) {
    return false;
  }

  return MUSIC_FALSE_POSITIVE_KEYWORDS.some((keyword) => textMatchesKeyword(haystack, keyword));
}

function isCoinGamingFalsePositive(article) {
  const haystack = getArticleKeywordText(article);
  const hasCoinTerm = COIN_FALSE_POSITIVE_TERMS.some((keyword) => textMatchesKeyword(haystack, keyword));
  if (!hasCoinTerm) {
    return false;
  }

  const hasGamingContext = GAMING_COIN_FALSE_POSITIVE_KEYWORDS.some((keyword) =>
    textMatchesKeyword(haystack, keyword)
  );
  if (!hasGamingContext) {
    return false;
  }

  return !COIN_CONTEXT_KEYWORDS.some((keyword) => textMatchesKeyword(haystack, keyword));
}

function setFieldActive(control, isActive) {
  control?.closest(".field")?.classList.toggle("is-active-filter", Boolean(isActive));
}

function addActiveFilterChip(fragment, label, value, filterKey) {
  const chip = document.createElement("button");
  chip.className = "active-filter-chip";
  chip.type = "button";
  chip.dataset.clearFilter = filterKey;
  chip.setAttribute("aria-label", `Clear ${label} filter`);
  chip.textContent = `${label}: ${value}`;
  fragment.appendChild(chip);
}

function syncFilterUx() {
  if (!elements.activeFilterList) {
    return;
  }

  const fragment = document.createDocumentFragment();
  const sourceSearch = String(elements.feedPanelSearch?.value || "").trim();
  const sourceStatus = elements.feedVisibilityFilter?.value || "all";
  const sourceGroup = state.filters.sourceGroup || "all";

  setFieldActive(elements.searchFilter, Boolean(state.filters.search));
  setFieldActive(elements.topicFilter, Boolean(state.filters.topic));
  setFieldActive(elements.tagFilter, Boolean(state.filters.tag));
  setFieldActive(elements.signalFilter, Boolean(state.filters.signalCategory));
  setFieldActive(elements.includeKeywordsInput, hasCustomIncludeKeywords());
  setFieldActive(elements.excludeKeywordsInput, hasCustomExcludeKeywords());
  setFieldActive(elements.feedFilter, Boolean(state.filters.feedId));
  setFieldActive(elements.dmvFeedFilter, Boolean(state.filters.dmvFeedId || state.dashboardMode === "usa"));
  setFieldActive(
    elements.canadaDmvFilter,
    Boolean(state.filters.canadaDmvFeedPath || state.filters.canadaDmvAll || state.dashboardMode === "canada")
  );
  setFieldActive(elements.dateFilter, Boolean(state.filters.date));
  setFieldActive(elements.feedPanelSearch, Boolean(sourceSearch));
  setFieldActive(elements.feedVisibilityFilter, sourceStatus !== "all");

  if (state.filters.search) {
    addActiveFilterChip(fragment, "Search", state.filters.search, "search");
  }
  if (Array.isArray(state.filters.articleIds) && state.filters.articleIds.length) {
    addActiveFilterChip(
      fragment,
      "Alert",
      state.filters.alertLabel || `${state.filters.articleIds.length} articles`,
      "article-ids"
    );
  }
  if (state.filters.topic) {
    addActiveFilterChip(fragment, "Topic", state.filters.topic, "topic");
  }
  if (state.filters.tag) {
    addActiveFilterChip(fragment, "Tag", state.filters.tag, "tag");
  }
  if (state.filters.signalCategory) {
    addActiveFilterChip(
      fragment,
      "Signal",
      getSignalCategoryById(state.filters.signalCategory)?.label || state.filters.signalCategory,
      "signal-category"
    );
  }
  if (hasCustomIncludeKeywords()) {
    addActiveFilterChip(fragment, "Include keywords", `${state.keywordFilters.include.length} terms`, "include-keywords");
  }
  if (hasCustomExcludeKeywords()) {
    addActiveFilterChip(fragment, "Exclude keywords", `${state.keywordFilters.exclude.length} terms`, "exclude-keywords");
  }
  if (state.filters.feedId) {
    addActiveFilterChip(fragment, "Feed", getSelectedOptionText(elements.feedFilter) || "Selected feed", "feed");
  }
  if (state.filters.dmvFeedId) {
    addActiveFilterChip(fragment, "USA", getSelectedOptionText(elements.dmvFeedFilter) || "Selected state", "usa");
  } else if (state.dashboardMode === "usa") {
    addActiveFilterChip(fragment, "Mode", "USA feeds", "mode");
  }
  if (state.filters.canadaDmvFeedPath) {
    addActiveFilterChip(
      fragment,
      "Canada",
      getSelectedOptionText(elements.canadaDmvFilter) || "Selected province",
      "canada"
    );
  } else if (state.filters.canadaDmvAll) {
    addActiveFilterChip(fragment, "Canada", "All Canada DMV", "canada");
  } else if (state.dashboardMode === "canada") {
    addActiveFilterChip(fragment, "Mode", "Canada feeds", "mode");
  }
  if (state.filters.date) {
    addActiveFilterChip(fragment, "Date", state.filters.date, "date");
  }
  if (sourceSearch) {
    addActiveFilterChip(fragment, "Source search", sourceSearch, "source-search");
  }
  if (sourceStatus !== "all") {
    addActiveFilterChip(fragment, "Source status", getSelectedOptionText(elements.feedVisibilityFilter), "source-status");
  }
  if (sourceGroup !== "all") {
    addActiveFilterChip(fragment, "Source group", sourceGroup, "source-group");
  }

  elements.activeFilterList.innerHTML = "";
  elements.activeFilterList.hidden = !fragment.childNodes.length;
  elements.activeFilterList.appendChild(fragment);
  const hasActiveFilters = Boolean(elements.activeFilterList.childNodes.length);
  elements.clearFilters.classList.toggle("is-active-filter", hasActiveFilters);
  elements.clearFilters.textContent = hasActiveFilters ? "Clear active" : "Reset";
  elements.clearFilters.setAttribute(
    "aria-label",
    hasActiveFilters ? "Clear all active filters" : "Reset filters"
  );
  elements.clearFilters.title = hasActiveFilters ? "Clear all active filters" : "Reset filters";
}

function clearActiveFilter(filterKey) {
  if (filterKey === "search") {
    state.filters.search = "";
    elements.searchFilter.value = "";
  } else if (filterKey === "article-ids") {
    clearExactArticleFilter();
  } else if (filterKey === "topic") {
    state.filters.topic = "";
    elements.topicFilter.value = "";
  } else if (filterKey === "tag") {
    state.filters.tag = "";
    elements.tagFilter.value = "";
  } else if (filterKey === "signal-category") {
    state.filters.signalCategory = "";
    if (elements.signalFilter) {
      elements.signalFilter.value = "";
    }
  } else if (filterKey === "include-keywords") {
    setKeywordFilters({ include: DEFAULT_KEYWORD_INCLUDES });
  } else if (filterKey === "exclude-keywords") {
    setKeywordFilters({ exclude: DEFAULT_KEYWORD_EXCLUDES });
  } else if (filterKey === "feed") {
    state.filters.feedId = "";
    elements.feedFilter.value = "";
  } else if (filterKey === "usa") {
    state.filters.dmvFeedId = "";
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
  } else if (filterKey === "canada") {
    state.filters.canadaDmvFeedPath = "";
    state.filters.canadaDmvAll = false;
    if (elements.canadaDmvFilter) {
      elements.canadaDmvFilter.value = "";
    }
  } else if (filterKey === "date") {
    state.filters.date = "";
    elements.dateFilter.value = "";
  } else if (filterKey === "mode") {
    state.dashboardMode = "normal";
  } else if (filterKey === "source-search" && elements.feedPanelSearch) {
    elements.feedPanelSearch.value = "";
  } else if (filterKey === "source-status" && elements.feedVisibilityFilter) {
    elements.feedVisibilityFilter.value = "all";
  } else if (filterKey === "source-group") {
    state.filters.sourceGroup = "all";
  }

  renderDashboard();
}

function renderFeedOptions() {
  ensureFeedLookupCaches();
  const topics = Array.from(
    new Set(state.feeds.map((feed) => String(feed.topic || "").trim()).filter(Boolean))
  ).sort();
  const realArticles = state.articles.filter((article) => !isOfficialFallbackArticle(article));
  const tagCounts = state.articles.reduce((counts, article) => {
    getArticleFilterTags(article).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
    return counts;
  }, new Map());
  const signalCounts = realArticles.reduce((counts, article) => {
    getArticleSignalCategories(article).forEach((signalCategoryId) => {
      counts.set(signalCategoryId, (counts.get(signalCategoryId) || 0) + 1);
    });
    return counts;
  }, new Map());
  const tags = getActiveTags().filter(
    (tag) => TAG_FILTER_MIN_COUNT <= 0 || (tagCounts.get(tag) || 0) >= TAG_FILTER_MIN_COUNT
  );
  const nonDmvFeeds = getNonDmvFeeds()
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  const usDmvCatalogEntries = getUsDmvCatalogEntries();
  const canadaCatalogEntries = getCanadaDmvCatalogEntries();
  const seenFeedOptionValues = new Map();

  if (
    state.filters.feedId &&
    !nonDmvFeeds.some((feed) => getUniqueFeedIdentity(feed) === state.filters.feedId)
  ) {
    state.filters.feedId = "";
  }

  if (
    state.filters.dmvFeedId &&
    !usDmvCatalogEntries.some((entry) => entry.abbr === state.filters.dmvFeedId)
  ) {
    state.filters.dmvFeedId = "";
  }

  if (
    state.filters.canadaDmvFeedPath &&
    !canadaCatalogEntries.some((entry) => entry.feedPath === state.filters.canadaDmvFeedPath)
  ) {
    state.filters.canadaDmvFeedPath = "";
  }

  if (state.filters.canadaDmvAll && !canadaCatalogEntries.length) {
    state.filters.canadaDmvAll = false;
  }

  elements.topicFilter.innerHTML = [`<option value="">All topics</option>`]
    .concat(topics.map((topic) => `<option value="${topic}">${topic}</option>`))
    .join("");
  elements.topicFilter.value = state.filters.topic;

  state.filters.tag = normalizeFilterTag(state.filters.tag);
  if (state.filters.tag && !tags.includes(state.filters.tag)) {
    state.filters.tag = "";
  }
  if (state.filters.signalCategory && !SIGNAL_CATEGORY_BY_ID.has(state.filters.signalCategory)) {
    state.filters.signalCategory = "";
  }

  if (elements.tagFilter) {
    elements.tagFilter.innerHTML = [`<option value="">All tags</option>`]
      .concat(tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`))
      .join("");
    elements.tagFilter.value = state.filters.tag;
  }

  if (elements.signalFilter) {
    elements.signalFilter.innerHTML = [`<option value="">All signals</option>`]
      .concat(
        SIGNAL_CATEGORIES.map((category) => {
          const count = signalCounts.get(category.id) || 0;
          return `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)} (${count})</option>`;
        })
      )
      .join("");
    elements.signalFilter.value = state.filters.signalCategory;
  }

  elements.feedFilter.innerHTML = [`<option value="">All feeds</option>`]
    .concat(
      nonDmvFeeds.map((feed, index) => {
        const optionLabel = feed.name || "Untitled Feed";
        const optionValue = getUniqueFeedIdentity(feed);
        const domain = getFeedDiagnosticDomain(feed);
        const feedId = String(feed.id || "").trim();
        const sourceId = String(feed.sourceId || "").trim();

        debugFeedFilterLog("[feed-option]", {
          label: optionLabel,
          value: optionValue,
          feedId,
          sourceId,
          domain,
          index,
        });

        if (!optionValue) {
          debugFeedFilterWarn("[feed-option-missing-id]", {
            label: optionLabel,
            feedId,
            sourceId,
            domain,
            index,
          });
        }

        if (seenFeedOptionValues.has(optionValue)) {
          debugFeedFilterWarn("[feed-option-duplicate-value]", {
            value: optionValue,
            first: seenFeedOptionValues.get(optionValue),
            duplicate: {
              label: optionLabel,
              feedId,
              sourceId,
              domain,
              index,
            },
          });
        } else {
          seenFeedOptionValues.set(optionValue, {
            label: optionLabel,
            feedId,
            sourceId,
            domain,
            index,
          });
        }

        if (feedId && runtime.duplicateFeedIds.has(feedId)) {
          debugFeedFilterWarn("[feed-option-duplicate-feed-id]", {
            label: optionLabel,
            value: optionValue,
            feedId,
            sourceId,
            domain,
            index,
          });
        }

        if (sourceId && runtime.duplicateSourceIds.has(sourceId)) {
          debugFeedFilterWarn("[feed-option-duplicate-source-id]", {
            label: optionLabel,
            value: optionValue,
            feedId,
            sourceId,
            domain,
            index,
          });
        }

        return `<option value="${escapeHtml(optionValue)}">${escapeHtml(optionLabel)}</option>`;
      })
    )
    .join("");
  elements.feedFilter.value = state.filters.feedId;

  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.innerHTML = [`<option value="">All DMV states</option>`]
      .concat(
        usDmvCatalogEntries.map(
          (entry) => `<option value="${entry.abbr}">${getCatalogEntrySubdivisionLabel(entry)}</option>`
        )
      )
      .join("");
    elements.dmvFeedFilter.value = state.filters.dmvFeedId;
  }

  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.innerHTML = [`<option value="">All Canada DMV</option>`]
      .concat(
        canadaCatalogEntries.map(
          (entry) => `<option value="${entry.feedPath}">${getCatalogEntrySubdivisionLabel(entry)}</option>`
        )
      )
      .join("");
    elements.canadaDmvFilter.value = state.filters.canadaDmvFeedPath;
  }
}

function refreshTagControls() {
  const selectedTag = normalizeFilterTag(state.filters.tag);
  if (selectedTag && !getActiveTagSet().has(selectedTag)) {
    state.filters.tag = "";
  }
  renderFeedOptions();
  renderTagManager();
  scheduleRenderArticles("tag-controls");
}

function addTagFromInput() {
  if (!elements.tagAddInput) {
    return;
  }

  const tag = normalizeFilterTag(elements.tagAddInput.value);
  if (!tag) {
    elements.tagAddInput.value = "";
    return;
  }

  if (!getActiveTagSet().has(tag)) {
    setActiveTags([...getActiveTags(), tag]);
  }

  elements.tagAddInput.value = "";
  refreshTagControls();
}

function removeActiveTag(tag) {
  const normalizedTag = normalizeFilterTag(tag);
  if (!normalizedTag) {
    return;
  }

  setActiveTags(getActiveTags().filter((item) => item !== normalizedTag));
  refreshTagControls();
}

function syncTagManagerVisibility() {
  if (!elements.tagManagerContent || !elements.tagManagerToggle) {
    return;
  }

  elements.tagManagerContent.hidden = !state.tagManagerExpanded;
  elements.tagManagerToggle.setAttribute("aria-expanded", String(state.tagManagerExpanded));
  elements.tagManagerToggle.textContent = state.tagManagerExpanded ? "Hide ▴" : "Manage ▾";
}

function renderTagManager() {
  if (!elements.tagManagerList) {
    return;
  }

  elements.tagManagerList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  getActiveTags().forEach((tag) => {
    const tagItem = document.createElement("span");
    const label = document.createElement("span");
    const removeButton = document.createElement("button");

    tagItem.className = "tag-manager-item";
    label.textContent = tag;
    removeButton.type = "button";
    removeButton.className = "tag-manager-remove";
    removeButton.dataset.removeTag = tag;
    removeButton.textContent = "remove";
    removeButton.title = "Click once, then confirm to remove";
    removeButton.setAttribute("aria-label", `Prepare to remove ${tag}`);

    tagItem.append(label, removeButton);
    fragment.appendChild(tagItem);
  });

  elements.tagManagerList.appendChild(fragment);
  syncTagManagerVisibility();
}

function renderDmvOfficialLink() {
  if (!elements.dmvOfficialLinkWrap || !elements.dmvOfficialLink) {
    return;
  }

  const selectedDmvFeed = getSelectedDmvFeed();
  const selectedUsDmvEntry = getSelectedUsDmvCatalogEntry();
  const selectedCanadaEntry = getSelectedCanadaCatalogEntry();
  const officialUrl = String(
    selectedDmvFeed?.officialUrl ||
      selectedUsDmvEntry?.officialUrl ||
      selectedCanadaEntry?.officialUrl ||
      ""
  ).trim();

  if (!officialUrl) {
    elements.dmvOfficialLinkWrap.hidden = true;
    elements.dmvOfficialLink.removeAttribute("href");
    return;
  }

  elements.dmvOfficialLinkWrap.hidden = false;
  elements.dmvOfficialLink.href = officialUrl;
}

function renderDmvModeIndicator() {
  if (!elements.dmvModeIndicator) {
    return;
  }

  if (state.dashboardMode === "usa") {
    elements.dmvModeIndicator.hidden = false;
    elements.dmvModeIndicator.textContent = "Showing USA DMV feeds only";
    return;
  }

  if (state.dashboardMode === "canada") {
    elements.dmvModeIndicator.hidden = false;
    elements.dmvModeIndicator.textContent = "Showing Canada DMV feeds only";
    return;
  }

  elements.dmvModeIndicator.hidden = true;
}

function getVisibleFeeds() {
  ensureFeedLookupCaches();
  const sourceListMode = getSourceListMode();
  let feeds = state.feeds.slice();
  const canadaCatalogOnlySources = getCanadaCatalogOnlySources();
  const nonUsCatalogOnlySources = getNonUsCatalogOnlySources();
  const feedPanelSearch = String(elements.feedPanelSearch?.value || "").trim().toLowerCase();
  const visibilityFilter = elements.feedVisibilityFilter?.value || "all";
  const groupFilter = state.filters.sourceGroup || "all";

  if (sourceListMode === "dmv-only") {
    feeds = getUsDmvFeeds().slice();
  } else if (sourceListMode === "normal-feed") {
    feeds = feeds.filter((feed) => getUniqueFeedIdentity(feed) === state.filters.feedId);
  } else if (sourceListMode === "canada-entry") {
    const selectedCanadaFeed = getSelectedCanadaFeed();
    const selectedCanadaEntry = getSelectedCanadaCatalogEntry();
    feeds = selectedCanadaFeed
      ? feeds.filter((feed) => feed.id === selectedCanadaFeed.id)
      : selectedCanadaEntry && getCatalogEntryMode(selectedCanadaEntry) === "link-only"
        ? [toCatalogSource(selectedCanadaEntry, { idPrefix: "catalog-canada", topic: "Canada DMV" })]
        : [];
  } else if (sourceListMode === "dmv-feed") {
    const selectedUsFeed = getSelectedDmvFeed();
    feeds = selectedUsFeed ? feeds.filter((feed) => feed.id === selectedUsFeed.id) : [];
  } else if (sourceListMode === "canada-all") {
    feeds = getCanadaImportedDmvFeeds().concat(canadaCatalogOnlySources);
  } else {
    feeds = feeds.concat(nonUsCatalogOnlySources);
  }

  if (visibilityFilter === "active") {
    feeds = feeds.filter(
      (feed) => feed.isActive !== false && (isLinkOnlyDmvSource(feed) || feed.lastStatus !== "error")
    );
  }

  if (visibilityFilter === "inactive") {
    feeds = feeds.filter(
      (feed) => feed.isActive === false || (!isLinkOnlyDmvSource(feed) && feed.lastStatus === "error")
    );
  }

  if (feedPanelSearch) {
    feeds = feeds.filter((feed) => {
      const haystack = [
        feed.name,
        feed.topic,
        feed.rssUrl,
        feed.sourceType,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(feedPanelSearch);
    });
  }

  if (groupFilter !== "all") {
    feeds = feeds.filter((feed) => getFeedGroupName(feed) === groupFilter);
  }

  return feeds.sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""))
  );
}

function updateDmvToggleButton() {
  if (!elements.dmvToggleButton) return;

  if (state.dashboardMode === "usa") {
    elements.dmvToggleButton.textContent = "Show all feeds";
    elements.dmvToggleButton.classList.add("active-toggle");
    elements.dmvToggleButton.setAttribute("aria-pressed", "true");
  } else {
    elements.dmvToggleButton.textContent = "Show USA feeds";
    elements.dmvToggleButton.classList.remove("active-toggle");
    elements.dmvToggleButton.setAttribute("aria-pressed", "false");
  }

  if (!elements.canadaToggleButton) {
    return;
  }

  if (state.dashboardMode === "canada") {
    elements.canadaToggleButton.textContent = "Show all feeds";
    elements.canadaToggleButton.classList.add("active-toggle");
    elements.canadaToggleButton.setAttribute("aria-pressed", "true");
  } else {
    elements.canadaToggleButton.textContent = "Show Canada feeds";
    elements.canadaToggleButton.classList.remove("active-toggle");
    elements.canadaToggleButton.setAttribute("aria-pressed", "false");
  }
}

function syncFeedPanelVisibility() {
  if (!elements.feedPanelToggle || !elements.feedPanelContent) {
    return;
  }

  const collapsed = Boolean(state.feedPanelCollapsed);
  const expanded = !collapsed;
  if (!expanded) {
    state.addSourceExpanded = false;
  }

  const addSourceExpanded = expanded && state.addSourceExpanded;
  const trackedSourcesPanel = elements.feedPanel || elements.feedPanelContent.closest(".panel");

  elements.feedPanelToggle.setAttribute("aria-expanded", String(expanded));
  elements.feedPanelToggle.textContent = expanded ? "Hide sources" : "Show sources";
  elements.feedPanelContent.hidden = collapsed;
  elements.feedPanelContent.classList.toggle("is-collapsed", collapsed);
  trackedSourcesPanel?.classList.toggle("is-collapsed", collapsed);
  trackedSourcesPanel?.setAttribute("data-collapsed", String(collapsed));

  if (elements.addSourceContent) {
    elements.addSourceContent.hidden = !addSourceExpanded;
  }

  if (elements.addSourceToggle) {
    elements.addSourceToggle.setAttribute("aria-expanded", String(addSourceExpanded));
    elements.addSourceToggle.textContent = addSourceExpanded ? "Hide add" : "+ Add";
  }

  intelligenceLog("Panel collapsed:", collapsed, {
    feedPanelContentHidden: elements.feedPanelContent.hidden,
    addSourceContentHidden: elements.addSourceContent?.hidden,
  });
}

function syncAddSourcePanel(expanded) {
  if (!elements.addSourceToggle) {
    return;
  }

  if (expanded) {
    state.feedPanelCollapsed = false;
  }

  state.addSourceExpanded = expanded;
  syncFeedPanelVisibility();
}

function syncSourceGroupTabs() {
  if (!elements.feedGroupTabs) {
    return;
  }

  const labels = getSourceGroupTabLabels();
  if (!labels.includes(state.filters.sourceGroup || "all")) {
    state.filters.sourceGroup = "all";
  }

  const activeGroup = state.filters.sourceGroup || "all";
  elements.feedGroupTabs.innerHTML = "";
  labels.forEach((label) => {
    const button = document.createElement("button");
    const isActive = label === activeGroup;
    button.className = "feed-group-tab";
    button.type = "button";
    button.dataset.sourceGroup = label;
    button.setAttribute("aria-pressed", String(isActive));
    button.classList.toggle("is-active", isActive);
    button.textContent = label === "all" ? "All" : label;
    elements.feedGroupTabs.appendChild(button);
  });
}

function syncFeedFormMode() {
  const isEditing = Boolean(state.editingFeedId);
  const selectedSourceType = normalizeFeedSourceTypeValue(elements.feedSourceType?.value || "rss");
  const rssFeedCount = getRssBackedFeedCount();
  const rssLimitReached = !isEditing && selectedSourceType === "rss" && rssFeedCount >= MAX_RSS_FEEDS;

  if (elements.feedSubmit) {
    elements.feedSubmit.textContent = isEditing ? "Save changes" : "Add source";
    elements.feedSubmit.disabled = rssLimitReached;
  }

  if (elements.feedCancel) {
    elements.feedCancel.hidden = !isEditing;
  }

  if (elements.feedFormStatus && !isEditing) {
    elements.feedFormStatus.textContent = rssLimitReached ? MAX_RSS_FEEDS_MESSAGE : FEED_FORM_HELPER_TEXT;
  }

  intelligenceDebug("[feed-limit]", {
    rssFeedCount,
    selectedSourceType,
    rssLimitReached,
  });
}

function resetDashboardState() {
  state.dashboardMode = "normal";
  state.filters.search = "";
  state.filters.topic = "";
  state.filters.tag = "";
  state.filters.signalCategory = "";
  state.filters.feedId = "";
  state.filters.dmvFeedId = "";
  state.filters.canadaDmvFeedPath = "";
  state.filters.canadaDmvAll = false;
  state.filters.sourceGroup = "all";
  state.filters.date = "";
  clearExactArticleFilter({ clearStorage: false });

  if (elements.searchFilter) {
    elements.searchFilter.value = "";
  }
  if (elements.topicFilter) {
    elements.topicFilter.value = "";
  }
  if (elements.tagFilter) {
    elements.tagFilter.value = "";
  }
  if (elements.signalFilter) {
    elements.signalFilter.value = "";
  }
  if (elements.feedFilter) {
    elements.feedFilter.value = "";
  }
  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.value = "";
  }
  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.value = "";
  }
  if (elements.dateFilter) {
    elements.dateFilter.value = "";
  }
}

function resetFeedForm(options = {}) {
  const { preserveStatus = false } = options;
  const currentStatus = elements.feedFormStatus?.textContent || "";
  state.editingFeedId = "";
  elements.feedForm.reset();
  syncFeedFormMode();

  if (preserveStatus && elements.feedFormStatus) {
    elements.feedFormStatus.textContent = currentStatus;
  } else if (!preserveStatus) {
    elements.feedFormStatus.textContent = FEED_FORM_HELPER_TEXT;
  }
}

function parseGoogleAlertsBatchLine(line, index) {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return null;
  }

  const lowerLine = trimmed.toLowerCase();
  if (index === 0 && lowerLine.includes("feed name") && lowerLine.includes("rss")) {
    return null;
  }

  const delimiter = trimmed.includes("\t") ? "\t" : trimmed.includes("|") ? "|" : ",";
  const parts = trimmed.split(delimiter).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) {
    return {
      invalid: true,
      lineNumber: index + 1,
      reason: "Use: feed name | RSS URL | topic.",
      raw: trimmed,
    };
  }

  const urlIndex = parts.findIndex((part) => /^https?:\/\//i.test(part));
  if (urlIndex === -1) {
    return {
      invalid: true,
      lineNumber: index + 1,
      reason: "Missing RSS URL.",
      raw: trimmed,
    };
  }

  const name = parts.slice(0, urlIndex).join(" ").trim();
  const rssUrl = parts[urlIndex];
  const topic = parts.slice(urlIndex + 1).join(" ").trim();

  if (!name || !topic) {
    return {
      invalid: true,
      lineNumber: index + 1,
      reason: "Missing feed name or topic.",
      raw: trimmed,
    };
  }

  return {
    name,
    rssUrl,
    topic,
  };
}

function parseGoogleAlertsBatchInput(value) {
  const parsed = [];
  const invalid = [];
  String(value || "")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const entry = parseGoogleAlertsBatchLine(line, index);
      if (!entry) {
        return;
      }
      if (entry.invalid) {
        invalid.push(entry);
      } else {
        parsed.push(entry);
      }
    });

  return { parsed, invalid };
}

function startFeedEdit(feed) {
  if (!feed) {
    return;
  }

  state.editingFeedId = feed.id;
  elements.feedName.value = feed.name || "";
  elements.feedTopic.value = feed.topic || "";
  elements.feedUrl.value = feed.rssUrl || "";
  if (elements.feedSourceType) {
    elements.feedSourceType.value = feed.sourceType || "rss";
  }
  syncFeedFormMode();
  syncAddSourcePanel(true);
  elements.feedFormStatus.textContent = "Editing source. Update the fields and save your changes.";
  elements.feedName.focus();
}

function renderFeedGroupHeader(label) {
  const header = document.createElement("div");
  header.className = "feed-group-heading";
  header.textContent = label;
  return header;
}

function renderFeedItem(feed) {
  const node = elements.feedItemTemplate.content.cloneNode(true);
  const item = node.querySelector(".feed-item");
  const title = node.querySelector(".feed-item-title");
  const meta = node.querySelector(".feed-item-meta");
  const status = node.querySelector(".feed-status");
  const viewButton = node.querySelector(".feed-view-button");
  const editButton = node.querySelector(".feed-edit-button");
  const deleteButton = node.querySelector(".feed-delete-button");
  const actions = node.querySelector(".feed-item-actions");
  const isCatalogOnly = Boolean(feed.isCatalogOnly);
  const isLinkOnly = isLinkOnlyDmvSource(feed);
  const isRssBacked = isRssBackedDmvFeed(feed);
  const lastFetched = feed.lastFetchedAt
    ? formatDate(feed.lastFetchedAt)
    : isCatalogOnly
      ? "Official link only"
      : "Waiting for first sync";
  const statusPresentation = getFeedStatusPresentation(feed);
  const sourceKind = isLinkOnly
    ? "Link-only source"
    : isRssBacked
      ? "RSS-backed source"
      : "";

  item.classList.toggle("is-catalog-only", isCatalogOnly);
  item.classList.toggle("is-canada-link-only", isCanadaLinkOnlyFeed(feed));
  item.classList.toggle("is-canada-rss", isCanadaRssBackedFeed(feed));
  item.classList.toggle("is-link-only-source", isLinkOnly);
  item.classList.toggle("is-rss-backed-source", isRssBacked);
  title.textContent = feed.name || "Untitled feed";
  meta.textContent = [feed.topic || "General", sourceKind, lastFetched, feed.rssUrl || ""]
    .filter(Boolean)
    .join(" - ");
  status.textContent = statusPresentation.text;
  status.classList.add(statusPresentation.tone);

  if (isCatalogOnly) {
    viewButton.hidden = true;
    editButton.hidden = true;
    deleteButton.hidden = true;
    if (feed.officialUrl && actions) {
      const officialLink = document.createElement("a");
      officialLink.className = "ghost-button feed-official-link";
      officialLink.href = feed.officialUrl;
      officialLink.target = "_blank";
      officialLink.rel = "noopener noreferrer";
      officialLink.textContent = "Open official";
      actions.appendChild(officialLink);
    }
  } else {
    viewButton.dataset.feedId = feed.id;
    editButton.dataset.feedId = feed.id;
    deleteButton.dataset.feedId = feed.id;
    viewButton.dataset.action = "view-feed-articles";
    editButton.dataset.action = "edit-feed";
    deleteButton.dataset.action = "delete-feed";
  }

  return node;
}

function renderFeedList() {
  syncSourceGroupTabs();
  const visibleFeeds = getVisibleFeeds();
  const renderedFeeds = visibleFeeds.slice(0, MAX_VISIBLE_SOURCES_IN_LIST);
  const activeGroup = state.filters.sourceGroup || "all";

  elements.feedCount.textContent = String(visibleFeeds.length);
  elements.feedList.innerHTML = "";

  if (!visibleFeeds.length) {
    elements.feedList.innerHTML = `<div class="empty-state">No feeds match the current view.</div>`;
    updateDmvToggleButton();
    syncFilterUx();
    syncFeedPanelVisibility();
    return;
  }

  const fragment = document.createDocumentFragment();
  const groups =
    activeGroup === "all"
      ? getSourceGroupLabels(renderedFeeds).map((label) => ({
          label,
          feeds: renderedFeeds.filter((feed) => getFeedGroupName(feed) === label),
        }))
      : [{ label: activeGroup, feeds: renderedFeeds }];

  groups.forEach((group) => {
    if (!group.feeds.length) {
      return;
    }

    if (activeGroup === "all") {
      fragment.appendChild(renderFeedGroupHeader(group.label));
    }
    group.feeds.forEach((feed) => {
      fragment.appendChild(renderFeedItem(feed));
    });
  });

  elements.feedList.appendChild(fragment);
  updateDmvToggleButton();
  syncFilterUx();
  syncFeedPanelVisibility();
}

function articleMatchesFilters(article, options = {}) {
  if (isOfficialFallbackArticle(article)) {
    return false;
  }

  const ignoreFeedId = Boolean(options.ignoreFeedId);
  const ignorePersonalDashboard = Boolean(options.ignorePersonalDashboard);

  const activeKeywordRule = getActiveTopicKeywordRule();
  if (activeKeywordRule && isKeywordRuleFalsePositive(article, activeKeywordRule)) {
    return false;
  }

  if (
    !activeKeywordRule &&
    (isPassportFalsePositive(article) ||
      isDriverLicenseMusicFalsePositive(article) ||
      isCoinGamingFalsePositive(article))
  ) {
    return false;
  }

  const exactArticleIds = Array.isArray(state.filters.articleIds) ? state.filters.articleIds : [];
  if (exactArticleIds.length) {
    return exactArticleIds.includes(article.id);
  }

  if (state.filters.signalCategory && !getArticleSignalCategories(article).includes(state.filters.signalCategory)) {
    return false;
  }

  const selectedUsDmvEntry = getSelectedUsDmvCatalogEntry();
  if (selectedUsDmvEntry) {
    if (isUsLinkOnlyEntry(selectedUsDmvEntry)) {
      return false;
    }

    const selectedUsFeed = getSelectedDmvFeed();
    if (!selectedUsFeed || article.feedId !== selectedUsFeed.id) {
      return false;
    }
  }

  if (state.filters.topic && article.topic !== state.filters.topic) {
    return false;
  }

  if (state.filters.tag && !getArticleFilterTags(article).includes(normalizeFilterTag(state.filters.tag))) {
    return false;
  }

  if (state.filters.canadaDmvFeedPath) {
    const selectedCanadaFeed = getSelectedCanadaFeed();
    if (!selectedCanadaFeed || article.feedId !== selectedCanadaFeed.id) {
      return false;
    }
  }

  if (!ignoreFeedId && getActiveArticleFeedId() && !articleMatchesSelectedFeed(article, getActiveArticleFeedId())) {
    return false;
  }

  if (!ignoreFeedId && !getActiveArticleFeedId() && state.filters.canadaDmvAll && !isCanadianDmvAbbr(
    state.feeds.find((feed) => feed.id === article.feedId)?.dmvAbbr
  )) {
    return false;
  }

  if (!ignoreFeedId && !getActiveArticleFeedId() && state.dashboardMode === "usa" && !isDmvFeedId(article.feedId)) {
    return false;
  }

  if (state.filters.date && toDateInputValue(article.pubDate) !== state.filters.date) {
    return false;
  }

  if (state.filters.search) {
    const haystack = getArticleSearchText(article);

    if (!haystack.includes(state.filters.search.toLowerCase())) {
      return false;
    }
  }

  if (!ignorePersonalDashboard && !articleMatchesPersonalDashboardSelection(article)) {
    return false;
  }

  return true;
}

function getVisibleArticles(options = {}) {
  intelligenceTime("getVisibleArticles");
  const visibleArticles = state.articles
    .filter((article) => {
      const rejectedAsNoise = isHardPassportNoise(article);
      if (rejectedAsNoise) {
        intelligenceDebug("[passport-filter]", {
          title: article?.title || "Untitled article",
          confidence: getGovernmentDocumentConfidence(article),
          rejectedAsNoise,
        });
      }

      return !rejectedAsNoise;
    })
    .filter((article) => {
      try {
        const intelligence = article?._intelligence || primeArticleIntelligence(article) || {};
        const relevance = intelligence.identityDocumentRelevance ?? getIdentityDocumentRelevance(article);
        const highConfidenceAssessment = intelligence.highConfidencePassportAssessment ?? getHighConfidencePassportAssessment(article);
        const keesingAssessment = intelligence.keesingIdentityRelevance ?? getKeesingIdentityRelevance(article);
        const banknoteAssessment = intelligence.banknoteIntelligenceRelevance ?? getBanknoteIntelligenceRelevance(article);
        const rejected = shouldRejectPassportArticle(article)
          || isLowRelevancePassportArticle(article)
          || (isBanknoteTopicArticle(article) && !banknoteAssessment.kept);
        const primarySubject = highConfidenceAssessment.primarySubject;
        const hasPassportKeyword = isPassportOrIdentityTopicArticle(article);
        const hasBanknoteKeyword = isBanknoteTopicArticle(article);

        if (hasPassportKeyword) {
          const context = getIdentityContextSignals(article);
          const rejectedReason = rejected
            ? (!keesingAssessment.hasRequiredComponent ? "missing document/system component"
              : keesingAssessment.primarySubject === "unrelated" ? "keesing subject unrelated"
              : keesingAssessment.score < KEESING_RELEVANCE_THRESHOLD ? "below keesing threshold"
              : highConfidenceAssessment.rejectedReason || (primarySubject === "unrelated" ? "primary subject unrelated"
                : context.sports ? "sports"
                : context.pets ? "pets"
                : context.education ? "education"
                : context.unrelatedLifestyle ? "lifestyle"
                : context.entertainment ? "entertainment"
                : context.genericTravel ? "generic travel"
                : "low relevance"))
            : "";
          intelligenceDebug("[passport-context-filter]", {
            title: article?.title || "Untitled article",
            kept: !rejected,
            rejectedReason,
            score: relevance,
          });
          intelligenceDebug("[passport-relevance]", {
            title: article?.title || "Untitled article",
            score: highConfidenceAssessment.score,
            kept: !rejected,
            rejectedReason,
          });
          intelligenceDebug("[keesing-relevance]", {
            title: article?.title || "Untitled article",
            score: keesingAssessment.score,
            kept: !rejected,
            rejectedReason,
          });
          intelligenceDebug("[primary-passport-subject]", {
            title: article?.title || "Untitled article",
            primarySubject,
            kept: !rejected,
            rejectedReason,
          });
        }

        if (hasBanknoteKeyword) {
          const rejectedReason = !banknoteAssessment.kept ? banknoteAssessment.rejectedReason : "";
          intelligenceDebug("[banknote-relevance]", {
            title: article?.title || "Untitled article",
            score: banknoteAssessment.score,
            kept: banknoteAssessment.kept,
            rejectedReason,
          });
        }

        return !rejected;
      } catch (error) {
        console.warn("[passport-relevance-failsafe]", {
          title: article?.title || "Untitled article",
          message: error instanceof Error ? error.message : String(error),
        });
        return true;
      }
    })
    .filter(isUiRelevantIntelligenceArticle)
    .filter((article) => articleMatchesFilters(article, options));
  intelligenceTimeEnd("getVisibleArticles");
  return sortArticlesForCurrentDashboardMode(visibleArticles);
}

function getArticleCountLabel(count) {
  return `${count} article${count === 1 ? "" : "s"}`;
}

const ARTICLE_FINGERPRINT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "will",
  "with",
]);
const GROUPING_GENERIC_TOPIC_WORDS = new Set([
  "banknote",
  "banknotes",
  "note",
  "notes",
  "polymer",
  "passport",
  "passports",
  "id",
  "identity",
  "document",
  "documents",
  "digital",
  "biometric",
  "driver",
  "license",
  "licence",
  "release",
  "released",
  "update",
  "news",
  "new",
  "rollout",
  "system",
  "regulation",
  "regulations",
  "policy",
  "policies",
  "rule",
  "rules",
  "passport",
  "passports",
  "processing",
  "services",
  "office",
  "delay",
  "delays",
  "ranking",
  "index",
  "border",
  "control",
  "checks",
  "verification",
  "issuance",
  "renewal",
  "commemorative",
  "anniversary",
  "counterfeit",
  "security",
  "features",
  "design",
  "redesign",
]);
const GROUPING_EVENT_ENTITY_KEYWORDS = [
  ["italy", ["italy", "italian"]],
  ["portugal", ["portugal", "portuguese"]],
  ["greece", ["greece", "greek"]],
  ["armenia", ["armenia", "armenian"]],
  ["nigeria", ["nigeria", "nigerian"]],
  ["south-africa", ["south africa", "south african"]],
  ["ecowas", ["ecowas"]],
  ["pakistan", ["pakistan", "pakistani"]],
  ["kazakhstan", ["kazakhstan", "kazakh"]],
  ["bulgaria", ["bulgaria", "bulgarian", "lev", "leva"]],
  ["denmark", ["denmark", "danish", "krone"]],
  ["eurozone", ["eurozone", "euro area", "euro"]],
  ["rbi", ["rbi", "reserve bank of india"]],
  ["norges-bank", ["norges bank"]],
  ["ecb", ["ecb", "european central bank"]],
  ["bank-of-england", ["bank of england"]],
  ["state-department", ["state department"]],
  ["icao", ["icao"]],
  ["etias", ["etias"]],
  ["ees", ["ees", "entry exit system", "entry/exit system"]],
  ["state-department", ["state department"]],
  ["uk", ["united kingdom", "uk", "britain", "british"]],
  ["us", ["united states", "usa", "us", "american"]],
  ["canada", ["canada", "canadian"]],
  ["guatemala", ["guatemala", "quetzal"]],
  ["bangladesh", ["bangladesh", "bangladeshi", "taka"]],
];
const EVENT_FINGERPRINT_AGENCY_KEYWORDS = [
  ["state-department", ["state department"]],
  ["icao", ["icao"]],
  ["rbi", ["rbi", "reserve bank of india"]],
  ["norges-bank", ["norges bank"]],
  ["ecb", ["ecb", "european central bank"]],
  ["hnb", ["hnb", "croatian national bank"]],
  ["bank-of-england", ["bank of england"]],
  ["bulgarian-national-bank", ["bulgarian national bank"]],
  ["de-la-rue", ["de la rue"]],
  ["giesecke-devrient", ["giesecke+devrient", "giesecke devrient"]],
  ["crane-currency", ["crane currency"]],
  ["oberthur", ["oberthur"]],
  ["sicpa", ["sicpa"]],
  ["ministry-of-interior", ["ministry of interior"]],
  ["immigration-agency", ["immigration", "immigration agency"]],
  ["border-authority", ["border authority", "border control", "customs"]],
];
const EVENT_FINGERPRINT_SYSTEM_KEYWORDS = [
  ["ees", ["ees", "entry exit system", "entry/exit system"]],
  ["etias", ["etias"]],
  ["airport-disruption", ["dover", "airport disruption", "airport delays", "border queue", "port of dover"]],
  ["passport-revocation", ["passport revocation", "revocation", "child support"]],
  ["travel-exemption", ["travel exemption", "exemption", "exempt"]],
  ["citizenship-law", ["citizenship law", "nationality law"]],
  ["biometric-checks", ["biometric checks", "biometric border checks"]],
  ["visa-waiver", ["visa waiver", "visa policy", "visa requirement"]],
  ["border-checks", ["border checks", "border control", "border crossing"]],
  ["passport-fraud", ["passport fraud", "forged passport", "fake passport"]],
  ["passport-issuance", ["passport issuance", "passport office", "passport renewal"]],
  ["digital-id", ["digital id", "eid", "identity system"]],
  ["icao", ["icao", "travel document security"]],
  ["banknote-withdrawal", ["withdrawn from circulation", "legal tender withdrawal", "exchange deadline", "demonetization", "demonetisation"]],
  ["banknote-redesign", ["new banknote design", "redesign", "new family", "new series"]],
  ["banknote-security", ["security feature", "hologram", "watermark", "polymer substrate", "windowed thread"]],
  ["banknote-counterfeit", ["counterfeit banknotes", "counterfeit alert", "forged notes", "fake banknote"]],
];
const EVENT_FINGERPRINT_ACTION_KEYWORDS = [
  ["rollout", ["rollout", "rolled out", "launched", "deployed", "implemented"]],
  ["suspension", ["suspension", "suspended"]],
  ["revocation", ["revocation", "revoked"]],
  ["exemption", ["exemption", "exempt", "waiver"]],
  ["fraud-warning", ["warning", "fraud warning", "warns against"]],
  ["court-ruling", ["court ruling", "court", "judge"]],
  ["law-update", ["law update", "regulation", "policy change", "directive"]],
  ["application-fees", ["application fee", "application fees", "passport fee"]],
  ["border-delays", ["border delays", "border queue", "queue"]],
  ["deportation", ["deportation", "deported"]],
  ["issuance", ["issuance", "issued", "passport issuance"]],
  ["renewal", ["renewal", "renewed", "passport renewal"]],
  ["counterfeiting", ["counterfeit", "forged passport", "fake passport"]],
  ["withdrawal", ["withdrawn", "withdrawal", "withdrawn from circulation", "exchange deadline"]],
  ["redesign", ["redesign", "redesigned", "design unveiled", "new artwork"]],
  ["migration", ["polymer migration", "substrate migration", "transition"]],
];
const EVENT_FINGERPRINT_SUBJECT_KEYWORDS = [
  ["border-system", ["ees", "etias", "border control", "border checks", "entry exit system"]],
  ["citizenship-law", ["citizenship law", "nationality law"]],
  ["passport-fraud", ["passport fraud", "forged passport", "fake passport"]],
  ["immigration-enforcement", ["immigration enforcement", "deportation", "asylum"]],
  ["document-security", ["document security", "icao", "biometric"]],
  ["travel-advisory", ["travel advisory", "visa requirement", "entry requirements"]],
  ["airport-operations", ["airport", "border queue", "border delays"]],
  ["banknote-withdrawal", ["withdrawn from circulation", "legal tender", "exchange deadline", "demonetization", "demonetisation"]],
  ["banknote-redesign", ["new banknote design", "new family", "new series", "portrait change"]],
  ["banknote-security", ["security feature", "hologram", "watermark", "polymer substrate", "windowed thread"]],
  ["banknote-counterfeit", ["counterfeit banknotes", "counterfeit alert", "forged notes", "fake banknote"]],
];
const INTELLIGENCE_EVENT_SUBJECT_KEYWORDS = [
  ["child-support-revocation", ["child support", "alimony debt", "parents behind", "passport revocation"]],
  ["khargosh-fake-passport", ["khargosh", "let", "fake passport", "forged passport", "saudi arabia", "fled india"]],
  ["ees-delay", ["ees", "delay", "delays", "queue", "queues", "technical problems", "technical outage"]],
  ["ees-exemption", ["ees", "exemption", "exempt", "travel exemption"]],
  ["ees-suspension", ["ees", "suspension", "suspended"]],
  ["ees-rollout", ["ees", "rollout", "rolled out", "launch", "launched"]],
  ["etias-rollout", ["etias", "rollout", "rolled out", "launch", "launched"]],
  ["passport-fraud", ["passport fraud", "forged passport", "fake passport"]],
  ["passport-issuance", ["passport issuance", "passport office", "issued passport"]],
  ["passport-renewal", ["passport renewal", "renewal"]],
  ["citizenship-law", ["citizenship law", "nationality law"]],
  ["visa-policy", ["visa policy", "visa waiver", "visa requirement"]],
  ["banknote-withdrawal", ["withdrawn from circulation", "withdrawal", "demonetisation", "demonetization", "legal tender withdrawal"]],
  ["banknote-counterfeit", ["counterfeit banknotes", "counterfeit alert", "forged notes", "fake banknote"]],
  ["banknote-redesign", ["new banknote design", "new family", "new series", "portrait change", "redesign"]],
  ["polymer-transition", ["polymer migration", "polymer transition", "substrate migration", "plastic banknote"]],
  ["commemorative-issue", ["commemorative", "anniversary note", "centennial"]],
];
const INTELLIGENCE_CURRENCY_KEYWORDS = [
  ["euro", ["euro", "euros"]],
  ["lev", ["lev", "leva"]],
  ["rupee", ["rupee", "rupees", "₹"]],
  ["pound", ["pound", "pounds", "sterling"]],
  ["dollar", ["dollar", "dollars"]],
  ["hryvnia", ["hryvnia"]],
  ["rial", ["rial", "rials"]],
];
const ARTICLE_TOPIC_TYPE_BANKNOTE_KEYWORDS = [
  "banknote",
  "banknotes",
  "currency note",
  "paper money",
  "legal tender",
  "central bank",
  "polymer note",
  "counterfeit note",
  "demonetization",
  "demonetisation",
  "withdrawn from circulation",
];
const ARTICLE_TOPIC_TYPE_IDENTITY_DOCUMENT_KEYWORDS = [
  "identity card",
  "id card",
  "national id",
  "biometric id",
  "identity document",
  "birth certificate",
  "residence permit",
];
const ARTICLE_TOPIC_TYPE_TRAVEL_PASSPORT_KEYWORDS = [
  "passport issuance",
  "passport renewal",
  "passport revocation",
  "passport services",
  "passport office",
  "state department passport",
  "biometric passport",
  "e-passport",
  "epassport",
];
const ARTICLE_TOPIC_TYPE_DIGITAL_IDENTITY_KEYWORDS = [
  "digital id",
  "eid",
  "electronic id",
  "mobile id",
  "identity verification",
];
const ARTICLE_TOPIC_TYPE_DRIVER_LICENSE_KEYWORDS = [
  "driver licence",
  "driver license",
  "drivers license",
  "driver's license",
  "dmv",
];
const ARTICLE_TOPIC_TYPE_NOISE_KEYWORDS = [
  "product passport",
  "digital product passport",
  "material passport",
  "pet passport",
  "farmers market passport",
  "skills passport",
  "talent passport",
  "road map passport",
  "roadmap passport",
  "stamp passport",
  "passport to freedom",
  "metaphorical passport",
  "shop listing",
  "auction",
  "ebay",
  "reddit collection",
  "tiktok collection",
  "favorite banknotes",
  "beautiful banknotes",
];
const PASSPORT_EVENT_TYPE_RULES = {
  passport_regulation: [
    "revoke",
    "revocation",
    "child support",
    "citizenship law",
    "passport rule",
    "passport law",
    "visa requirement",
    "immigration rule",
  ],
  passport_design: [
    "new passport design",
    "redesigned passport",
    "commemorative passport",
    "america250",
    "america 250",
    "portrait",
    "trump passport design",
    "passport book size",
  ],
  passport_fraud: [
    "fake passport",
    "false passport",
    "stolen identity",
    "passport fraud",
    "forged passport",
    "identity theft",
  ],
  passport_processing: [
    "passport services halted",
    "passport system failure",
    "passport renewal",
    "passport office",
    "processing delay",
    "appointment booking",
  ],
  passport_ranking: [
    "passport index",
    "passport ranking",
    "strongest passport",
    "weakest passport",
    "visa-free access",
  ],
  ees_border_control: [
    "ees",
    "entry/exit system",
    "eta",
    "etias",
    "biometric border checks",
    "passport stamps",
    "border delays",
  ],
  passport_noise: [
    "digital product passport",
    "product passport",
    "material passport",
    "pet passport",
    "farmers market passport",
    "skills passport",
    "talent passport",
    "cultural passport",
    "roadmap passport",
    "road map passport",
    "phone passport design",
    "foldable passport-style",
    "passport program",
    "passport scheme",
    "metaphorical passport",
  ],
};
const REAL_TRAVEL_DOCUMENT_POSITIVE_SIGNALS = [
  "visa",
  "citizenship",
  "immigration",
  "border",
  "customs",
  "etias",
  "ees",
  "passport office",
  "state department",
  "biometric checks",
  "travel document",
  "passport renewal",
  "entry requirements",
  "airport",
  "border crossing",
  "identity fraud",
  "nationality law",
  "passport revocation",
];
const PASSPORT_HARD_NOISE_KEYWORDS = [
  "digital product passport",
  "product passport",
  "material passport",
  "pet passport",
  "skills passport",
  "talent passport",
  "farmers market passport",
  "language passport",
  "passport-style foldable",
  "passport style foldable",
  "samsung passport-style",
  "cultural passport",
  "vaccine passport history",
  "metaphorical passport",
  "software passport",
  "health passport",
  "health passport systems",
  "product registry passport",
  "foldable",
  "samsung",
  "farmers market",
  "product registry",
  "supply chain",
  "coshh",
  "language initiative",
  "hospitality talent",
  "roadmap",
  "civic action",
  "hidden gems",
  "tmx",
  "product infrastructure",
  "material traceability",
  "passport program",
  "passport scheme",
  "phone passport",
  "tourism passport",
  "loyalty passport",
  "wellness passport",
  "event passport",
  "educational passport",
  "vaccine passport history",
  "power bank",
  "registry platform",
];
const GOVERNMENT_DOCUMENT_POSITIVE_SIGNALS = [
  ["passport office", 3],
  ["visa", 3],
  ["immigration", 3],
  ["citizenship", 3],
  ["border", 3],
  ["customs", 3],
  ["etias", 3],
  ["ees", 3],
  ["biometric checks", 3],
  ["travel document", 3],
  ["state department", 3],
  ["nationality law", 3],
  ["border crossing", 3],
  ["airport", 2],
  ["fraud", 2],
  ["revocation", 2],
  ["national id", 2],
  ["residence permit", 2],
];
const GOVERNMENT_DOCUMENT_NEGATIVE_SIGNALS = [
  ["product passport", -5],
  ["pet passport", -5],
  ["foldable", -5],
  ["supply chain", -5],
  ["hospitality", -5],
  ["market passport", -5],
  ["civic passport", -5],
  ["language passport", -5],
  ["wellness passport", -5],
  ["material passport", -5],
];
const IDENTITY_DOCUMENT_HIGH_RELEVANCE_SIGNALS = [
  "passport office",
  "border control",
  "immigration",
  "citizenship law",
  "visa",
  "etias",
  "ees",
  "biometric",
  "identity card",
  "residence permit",
  "travel document",
  "passport fraud",
  "forged passport",
  "counterfeiting",
  "document security",
  "border crossing",
  "customs",
  "state department",
  "icao",
  "ministry of interior",
  "passport issuance",
  "passport renewal",
  "passport revocation",
  "nationality law",
  "digital id",
  "eid",
  "kyc",
  "immigration enforcement",
];
const IDENTITY_DOCUMENT_MEDIUM_RELEVANCE_SIGNALS = [
  "airport",
  "travel restriction",
  "border queue",
  "entry exit system",
  "immigration policy",
  "deportation",
  "asylum",
  "visa waiver",
];
const IDENTITY_DOCUMENT_NEGATIVE_RELEVANCE_SIGNALS = [
  "celebrity",
  "influencer",
  "football",
  "soccer",
  "library",
  "tourism campaign",
  "fundraiser",
  "market",
  "event passport",
  "loyalty",
  "reward",
  "health campaign",
  "dna day",
  "hospitality",
  "entertainment",
  "reality tv",
  "wedding",
  "safari",
  "language passport",
  "mural passport",
  "civic passport",
];
const IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD = 3;
const IDENTITY_CONTEXT_KEYWORDS = {
  government: [
    "ministry",
    "government",
    "passport office",
    "state department",
    "citizenship",
    "nationality",
    "law",
    "regulation",
  ],
  border: [
    "border control",
    "border crossing",
    "customs",
    "airport border",
    "entry exit system",
    "ees",
    "etias",
    "biometric checks",
  ],
  immigration: [
    "immigration",
    "visa",
    "asylum",
    "deportation",
    "residency",
    "permit",
    "immigration enforcement",
  ],
  fraud: [
    "fraud",
    "passport fraud",
    "forged",
    "forged passport",
    "counterfeit",
    "revocation",
  ],
  security: [
    "icao",
    "biometric",
    "document security",
    "travel document",
    "identity",
    "digital id",
    "eid",
    "kyc",
  ],
  issuance: [
    "issuance",
    "passport issuance",
    "passport renewal",
    "passport revocation",
  ],
  infrastructure: [
    "identity system",
    "national id",
    "identity card",
    "residence permit",
    "digital id",
    "eid",
  ],
  travelRule: [
    "travel restriction",
    "visa policy",
    "entry requirements",
    "immigration policy",
    "visa waiver",
  ],
  unrelatedLifestyle: [
    "influencer",
    "celebrity",
    "wedding",
    "backpacker",
    "safari",
    "holiday advice",
    "vacation tips",
    "travel hacks",
    "tourist guide",
  ],
  sports: [
    "football",
    "soccer",
    "club",
    "player",
    "transfer",
    "coach",
    "match",
  ],
  pets: [
    "pet passport",
    "dog",
    "cat",
    "animal travel",
  ],
  entertainment: [
    "entertainment",
    "reality tv",
    "easter",
    "blog post",
    "generic health",
  ],
  education: [
    "study abroad",
    "university",
    "student exchange",
  ],
  genericTravel: [
    "travel lifestyle",
    "travel anecdote",
    "generic travel",
    "travel warning",
    "travel story",
  ],
};
const PRIMARY_PASSPORT_SUBJECT_RULES = {
  border_systems: [
    "ees",
    "etias",
    "entry exit system",
    "entry/exit system",
    "border control",
    "border checks",
    "biometric checks",
    "border crossing",
    "customs",
  ],
  immigration: [
    "immigration",
    "immigration enforcement",
    "asylum",
    "deportation",
    "entry requirements",
    "travel restriction",
  ],
  citizenship: [
    "citizenship",
    "citizenship law",
    "nationality law",
    "naturalization",
  ],
  passport_fraud: [
    "passport fraud",
    "forged passport",
    "fake passport",
    "false passport",
    "counterfeit",
    "identity theft",
  ],
  passport_issuance: [
    "passport office",
    "passport issuance",
    "passport renewal",
    "passport services",
    "appointment booking",
  ],
  passport_regulation: [
    "passport revocation",
    "visa policy",
    "visa",
    "law",
    "regulation",
    "state department",
    "revocation",
  ],
  identity_infrastructure: [
    "digital id",
    "eid",
    "identity card",
    "national id",
    "residence permit",
    "identity system",
    "travel document",
    "icao",
    "ministry of interior",
  ],
  visa_policy: [
    "visa policy",
    "visa waiver",
    "visa requirement",
    "visa rules",
  ],
  travel_document_security: [
    "document security",
    "biometric",
    "forged passport",
    "passport fraud",
    "travel document",
    "icao",
  ],
  unrelated: [
    "player",
    "football",
    "coach",
    "influencer",
    "wedding",
    "dna day",
    "healthcare",
    "language scheme",
    "fundraiser",
    "backpacker",
    "celebrity",
    "tourist tips",
    "workflow",
    "payroll",
    "software",
    "market",
    "scam empire",
    "shooting",
    "murder",
    "local politics",
    "study abroad",
    "university",
    "pet passport",
  ],
};
const PRIMARY_PASSPORT_SOURCE_POSITIVE_SIGNALS = [
  ".gov",
  "icao",
  "state department",
  "immigration",
  "border",
  "etias",
  "ees",
  "document security",
  "biometric",
  "identity",
];
const PRIMARY_PASSPORT_SOURCE_NEGATIVE_SIGNALS = [
  "celebrity",
  "gossip",
  "sports",
  "lifestyle",
  "workflow",
  "payroll",
  "software",
  "travel blog",
];
const HIGH_CONFIDENCE_PASSPORT_POSITIVE_SIGNALS = [
  "immigration",
  "border control",
  "etias",
  "ees",
  "visa",
  "citizenship",
  "nationality law",
  "passport office",
  "biometric",
  "identity card",
  "residence permit",
  "forged passport",
  "document fraud",
  "icao",
  "travel document",
  "issuance",
  "renewal",
  "revocation",
  "asylum",
  "customs",
  "border crossing",
  "state department",
  "ministry of interior",
  "digital id",
  "eid",
  "kyc",
];
const HIGH_CONFIDENCE_PASSPORT_NEGATIVE_SIGNALS = [
  "kidnapping",
  "murder",
  "celebrity",
  "influencer",
  "wedding",
  "safari",
  "reality tv",
  "scandal",
  "gossip",
  "football",
  "soccer",
  "basketball",
  "player",
  "coach",
  "transfer",
  "vacation",
  "tourist guide",
  "travel hacks",
  "holiday tips",
  "library funding",
  "local fundraiser",
  "school event",
  "easter message",
  "festival passport",
  "event passport",
  "death certificate",
  "generic legal drama",
  "family disputes",
  "court story",
];
const HIGH_CONFIDENCE_PASSPORT_THRESHOLD = 14;
const KEESING_POSITIVE_SIGNALS = {
  documentSecurity: [
    "forged passport",
    "counterfeit",
    "document fraud",
    "fake passport",
    "icao",
    "biometric verification",
    "eid",
    "digital id",
    "nfc verification",
    "border technology",
    "mrz",
    "identity verification",
  ],
  borderInfrastructure: [
    "etias",
    "ees",
    "border control",
    "biometric checks",
    "airport immigration",
    "customs systems",
    "entry exit system",
    "entry/exit system",
  ],
  issuanceRegulation: [
    "passport issuance",
    "renewal",
    "revocation",
    "nationality law",
    "citizenship law",
    "residence permit",
    "visa system",
    "visa systems",
    "passport office",
    "state department",
    "ministry of interior",
  ],
  identitySystems: [
    "national id",
    "digital identity",
    "kyc",
    "authentication",
    "government identity system",
    "government identity systems",
  ],
};
const KEESING_NEGATIVE_SIGNALS = {
  humanInterest: [
    "isis bride",
    "isis brides",
    "celebrity travel",
    "influencer",
    "wedding",
    "travel drama",
    "personal anecdote",
    "personal story",
  ],
  genericTravel: [
    "6 month passport rule",
    "six month passport rule",
    "holiday travel tips",
    "tourism advice",
    "travel hacks",
    "vacation planning",
    "travel tips",
    "tourist guide",
  ],
  genericCrime: [
    "shooting",
    "shootings",
    "kidnapping",
    "kidnappings",
    "terrorism",
    "military incident",
    "court case",
    "court story",
  ],
  genericPolitics: [
    "racial commentary",
    "geopolitical commentary",
    "activism",
    "activist",
  ],
};
const KEESING_HARD_KEEP_SIGNALS = [
  "forged passport",
  "fake documents",
  "border systems",
  "biometric border checks",
  "etias",
  "ees",
  "icao",
  "digital identity",
  "eid",
  "document fraud",
  "passport revocation",
  "nationality law",
  "citizenship law",
  "immigration systems",
  "visa systems",
  "airport biometric systems",
];
const KEESING_REQUIRED_COMPONENT_SIGNALS = [
  "issuance",
  "renewal",
  "revocation",
  "fraud",
  "document fraud",
  "forged passport",
  "fake passport",
  "counterfeit",
  "biometric",
  "biometric checks",
  "biometric verification",
  "border control",
  "border systems",
  "etias",
  "ees",
  "identity verification",
  "government identity system",
  "government identity systems",
  "passport office",
  "visa system",
  "visa systems",
  "digital identity",
  "eid",
  "icao",
];
const KEESING_RELEVANCE_THRESHOLD = 16;
const BANKNOTE_INTELLIGENCE_POSITIVE_SIGNALS = {
  centralBankActions: [
    "central bank",
    "reserve bank",
    "monetary authority",
    "withdrawn from circulation",
    "demonetisation",
    "demonetization",
    "legal tender withdrawal",
    "circulation changes",
    "issuance",
    "banknote issuance",
    "new banknote",
    "new note",
    "note rollout",
    "banknote rollout",
    "replacement series",
    "redesign",
    "new family",
    "new denomination",
    "polymer transition",
    "currency reform",
  ],
  securityCounterfeiting: [
    "counterfeit banknotes",
    "counterfeit banknote",
    "counterfeit currency",
    "anti-counterfeit",
    "forged notes",
    "security feature",
    "security thread",
    "hologram",
    "watermark",
    "polymer substrate",
    "uv features",
    "authentication",
    "cash security",
    "counterfeit alert",
  ],
  realDesignChanges: [
    "new portrait",
    "redesign",
    "new artwork",
    "substrate migration",
    "polymer banknote",
    "tactile features",
    "accessibility features",
    "anti-counterfeit redesign",
    "major redesign",
    "new banknote family",
  ],
  currencyInfrastructure: [
    "banknote printing",
    "currency production",
    "mint",
    "security printer",
    "de la rue",
    "giesecke+devrient",
    "giesecke devrient",
    "crane currency",
    "orell fussli",
    "oberthur",
    "sicpa",
    "louisenthal",
    "banknotenews",
    "keesing",
  ],
};
const BANKNOTE_INTELLIGENCE_NEGATIVE_SIGNALS = {
  collectorHobby: [
    "pcgs",
    "unc",
    "graded note",
    "auction",
    "collectible",
    "collectible banknotes",
    "numismatic sales",
    "ebay",
    "for sale",
    "old banknotes for sale",
    "album of old banknotes",
    "rarity value",
    "coin values",
    "value your coins",
    "coin valuation",
    "serial number collecting",
    "pmg",
  ],
  socialCommunityNoise: [
    "reddit",
    "facebook",
    "instagram",
    "tiktok",
    "x.com",
    "linkedin repost",
    "reddit",
    "facebook repost",
    "youtube collector",
    "tiktok",
    "influencer video",
    "instagram collection",
  ],
  genericFinance: [
    "forex",
    "exchange rate",
    "bonds",
    "bond market",
    "stock market",
    "investors on edge",
    "inflation report",
    "currency markets",
    "economy",
    "gdp",
    "unemployment",
    "banking sector",
    "fintech funding",
    "stock markets",
    "trade negotiations",
    "grain deals",
    "forex",
    "investment analysis",
    "economic commentary",
    "market trends",
  ],
  genericCrime: [
    "money laundering",
    "robbery cash seizure",
    "atm theft",
    "unrelated fraud",
    "scam story",
    "cash seizure",
  ],
  spam: [
    "stock photography",
    "hi-res stock",
    "discount code",
    "marketplace",
    "auction",
    "gambling",
    "casino",
    "betting",
    "political debate",
    "political row",
    "political clash",
    "linkedin",
    "market spam",
    "ai-generated market report",
    "app store",
    "currency printing market trends",
    "app listing",
  ],
};
const BANKNOTE_INTELLIGENCE_HARD_KEEP_SIGNALS = [
  "demonetisation",
  "demonetization",
  "legal tender withdrawal",
  "counterfeit alert",
  "central bank warning",
  "polymer migration",
  "polymer banknote",
  "major redesign",
  "anti-counterfeit technology",
  "circulation withdrawal",
  "currency reform",
  "security feature upgrade",
  "security feature upgrades",
  "new banknote",
  "new banknote family",
  "new banknote family launch",
  "new banknote family launches",
];
const BANKNOTE_INTELLIGENCE_HARD_REJECT_SIGNALS = [
  "stock photography",
  "for sale",
  "discount code",
  "auction",
  "collector listing",
  "grading post",
  "reddit collector",
  "hobby showcase",
  "marketplace",
  "collectible banknotes",
  "coin values",
  "value your coins",
  "gambling",
  "casino",
  "betting",
  "forex",
  "exchange rate",
  "bonds",
  "stock market",
  "inflation report",
  "economy",
  "gdp",
  "unemployment",
  "banking sector",
  "fintech funding",
  "political debate",
  "generic finance news",
  "trade negotiations",
  "geopolitics",
  "market report",
  "app store",
  "app listing",
  "linkedin",
];
const BANKNOTE_REQUIRED_COMPONENT_SIGNALS = [
  "central bank",
  "reserve bank",
  "monetary authority",
  "withdrawn from circulation",
  "demonetisation",
  "demonetization",
  "legal tender withdrawal",
  "issuance",
  "banknote issuance",
  "new banknote",
  "new note",
  "note rollout",
  "replacement series",
  "redesign",
  "new family",
  "new denomination",
  "polymer transition",
  "polymer banknote",
  "counterfeit banknotes",
  "counterfeit banknote",
  "counterfeit currency",
  "anti-counterfeit",
  "forged notes",
  "security feature",
  "security thread",
  "hologram",
  "watermark",
  "polymer substrate",
  "authentication",
  "banknote printing",
  "currency production",
  "security printer",
  "de la rue",
  "giesecke+devrient",
  "crane currency",
  "oberthur",
  "sicpa",
];
const BANKNOTE_SIGNATURE_ONLY_SIGNALS = [
  "new sig/date",
  "new signature",
  "new date",
  "signature date",
  "confirmed",
  "prefix confirmed",
  "replacement batch confirmation",
];
const BANKNOTE_RELEVANCE_THRESHOLD = 14;
const BANKNOTE_EVENT_TYPE_RULES = {
  banknote_new_design: [
    "redesign",
    "redesigned",
    "new design",
    "design unveiled",
    "portrait change",
    "new banknote design",
  ],
  banknote_new_series: [
    "new series",
    "new banknote series",
    "new family",
    "new note family",
    "enter circulation",
    "enters circulation",
  ],
  banknote_signature_change: [
    "new sig/date",
    "new signature",
    "new date",
    "signature date",
    "confirmed",
  ],
  banknote_withdrawal: [
    "withdrawn",
    "withdrawal",
    "withdrawn from circulation",
    "out of circulation",
    "no longer legal tender",
    "legal tender until",
    "demonetized",
    "demonetised",
    "exchange deadline",
  ],
  counterfeit_banknotes: [
    "counterfeit",
    "fake banknote",
    "forged banknote",
    "fraud",
    "seizure",
    "fake notes",
    "counterfeit notes",
  ],
  commemorative_note: [
    "commemorative",
    "anniversary note",
    "centennial",
    "honouring",
    "honoring",
  ],
  polymer_transition: [
    "polymer",
    "plastic banknote",
    "substrate",
    "security feature",
    "windowed thread",
    "hologram",
  ],
  banknote_auction_noise: [
    "catalog",
    "shop",
    "for sale",
    "ebay",
    "pmg",
    "pcgs",
    "reddit",
    "tiktok",
    "instagram collection",
    "favorite banknotes",
    "beautiful banknotes",
  ],
};

function getArticleFingerprint(article) {
  const normalizedTitle = String(article?.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalizedTitle
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !ARTICLE_FINGERPRINT_STOP_WORDS.has(token) && token.length > 2);

  return Array.from(new Set(tokens)).sort().join(" ");
}

function getArticleFingerprintTokens(article) {
  const fingerprint = getArticleFingerprint(article);
  return fingerprint ? fingerprint.split(/\s+/).filter(Boolean) : [];
}

function getArticleEntitySignature(article) {
  const haystack = getArticleSignalText(article);
  const entityKeywords = ["trump", "passport", "design", "id", "identity", "license", "licence", "visa"];
  return entityKeywords.filter((keyword) => textMatchesKeyword(haystack, keyword)).sort().join("|");
}

function getNormalizedGroupingText(article) {
  return getCachedArticleValue(article, "normalizedGroupingText", () =>
    [
      article?.title || "",
      article?.summary || "",
      article?.description || "",
      article?.source || "",
      article?.topic || "",
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
  );
}

function getDetectedEventEntity(article) {
  return getCachedArticleValue(article, "detectedEventEntity", () => {
    const feed = state.feeds.find((item) => item.id === article?.feedId);
    const feedCountry = normalizeCountry(article?.country || article?.region || getFeedCountry(feed));
    if (feedCountry) {
      return feedCountry;
    }

    const text = getNormalizedGroupingText(article);
    const matchedEntity = GROUPING_EVENT_ENTITY_KEYWORDS.find(([, keywords]) =>
      keywords.some((keyword) => textMatchesKeyword(text, keyword))
    );

    return matchedEntity ? matchedEntity[0] : "";
  });
}

function getMatchingFingerprintKeys(text, definitions) {
  return definitions
    .filter(([, keywords]) => keywords.some((keyword) => textMatchesKeyword(text, keyword)))
    .map(([key]) => key);
}

function getEventFingerprintTimeBucket(article) {
  const publishedAt = toDate(article?.pubDate);
  if (Number.isNaN(publishedAt.getTime())) {
    return "";
  }

  const startOfYear = new Date(Date.UTC(publishedAt.getUTCFullYear(), 0, 1));
  const elapsedDays = Math.floor((publishedAt.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(elapsedDays / 7) + 1;
  return `${publishedAt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getNormalizedEventTimeBucket(article) {
  return getCachedArticleValue(article, "normalizedEventTimeBucket", () => {
    const publishedAt = toDate(article?.pubDate);
    if (Number.isNaN(publishedAt.getTime())) {
      return "";
    }

    return `${publishedAt.getUTCFullYear()}-${String(publishedAt.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function extractCountries(article) {
  return getCachedArticleValue(article, "normalizedCountries", () => {
    const text = getArticleSignalText(article);
    const feed = state.feeds.find((item) => item.id === article?.feedId);
    const feedCountry = normalizeCountry(article?.country || article?.region || getFeedCountry(feed));
    const countries = new Set();

    if (feedCountry) {
      countries.add(feedCountry);
    }

    getMatchingFingerprintKeys(text, GROUPING_EVENT_ENTITY_KEYWORDS)
      .filter((value) => !["ees", "etias", "icao", "ecb", "rbi", "state-department"].includes(value))
      .forEach((value) => countries.add(value));

    [
      ["uk", ["united kingdom", "uk", "britain", "british"]],
      ["us", ["united states", "usa", "us", "american"]],
      ["canada", ["canada", "canadian"]],
      ["india", ["india", "indian"]],
      ["croatia", ["croatia", "croatian"]],
      ["ukraine", ["ukraine", "ukrainian"]],
      ["rwanda", ["rwanda", "rwandan"]],
      ["saudi-arabia", ["saudi arabia", "saudi"]],
      ["eurozone", ["eurozone", "euro area"]],
      ["ecowas", ["ecowas"]],
    ].forEach(([key, keywords]) => {
      if (keywords.some((keyword) => textMatchesKeyword(text, keyword))) {
        countries.add(key);
      }
    });

    return Array.from(countries).filter(Boolean);
  });
}

function normalizeAuthorityValue(value) {
  return normalizeFilterTag(String(value || "").replace(/\s+/g, " ").trim());
}

function extractAuthorities(article) {
  return getCachedArticleValue(article, "normalizedAuthorities", () => {
    const text = getArticleSignalText(article);
    const authorities = new Set(getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_AGENCY_KEYWORDS));
    const authorityPatterns = [
      /\b(?:central|national|reserve) bank(?: of)? [a-z][a-z\s-]{2,50}\b/g,
      /\bbank of [a-z][a-z\s-]{2,50}\b/g,
      /\bministry of interior\b/g,
      /\bstate department\b/g,
      /\bpassport office\b/g,
      /\bimmigration (?:authority|agency|department|service)\b/g,
      /\bborder (?:agency|authority|police|control)\b/g,
      /\bcustoms\b/g,
      /\bnational id authority\b/g,
      /\bsecurity printer\b/g,
      /\bcurrency board\b/g,
    ];

    authorityPatterns.forEach((pattern) => {
      const matches = text.match(pattern) || [];
      matches
        .map((match) => normalizeAuthorityValue(match))
        .filter(Boolean)
        .forEach((match) => authorities.add(match));
    });

    return Array.from(authorities);
  });
}

function extractDenominations(article) {
  return getCachedArticleValue(article, "normalizedDenominations", () => {
    const text = getArticleSignalText(article);
    return Array.from(new Set(
      (text.match(/\b\d{1,4}(?:[.,]\d{1,2})?\s*(?:euro|euros|lev|leva|rupee|rupees|pound|pounds|dollar|dollars|hryvnia|rial|rials|peso|pesos|taka|naira|krone|krona)\b/gi) || [])
        .map((value) => value.toLowerCase())
    ));
  });
}

function extractCurrencies(article) {
  return getCachedArticleValue(article, "normalizedCurrencies", () => {
    const text = getArticleSignalText(article);
    const currencies = new Set(getMatchingFingerprintKeys(text, INTELLIGENCE_CURRENCY_KEYWORDS));

    extractDenominations(article).forEach((value) => {
      const currencyMatch = value.match(/(euro|euros|lev|leva|rupee|rupees|pound|pounds|dollar|dollars|hryvnia|rial|rials|peso|pesos|taka|naira|krone|krona)$/i);
      if (currencyMatch) {
        currencies.add(normalizeFilterTag(currencyMatch[1]));
      }
    });

    if (textMatchesKeyword(text, "euro area")) {
      currencies.add("euro");
    }

    return Array.from(currencies);
  });
}

function extractDocumentSystems(article) {
  return getCachedArticleValue(article, "normalizedSystems", () => {
    const text = getArticleSignalText(article);
    const systems = new Set(getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_SYSTEM_KEYWORDS));
    const systemAliases = [
      ["ees", ["ees", "entry exit system", "entry/exit system"]],
      ["etias", ["etias"]],
      ["icao", ["icao", "travel document security", "mrz"]],
      ["digital-id", ["digital id", "digital identity", "government identity system"]],
      ["eid", ["eid", "electronic id"]],
      ["kyc", ["kyc", "know your customer"]],
      ["biometric-border-checks", ["biometric border checks", "biometric checks", "airport biometric system"]],
      ["passport-office", ["passport office", "passport services"]],
      ["national-id", ["national id", "identity card", "national identity system"]],
      ["residence-permit", ["residence permit"]],
      ["document-verification", ["identity verification", "document verification", "nfc verification"]],
    ];

    systemAliases.forEach(([key, keywords]) => {
      if (keywords.some((keyword) => textMatchesKeyword(text, keyword))) {
        systems.add(key);
      }
    });

    return Array.from(systems);
  });
}

function extractActionTerms(article) {
  return getCachedArticleValue(article, "normalizedActions", () => {
    const text = getArticleSignalText(article);
    const actions = new Set(getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_ACTION_KEYWORDS));
    const canonicalActions = [
      ["delay", ["delay", "delays", "queue", "queues", "backlog", "technical problem", "technical outage"]],
      ["rollout", ["rollout", "rolled out", "launch", "launched", "go-live", "implemented", "deployment"]],
      ["exemption", ["exemption", "exempt", "waiver"]],
      ["suspension", ["suspension", "suspended", "halted", "paused"]],
      ["revocation", ["revocation", "revoked", "cancelled", "withdrawn passport"]],
      ["issuance", ["issuance", "issued", "issue passports", "passport issuance"]],
      ["renewal", ["renewal", "renewed", "passport renewal"]],
      ["warning", ["warning", "warns", "alert", "advisory"]],
      ["law-update", ["law", "regulation", "policy", "directive", "bill", "amendment"]],
      ["withdrawal", ["withdrawal", "withdrawn", "withdrawn from circulation", "exchange deadline", "retired"]],
      ["demonetisation", ["demonetisation", "demonetization", "cease legal tender", "no longer legal tender"]],
      ["redesign", ["redesign", "redesigned", "new design", "new artwork", "portrait change"]],
      ["migration", ["migration", "transition", "polymer migration", "substrate migration"]],
      ["counterfeit", ["counterfeit", "fake notes", "forged notes", "forged passport", "fake passport"]],
      ["production", ["printing", "production", "security printer", "manufacturing"]],
      ["rollout-delay", ["rollout delay", "implementation delay"]],
    ];

    canonicalActions.forEach(([action, keywords]) => {
      if (keywords.some((keyword) => textMatchesKeyword(text, keyword))) {
        actions.add(action);
      }
    });

    return Array.from(actions);
  });
}

function getNormalizedEventRegion(article, countries = []) {
  return getCachedArticleValue(article, "normalizedRegion", () => {
    const explicitRegion = normalizeCountry(article?.region || "");
    if (explicitRegion) {
      return explicitRegion;
    }

    if (countries.includes("eurozone")) {
      return "europe";
    }

    if (countries.includes("ecowas")) {
      return "west-africa";
    }

    return "";
  });
}

function getNormalizedDocumentType(article, domain) {
  return getCachedArticleValue(article, `normalizedDocumentType:${domain}`, () => {
    const text = getArticleSignalText(article);
    if (domain === "banknote") {
      return "banknote";
    }

    if (textMatchesKeyword(text, "passport") || textMatchesKeyword(text, "e-passport") || textMatchesKeyword(text, "biometric passport")) {
      return "passport";
    }

    if (textMatchesKeyword(text, "identity card") || textMatchesKeyword(text, "national id") || textMatchesKeyword(text, "id card")) {
      return "identity-card";
    }

    if (textMatchesKeyword(text, "driver license") || textMatchesKeyword(text, "driver licence")) {
      return "driver-license";
    }

    if (textMatchesKeyword(text, "residence permit")) {
      return "residence-permit";
    }

    if (textMatchesKeyword(text, "travel document")) {
      return "travel-document";
    }

    if (textMatchesKeyword(text, "digital id") || textMatchesKeyword(text, "eid")) {
      return "digital-id";
    }

    return "";
  });
}

function getNormalizedOperationalContext(article, context) {
  return getCachedArticleValue(article, "normalizedOperationalContext", () => {
    const text = getArticleSignalText(article);
    const { systems = [], actions = [], authorities = [], countries = [] } = context;

    if (textMatchesKeyword(text, "child support") || textMatchesKeyword(text, "alimony debt")) {
      return "child_support_debt";
    }

    if (textMatchesKeyword(text, "identity theft")) {
      return "identity_theft";
    }

    if (systems.includes("ees")) {
      if (actions.includes("delay") || actions.includes("rollout-delay")) {
        return "technical_delay";
      }
      if (actions.includes("exemption")) {
        return "exemption";
      }
      if (actions.includes("suspension")) {
        return "suspension";
      }
      if (actions.includes("rollout")) {
        return "rollout";
      }
    }

    if (systems.includes("etias")) {
      if (actions.includes("delay") || actions.includes("rollout-delay")) {
        return "technical_delay";
      }
      if (actions.includes("rollout")) {
        return "rollout";
      }
    }

    if (systems.includes("airport-disruption") || textMatchesKeyword(text, "airport")) {
      return "airport_operations";
    }

    if (actions.includes("counterfeit") || textMatchesKeyword(text, "counterfeit")) {
      return "counterfeit_alert";
    }

    if (actions.includes("warning") && authorities.some((authority) => authority.includes("bank") || authority.includes("authority"))) {
      return "official_warning";
    }

    if (actions.includes("migration")) {
      return "substrate_migration";
    }

    if (actions.includes("redesign")) {
      return "design_refresh";
    }

    if (countries.includes("eurozone")) {
      return "regional_policy";
    }

    return "";
  });
}

function getNormalizedAction(article, context) {
  return getCachedArticleValue(article, "normalizedPrimaryAction", () => {
    const { actions = [], canonicalEventType = "" } = context;
    if (!actions.length) {
      if (canonicalEventType === "demonetisation") {
        return "demonetisation";
      }
      return "";
    }

    if (actions.includes("demonetisation")) {
      return "demonetisation";
    }
    if (actions.includes("withdrawal")) {
      return "withdrawal";
    }
    if (actions.includes("rollout-delay") || actions.includes("delay")) {
      return "delay";
    }
    if (actions.includes("rollout")) {
      return "rollout";
    }
    if (actions.includes("revocation")) {
      return "revocation";
    }
    if (actions.includes("law-update")) {
      return "law-update";
    }
    if (actions.includes("counterfeit")) {
      return "counterfeit";
    }
    if (actions.includes("migration")) {
      return "migration";
    }
    if (actions.includes("redesign")) {
      return "redesign";
    }
    if (actions.includes("issuance")) {
      return "issuance";
    }
    if (actions.includes("renewal")) {
      return "renewal";
    }
    if (actions.includes("warning")) {
      return "warning";
    }
    if (actions.includes("suspension")) {
      return "suspension";
    }
    if (actions.includes("exemption")) {
      return "exemption";
    }
    if (actions.includes("production")) {
      return "production";
    }

    return actions[0] || "";
  });
}

function getNormalizedPrimaryEntity(domain, { countries = [], authorities = [], systems = [], currencies = [], denominations = [], documentType = "" }) {
  if (domain === "banknote") {
    return authorities[0] || currencies[0] || countries[0] || denominations[0] || documentType || "";
  }

  if (domain === "border_system") {
    return systems[0] || authorities[0] || countries[0] || "";
  }

  if (domain === "digital_identity") {
    return systems[0] || authorities[0] || countries[0] || documentType || "";
  }

  if (domain === "passport" || domain === "identity_document") {
    return authorities[0] || systems[0] || countries[0] || documentType || "";
  }

  return authorities[0] || countries[0] || systems[0] || currencies[0] || documentType || "";
}

function resolveIdentityCanonicalEventType(article, context) {
  const text = getArticleSignalText(article);
  const detailedEventType = getDetailedArticleEventType(article);
  const { systems = [], actions = [] } = context;

  if (systems.includes("ees")) {
    return "ees_event";
  }

  if (systems.includes("etias")) {
    return "etias_event";
  }

  if (textMatchesKeyword(text, "identity theft")) {
    return "identity_theft";
  }

  if (
    detailedEventType === "passport_fraud" ||
    systems.includes("passport-fraud") ||
    textMatchesKeyword(text, "passport fraud")
  ) {
    return textMatchesKeyword(text, "forged passport") || textMatchesKeyword(text, "fake passport")
      ? "forged_document"
      : "passport_fraud";
  }

  if (textMatchesKeyword(text, "passport revocation") || actions.includes("revocation") || textMatchesKeyword(text, "child support")) {
    return "passport_revocation";
  }

  if (systems.includes("citizenship-law") || textMatchesKeyword(text, "citizenship law") || textMatchesKeyword(text, "nationality law")) {
    return "citizenship_law";
  }

  if (systems.includes("visa-waiver") || textMatchesKeyword(text, "visa policy") || textMatchesKeyword(text, "visa requirement")) {
    return "visa_policy";
  }

  if (actions.includes("delay") || actions.includes("rollout-delay") || textMatchesKeyword(text, "border delay")) {
    return "border_delay";
  }

  if (actions.includes("rollout") && (systems.includes("biometric-checks") || systems.includes("border-checks") || systems.includes("digital-id"))) {
    return "border_rollout";
  }

  if (systems.includes("biometric-checks") || textMatchesKeyword(text, "biometric border checks")) {
    return "biometric_border_check";
  }

  if (actions.includes("issuance") || systems.includes("passport-issuance")) {
    return "passport_issuance";
  }

  if (actions.includes("renewal")) {
    return "passport_renewal";
  }

  if (textMatchesKeyword(text, "travel advisory") || textMatchesKeyword(text, "entry requirements")) {
    return "travel_advisory";
  }

  if ((textMatchesKeyword(text, "digital id") || textMatchesKeyword(text, "eid") || textMatchesKeyword(text, "kyc")) && actions.includes("law-update")) {
    return "digital_id_regulation";
  }

  if (systems.includes("digital-id") || systems.includes("eid") || systems.includes("kyc") || systems.includes("national-id")) {
    return "identity_infrastructure";
  }

  if (systems.includes("icao") || systems.includes("document-verification") || textMatchesKeyword(text, "mrz")) {
    return "document_security_technology";
  }

  return "other";
}

function resolveBanknoteCanonicalEventType(article, context) {
  const text = getArticleSignalText(article);
  const detailedEventType = getDetailedArticleEventType(article);
  const { actions = [], authorities = [] } = context;

  if (detailedEventType === "banknote_auction_noise") {
    return "collector_noise";
  }

  if (detailedEventType === "counterfeit_banknotes" || actions.includes("counterfeit")) {
    return "counterfeit_banknotes";
  }

  if (detailedEventType === "banknote_withdrawal" || actions.includes("withdrawal")) {
    return actions.includes("demonetisation") || textMatchesKeyword(text, "demonetisation") || textMatchesKeyword(text, "demonetization")
      ? "demonetisation"
      : "banknote_withdrawal";
  }

  if (detailedEventType === "banknote_new_design") {
    return "banknote_redesign";
  }

  if (detailedEventType === "banknote_new_series") {
    return "new_banknote_series";
  }

  if (detailedEventType === "commemorative_note") {
    return "commemorative_issue";
  }

  if (detailedEventType === "polymer_transition") {
    return textMatchesKeyword(text, "polymer") || textMatchesKeyword(text, "substrate") || actions.includes("migration")
      ? "polymer_migration"
      : "security_feature_update";
  }

  if (
    authorities.some((authority) => authority.includes("bank")) &&
    (actions.includes("warning") || textMatchesKeyword(text, "central bank warning") || textMatchesKeyword(text, "warned the public"))
  ) {
    return "central_bank_warning";
  }

  if (
    textMatchesKeyword(text, "circulation") ||
    textMatchesKeyword(text, "legal tender") ||
    textMatchesKeyword(text, "replacement series")
  ) {
    return "circulation_policy";
  }

  if (
    actions.includes("production") ||
    authorities.some((authority) =>
      ["de-la-rue", "giesecke-devrient", "crane-currency", "oberthur", "sicpa"].some((keyword) => authority.includes(keyword))
    )
  ) {
    return "banknote_production";
  }

  return "other";
}

function getNormalizedEventConfidence(normalizedEvent) {
  let score = 0;

  if (normalizedEvent.domain && normalizedEvent.domain !== "other") {
    score += 1;
  }
  if (normalizedEvent.canonicalEventType && normalizedEvent.canonicalEventType !== "other" && normalizedEvent.canonicalEventType !== "collector_noise") {
    score += 2;
  }
  if (normalizedEvent.primaryEntity) {
    score += 1;
  }
  if (normalizedEvent.country || normalizedEvent.currency) {
    score += 1;
  }
  if (normalizedEvent.authority || normalizedEvent.secondaryEntities.length) {
    score += 1;
  }
  if (normalizedEvent.action) {
    score += 1;
  }
  if (normalizedEvent.operationalContext) {
    score += 1;
  }

  if (score >= 6) {
    return "high";
  }
  if (score >= 4) {
    return "medium";
  }
  return "low";
}

function normalizeIntelligenceEvent(article) {
  return getCachedArticleValue(article, "normalizedIntelligenceEvent", () => {
    const topicType = getArticleTopicType(article);
    const countries = extractCountries(article);
    const authorities = extractAuthorities(article);
    const systems = extractDocumentSystems(article);
    const actions = extractActionTerms(article);
    const currencies = extractCurrencies(article);
    const denominations = extractDenominations(article);
    const detailedEventType = getDetailedArticleEventType(article);
    let domain = "other";

    if (topicType === "banknote") {
      domain = "banknote";
    } else if (systems.includes("ees") || systems.includes("etias") || systems.includes("biometric-border-checks") || systems.includes("border-checks") || systems.includes("airport-disruption")) {
      domain = "border_system";
    } else if (topicType === "travel_passport") {
      domain = "passport";
    } else if (topicType === "digital_identity") {
      domain = "digital_identity";
    } else if (topicType === "identity_document" || topicType === "dmv_driver_license") {
      domain = "identity_document";
    } else if (detailedEventType === "passport_fraud" || detailedEventType === "counterfeit_banknotes") {
      domain = "fraud_security";
    }

    const documentType = getNormalizedDocumentType(article, domain);
    const canonicalEventType = domain === "banknote"
      ? resolveBanknoteCanonicalEventType(article, { actions, authorities, countries, currencies, denominations })
      : resolveIdentityCanonicalEventType(article, { systems, actions, authorities, countries });
    const action = getNormalizedAction(article, { actions, canonicalEventType });
    const operationalContext = getNormalizedOperationalContext(article, {
      systems,
      actions,
      authorities,
      countries,
    });
    const country = countries[0] || "";
    const region = getNormalizedEventRegion(article, countries);
    const authority = authorities[0] || "";
    const currency = currencies[0] || "";
    const denomination = denominations[0] || "";
    const primaryEntity = getNormalizedPrimaryEntity(domain, {
      countries,
      authorities,
      systems,
      currencies,
      denominations,
      documentType,
    });
    const secondaryEntities = Array.from(new Set([
      ...countries,
      ...authorities,
      ...systems,
      ...currencies,
      ...denominations,
    ].filter((value) => value && value !== primaryEntity))).slice(0, 6);

    const normalizedEvent = {
      domain,
      canonicalEventType,
      primaryEntity,
      secondaryEntities,
      country,
      region,
      authority,
      documentType,
      currency,
      denomination,
      action,
      operationalContext,
      timeBucket: getNormalizedEventTimeBucket(article),
      confidence: "low",
    };

    normalizedEvent.confidence = getNormalizedEventConfidence(normalizedEvent);
    return normalizedEvent;
  });
}

function getCanonicalEventClusterKey(article) {
  return getCachedArticleValue(article, "canonicalEventClusterKey", () => {
    const normalizedEvent = normalizeIntelligenceEvent(article);
    if (
      !normalizedEvent ||
      normalizedEvent.confidence === "low" ||
      !normalizedEvent.domain ||
      normalizedEvent.domain === "other" ||
      !normalizedEvent.canonicalEventType ||
      normalizedEvent.canonicalEventType === "other"
    ) {
      return "";
    }

    const entity = normalizedEvent.primaryEntity || normalizedEvent.country || normalizedEvent.currency || "generic";
    const anchor = normalizedEvent.authority
      || normalizedEvent.secondaryEntities.find((value) => value !== entity)
      || normalizedEvent.documentType
      || "generic";
    const action = normalizedEvent.action || normalizedEvent.operationalContext || "generic";
    const timeBucket = normalizedEvent.timeBucket || "undated";

    return [
      normalizedEvent.domain,
      normalizedEvent.canonicalEventType,
      entity,
      anchor,
      action,
      timeBucket,
    ].join(":");
  });
}

function extractEventEntities(article) {
  return getCachedArticleValue(article, "eventEntities", () => {
    const text = getNormalizedGroupingText(article);
    const normalizedEvent = normalizeIntelligenceEvent(article);
    const countries = Array.from(new Set([
      normalizedEvent.country,
      getDetectedEventEntity(article),
      ...extractCountries(article),
    ].filter(Boolean)));
    const agencies = Array.from(new Set([
      normalizedEvent.authority,
      ...extractAuthorities(article),
    ].filter(Boolean)));
    const systems = Array.from(new Set([
      ...extractDocumentSystems(article),
      ...getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_SYSTEM_KEYWORDS),
    ]));
    const subjects = Array.from(new Set(getMatchingFingerprintKeys(text, INTELLIGENCE_EVENT_SUBJECT_KEYWORDS)));
    const currencies = Array.from(new Set([
      normalizedEvent.currency,
      ...extractCurrencies(article),
    ].filter(Boolean)));
    const denominationMatches = Array.from(new Set([
      normalizedEvent.denomination,
      ...extractDenominations(article),
    ].filter(Boolean)));

    return {
      countries,
      agencies,
      systems,
      subjects,
      currencies,
      denominations: denominationMatches,
    };
  });
}

function getEventClusterKey(article) {
  return getCachedArticleValue(article, "eventClusterKey", () => {
    return getCanonicalEventClusterKey(article);
  });
}

function getGroupingConfidenceLevel({ score = 0, strongAnchorCount = 0, sharedKeywords = 0 }) {
  if (score >= 12 && strongAnchorCount >= 2) {
    return "high";
  }

  if (score >= 9 && strongAnchorCount >= 1 && sharedKeywords >= 1) {
    return "medium";
  }

  return "low";
}

function extractEventFingerprint(article) {
  return getCachedArticleValue(article, "eventFingerprint", () => {
    const text = getNormalizedGroupingText(article);
    const normalizedEvent = normalizeIntelligenceEvent(article);
    const countries = Array.from(new Set([
      normalizedEvent.country,
      ...extractCountries(article),
      getDetectedEventEntity(article),
    ].filter(Boolean)));
    const agencies = Array.from(new Set([
      normalizedEvent.authority,
      ...extractAuthorities(article),
    ].filter(Boolean)));
    const systems = Array.from(new Set([
      ...extractDocumentSystems(article),
      ...getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_SYSTEM_KEYWORDS),
    ]));
    const actionType = normalizedEvent.action
      || extractActionTerms(article)[0]
      || getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_ACTION_KEYWORDS)[0]
      || getDetailedArticleEventType(article)
      || "";
    const subjectType = normalizedEvent.canonicalEventType
      || getMatchingFingerprintKeys(text, EVENT_FINGERPRINT_SUBJECT_KEYWORDS)[0]
      || (getPrimaryPassportSubject(article) !== "unrelated" ? getPrimaryPassportSubject(article) : getDetailedArticleEventType(article) || "");
    const timeBucket = normalizedEvent.timeBucket || getEventFingerprintTimeBucket(article);
    const keywords = Array.from(new Set([
      ...getEventSpecificTerms(article, normalizedEvent.primaryEntity || countries[0] || agencies[0] || "", 4),
      ...normalizedEvent.secondaryEntities.slice(0, 2),
    ])).filter(Boolean).slice(0, 4);

    const fingerprint = {
      countries,
      agencies,
      systems,
      actionType,
      subjectType,
      timeBucket,
      keywords,
    };

    intelligenceDebug("[event-fingerprint]", {
      title: article?.title || "Untitled article",
      countries,
      systems,
      actionType,
      subjectType,
    });

    return fingerprint;
  });
}

function getFingerprintIntersection(leftValues, rightValues) {
  const rightSet = new Set(rightValues);
  return leftValues.filter((value) => rightSet.has(value));
}

function getEventFingerprintMatch(leftArticle, rightArticle) {
  return getCachedArticlePairValue(leftArticle, rightArticle, "eventFingerprintMatch", () => {
    const leftFingerprint = extractEventFingerprint(leftArticle);
    const rightFingerprint = extractEventFingerprint(rightArticle);
    const leftNormalizedEvent = normalizeIntelligenceEvent(leftArticle);
    const rightNormalizedEvent = normalizeIntelligenceEvent(rightArticle);
    let score = 0;

    if (leftNormalizedEvent.domain && rightNormalizedEvent.domain) {
      score += leftNormalizedEvent.domain === rightNormalizedEvent.domain ? 4 : -8;
    }

    if (leftNormalizedEvent.canonicalEventType && rightNormalizedEvent.canonicalEventType) {
      score += leftNormalizedEvent.canonicalEventType === rightNormalizedEvent.canonicalEventType ? 6 : -10;
    }

    const sharedCountries = getFingerprintIntersection(leftFingerprint.countries, rightFingerprint.countries);
    if (sharedCountries.length) {
      score += 4;
    } else if (leftFingerprint.countries.length && rightFingerprint.countries.length) {
      score -= 6;
    }

    const sharedAgencies = getFingerprintIntersection(leftFingerprint.agencies, rightFingerprint.agencies);
    if (sharedAgencies.length) {
      score += 3;
    }

    const sharedSystems = getFingerprintIntersection(leftFingerprint.systems, rightFingerprint.systems);
    if (sharedSystems.length) {
      score += 4;
    } else if (leftFingerprint.systems.length && rightFingerprint.systems.length) {
      score -= 5;
    }

    if (leftFingerprint.actionType && rightFingerprint.actionType) {
      score += leftFingerprint.actionType === rightFingerprint.actionType ? 3 : -4;
    }

    if (leftFingerprint.subjectType && rightFingerprint.subjectType) {
      score += leftFingerprint.subjectType === rightFingerprint.subjectType ? 3 : -4;
    }

    const sharedKeywords = getFingerprintIntersection(leftFingerprint.keywords, rightFingerprint.keywords);
    if (sharedKeywords.length) {
      score += 2;
    } else if (leftFingerprint.keywords.length && rightFingerprint.keywords.length) {
      score -= 2;
    }

    if (leftNormalizedEvent.primaryEntity && rightNormalizedEvent.primaryEntity) {
      score += leftNormalizedEvent.primaryEntity === rightNormalizedEvent.primaryEntity ? 4 : -5;
    }

    if (leftNormalizedEvent.authority && rightNormalizedEvent.authority) {
      score += leftNormalizedEvent.authority === rightNormalizedEvent.authority ? 3 : -4;
    }

    if (leftNormalizedEvent.currency && rightNormalizedEvent.currency) {
      score += leftNormalizedEvent.currency === rightNormalizedEvent.currency ? 3 : -4;
    }

    if (leftNormalizedEvent.denomination && rightNormalizedEvent.denomination) {
      score += leftNormalizedEvent.denomination === rightNormalizedEvent.denomination ? 3 : -4;
    }

    const leftDate = toDate(leftArticle?.pubDate);
    const rightDate = toDate(rightArticle?.pubDate);
    if (!Number.isNaN(leftDate.getTime()) && !Number.isNaN(rightDate.getTime())) {
      const dayDiff = Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24);
      if (leftNormalizedEvent.timeBucket && rightNormalizedEvent.timeBucket && leftNormalizedEvent.timeBucket === rightNormalizedEvent.timeBucket) {
        score += 3;
      } else if (leftFingerprint.timeBucket && rightFingerprint.timeBucket && leftFingerprint.timeBucket === rightFingerprint.timeBucket) {
        score += 2;
      } else if (dayDiff <= 10) {
        score += 2;
      } else if (dayDiff > 21) {
        score -= 4;
      } else if (dayDiff > 45) {
        score -= 2;
      }
    }

    const strongAnchorCount =
      Number(Boolean(sharedCountries.length)) +
      Number(Boolean(sharedAgencies.length)) +
      Number(Boolean(sharedSystems.length)) +
      Number(Boolean(leftNormalizedEvent.primaryEntity && leftNormalizedEvent.primaryEntity === rightNormalizedEvent.primaryEntity));
    const confidence = getGroupingConfidenceLevel({
      score,
      strongAnchorCount,
      sharedKeywords: sharedKeywords.length,
    });
    const isTrumpPassportCluster =
      getIdentityEventKey(leftArticle) === "identity_trump_passport_release" &&
      getIdentityEventKey(rightArticle) === "identity_trump_passport_release";
    const grouped = confidence === "high" || (isTrumpPassportCluster && score >= 8);
    return {
      grouped,
      score,
      confidence,
      strongAnchorCount,
      sharedCountries,
      sharedAgencies,
      sharedSystems,
      sharedKeywords,
      leftFingerprint,
      rightFingerprint,
    };
  });
}

function isSameEventFingerprint(leftArticle, rightArticle) {
  return getEventFingerprintMatch(leftArticle, rightArticle).grouped;
}

function isSameIntelligenceEvent(leftArticle, rightArticle) {
  return getCachedArticlePairValue(leftArticle, rightArticle, "sameIntelligenceEvent", () => {
    const leftClusterKey = getEventClusterKey(leftArticle);
    const rightClusterKey = getEventClusterKey(rightArticle);
    if (leftClusterKey && rightClusterKey && leftClusterKey !== rightClusterKey) {
      return false;
    }

    const conflictReason = getConflictReason(leftArticle, rightArticle);
    if (conflictReason) {
      return false;
    }

    const leftNormalizedEvent = normalizeIntelligenceEvent(leftArticle);
    const rightNormalizedEvent = normalizeIntelligenceEvent(rightArticle);
    if (
      leftNormalizedEvent.domain &&
      rightNormalizedEvent.domain &&
      leftNormalizedEvent.domain !== rightNormalizedEvent.domain
    ) {
      return false;
    }

    if (
      leftNormalizedEvent.canonicalEventType &&
      rightNormalizedEvent.canonicalEventType &&
      leftNormalizedEvent.canonicalEventType !== rightNormalizedEvent.canonicalEventType
    ) {
      return false;
    }

    const fingerprintMatch = getEventFingerprintMatch(leftArticle, rightArticle);
    return fingerprintMatch.grouped && fingerprintMatch.confidence === "high";
  });
}

function getArticleEventType(article) {
  const text = getArticleSignalText(article);
  if (!text) {
    return "other";
  }

  if (["outage", "down", "unavailable", "service disruption", "service outage"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "service outage";
  }

  if (["tender", "procurement", "request for proposal", "rfp", "bid"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "tender/procurement";
  }

  if (["fraud", "counterfeit", "fake", "forged", "forgery", "scam"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "fraud/counterfeit";
  }

  if (["rollout", "rolled out", "launch", "launched", "deployed", "implemented"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "rollout";
  }

  if (["law", "regulation", "mandate", "policy", "directive", "compliance"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "regulation";
  }

  if (["security feature", "security features", "hologram", "watermark", "breach", "vulnerability"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "security";
  }

  if (["redesign", "redesigned", "new design", "new series", "new family", "portrait", "motif"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "design";
  }

  if (["digital id", "identity verification", "nfc", "chip", "platform", "verification system", "biometric system"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "technology";
  }

  if (["issued", "released", "unveiled", "introduced"].some((keyword) => textMatchesKeyword(text, keyword))) {
    return "release";
  }

  return "other";
}

function getEventSpecificTerms(article, entity = "", limit = 2) {
  const entityParts = new Set(String(entity || "").split(/[-\s]+/).filter(Boolean));
  const tokens = getNormalizedGroupingText(article)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 3)
    .filter((token) => !ARTICLE_FINGERPRINT_STOP_WORDS.has(token))
    .filter((token) => !GROUPING_GENERIC_TOPIC_WORDS.has(token))
    .filter((token) => !entityParts.has(token));

  return Array.from(new Set(tokens)).slice(0, limit);
}

function getDetailedArticleEventType(article) {
  return String(
    article?._intelligence?.eventType ||
      article?.eventType ||
      getArticleEventTypeForTopic(article, getArticleTopicType(article)) ||
      ""
  ).trim();
}

function getArticleGroupingTopicFamily(article) {
  const topicType = getArticleTopicType(article);
  switch (topicType) {
    case "banknote":
      return "banknote";
    case "travel_passport":
      return "travel_passport";
    case "identity_document":
    case "digital_identity":
    case "dmv_driver_license":
      return "identity_document";
    default:
      return "noise";
  }
}

function getBanknoteSignatureGroupingTerms(article, entity = "") {
  const text = getNormalizedGroupingText(article);
  const denominationMatch = text.match(/\b(\d{1,4}(?:[.,]\d{1,2})?)\s*(peso|pesos|taka|rupee|rupees|dollar|dollars|euro|euros|quetzal|quetzales|dinar|dinars|leu|lei|naira|pound|pounds|rand)\b/i);
  const yearMatches = Array.from(new Set(text.match(/\b20\d{2}\b/g) || [])).slice(0, 2);
  const entityParts = String(entity || "").split(/[-\s]+/).filter(Boolean);

  const parts = [];
  if (denominationMatch) {
    parts.push(`${denominationMatch[1]}-${denominationMatch[2].toLowerCase()}`);
  }
  parts.push(...yearMatches);

  if (!parts.length) {
    parts.push(...getEventSpecificTerms(article, entityParts.join(" "), 2));
  }

  return Array.from(new Set(parts)).slice(0, 3);
}

function getBanknoteGroupingAnchors(article) {
  const normalizedEvent = normalizeIntelligenceEvent(article);
  const text = getNormalizedGroupingText(article);
  const entity = normalizedEvent.country || getBanknoteEventCountry(article) || getDetectedEventEntity(article) || "";
  const denominationMatch = text.match(/\b(\d{1,4}(?:[.,]\d{1,2})?)\s*(peso|pesos|taka|rupee|rupees|dollar|dollars|euro|euros|quetzal|quetzales|dinar|dinars|leu|lei|naira|pound|pounds|rand|lev|leva)\b/i);
  const yearMatches = Array.from(new Set(text.match(/\b20\d{2}\b/g) || [])).slice(0, 2);
  return {
    entity,
    denomination: normalizedEvent.denomination || (denominationMatch ? `${denominationMatch[1]}-${String(denominationMatch[2]).toLowerCase()}` : ""),
    yearFamily: yearMatches.join("-"),
    eventType: normalizedEvent.canonicalEventType || getDetailedArticleEventType(article),
  };
}

function getIdentityGroupingAnchors(article) {
  const normalizedEvent = normalizeIntelligenceEvent(article);
  return {
    entity: normalizedEvent.country || normalizedEvent.primaryEntity || getDetectedEventEntity(article) || "",
    eventType: normalizedEvent.canonicalEventType || getDetailedArticleEventType(article),
  };
}

function getConflictReason(leftArticle, rightArticle) {
  const leftEventKey = getIdentityEventKey(leftArticle);
  const rightEventKey = getIdentityEventKey(rightArticle);
  if (leftEventKey === "identity_trump_passport_release" && rightEventKey === "identity_trump_passport_release") {
    return "";
  }

  const leftNormalizedEvent = normalizeIntelligenceEvent(leftArticle);
  const rightNormalizedEvent = normalizeIntelligenceEvent(rightArticle);
  if (leftNormalizedEvent.domain !== rightNormalizedEvent.domain) {
    return "different normalized domain";
  }

  if (leftNormalizedEvent.canonicalEventType !== rightNormalizedEvent.canonicalEventType) {
    return "different canonical event type";
  }

  if (leftNormalizedEvent.action && rightNormalizedEvent.action && leftNormalizedEvent.action !== rightNormalizedEvent.action) {
    return "different normalized action";
  }

  const leftTopicFamily = getArticleGroupingTopicFamily(leftArticle);
  const rightTopicFamily = getArticleGroupingTopicFamily(rightArticle);
  if (leftTopicFamily !== rightTopicFamily) {
    return "different topic family";
  }

  const leftEventType = leftNormalizedEvent.canonicalEventType || getDetailedArticleEventType(leftArticle);
  const rightEventType = rightNormalizedEvent.canonicalEventType || getDetailedArticleEventType(rightArticle);
  if (leftEventType !== rightEventType) {
    return "different event type";
  }

  if (leftTopicFamily === "travel_passport" || leftTopicFamily === "identity_document") {
    const leftIsRealTravelDocument = isRealTravelDocumentArticle(leftArticle);
    const rightIsRealTravelDocument = isRealTravelDocumentArticle(rightArticle);
    const leftRejectedBecauseNoise = isPassportNoiseArticle(leftArticle);
    const rightRejectedBecauseNoise = isPassportNoiseArticle(rightArticle);
    const leftConfidence = getGovernmentDocumentConfidence(leftArticle);
    const rightConfidence = getGovernmentDocumentConfidence(rightArticle);
    const leftLowRelevance = isLowRelevancePassportArticle(leftArticle);
    const rightLowRelevance = isLowRelevancePassportArticle(rightArticle);

    intelligenceDebug("[grouping validation]", {
      title: leftArticle?.title || "Untitled article",
      eventType: leftEventType,
      isRealTravelDocument: leftIsRealTravelDocument,
      rejectedBecauseNoise: leftRejectedBecauseNoise,
    });

    intelligenceDebug("[grouping validation]", {
      title: rightArticle?.title || "Untitled article",
      eventType: rightEventType,
      isRealTravelDocument: rightIsRealTravelDocument,
      rejectedBecauseNoise: rightRejectedBecauseNoise,
    });

    if (leftIsRealTravelDocument !== rightIsRealTravelDocument) {
      return "real vs noise passport domain mismatch";
    }

    if (Math.abs(leftConfidence - rightConfidence) > 6) {
      return "government-document confidence mismatch";
    }

    if (leftLowRelevance !== rightLowRelevance) {
      return "identity-document relevance mismatch";
    }

    if (
      leftEventType === "passport_noise" ||
      rightEventType === "passport_noise"
    ) {
      return "passport noise is isolated";
    }

    const leftAnchors = getIdentityGroupingAnchors(leftArticle);
    const rightAnchors = getIdentityGroupingAnchors(rightArticle);
    if (leftAnchors.entity && rightAnchors.entity && leftAnchors.entity !== rightAnchors.entity) {
      return "different passport entity";
    }
  }

  if (leftTopicFamily === "banknote") {
    if (
      leftEventType === "banknote_auction_noise" ||
      rightEventType === "banknote_auction_noise"
    ) {
      return "banknote auction noise is isolated";
    }

    const leftAnchors = getBanknoteGroupingAnchors(leftArticle);
    const rightAnchors = getBanknoteGroupingAnchors(rightArticle);

    if (leftAnchors.entity && rightAnchors.entity && leftAnchors.entity !== rightAnchors.entity) {
      return "different banknote entity";
    }

    if (leftEventType === "banknote_signature_change") {
      if (leftAnchors.denomination && rightAnchors.denomination && leftAnchors.denomination !== rightAnchors.denomination) {
        return "different signature-change denomination";
      }

      if (leftAnchors.yearFamily && rightAnchors.yearFamily && leftAnchors.yearFamily !== rightAnchors.yearFamily) {
        return "different signature-change year family";
      }
    }
  }

  const leftTerms = getEventSpecificTerms(leftArticle, getDetectedEventEntity(leftArticle), 3);
  const rightTerms = new Set(getEventSpecificTerms(rightArticle, getDetectedEventEntity(rightArticle), 3));
  const sharedTerms = leftTerms.filter((term) => rightTerms.has(term));
  if (!sharedTerms.length && leftTopicFamily !== "banknote") {
    return "no shared specific event terms";
  }

  const fingerprintMatch = getEventFingerprintMatch(leftArticle, rightArticle);
  intelligenceDebug("[group-score]", {
    titleA: leftArticle?.title || "Untitled article",
    titleB: rightArticle?.title || "Untitled article",
    score: fingerprintMatch.score,
    grouped: fingerprintMatch.grouped,
    confidence: fingerprintMatch.confidence,
  });
  if (fingerprintMatch.strongAnchorCount < 1 && leftTopicFamily !== "banknote") {
    return "missing strong event anchor";
  }

  if (fingerprintMatch.confidence !== "high") {
    return `grouping confidence too low (${fingerprintMatch.confidence})`;
  }

  if (!fingerprintMatch.grouped) {
    return "event fingerprint mismatch";
  }

  return "";
}

function hasConflictingEventSignals(leftArticle, rightArticle) {
  return getCachedArticlePairValue(leftArticle, rightArticle, "conflictReason", () =>
    getConflictReason(leftArticle, rightArticle)
  );
}

function isIdentityLikeArticle(article) {
  const normalizedTopic = normalizeFilterTag(article?.topic || getFeedTopic(article?.feedId) || "");
  if (
    [
      "identity document",
      "passport",
      "driver license",
      "digital identity",
      "travel document",
      "document security",
      "border control",
      "verification",
    ].includes(normalizedTopic)
  ) {
    return true;
  }

  const text = getArticleSignalText(article);
  return [
    "passport",
    "identity document",
    "driver license",
    "digital id",
    "identity verification",
    "smart id",
  ].some((keyword) => textMatchesKeyword(text, keyword));
}

function getBanknoteEventType(article) {
  const text = getArticleSignalText(article);
  if (!text) {
    return "banknote_other";
  }

  if (
    [
      "catalog",
      "shop",
      "for sale",
      "ebay",
      "pmg",
      "pcgs",
      "reddit",
      "tiktok",
      "instagram collection",
      "favorite banknotes",
      "beautiful banknotes",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_auction_noise";
  }

  if (
    [
      "counterfeit",
      "fake banknote",
      "forged banknote",
      "fraud",
      "seizure",
      "fake notes",
      "counterfeit notes",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "counterfeit_banknotes";
  }

  if (
    [
      "new sig/date",
      "new signature",
      "new date",
      "signature date",
      "confirmed",
    ].some((keyword) => textMatchesKeyword(text, keyword)) || BANKNOTE_LOW_PRIORITY_CODE_PATTERN.test(text)
  ) {
    return "banknote_signature_change";
  }

  if (
    [
      "withdrawn",
      "withdrawal",
      "withdrawn from circulation",
      "demonetised",
      "demonetized",
      "out of circulation",
      "no longer legal tender",
      "legal tender until",
      "exchange deadline",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_withdrawal";
  }

  if (
    [
      "new banknote series",
      "new series",
      "new note family",
      "new family",
      "enter circulation",
      "enters circulation",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_new_series";
  }

  if (
    [
      "redesign",
      "redesigned",
      "new design",
      "design unveiled",
      "portrait change",
      "new banknote design",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "banknote_new_design";
  }

  if (
    [
      "commemorative",
      "anniversary note",
      "centennial",
      "honouring",
      "honoring",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "commemorative_note";
  }

  if (
    [
      "security feature",
      "polymer",
      "plastic banknote",
      "substrate",
      "windowed thread",
      "hologram",
    ].some((keyword) => textMatchesKeyword(text, keyword))
  ) {
    return "polymer_transition";
  }

  return "banknote_other";
}

function getArticleEventTypeForTopic(article, topicType = getArticleTopicType(article)) {
  switch (topicType) {
    case "banknote":
      return getBanknoteEventType(article);
    case "travel_passport":
      return getPassportEventType(article);
    case "identity_document":
    case "digital_identity":
    case "dmv_driver_license":
      return getArticleEventType(article);
    default:
      return "noise";
  }
}

function getBanknoteGroupingType(eventType) {
  switch (eventType) {
    case "banknote_signature_change":
    case "banknote_auction_noise":
      return "noise";
    case "banknote_withdrawal":
      return "regulation";
    case "banknote_new_design":
    case "banknote_new_series":
    case "commemorative_note":
      return "design";
    case "polymer_transition":
      return "security";
    case "counterfeit_banknotes":
      return "fraud/counterfeit";
    default:
      return "";
  }
}

function getBanknoteEventCountry(article) {
  const feed = state.feeds.find((item) => item.id === article?.feedId);
  const feedCountry = normalizeCountry(article?.country || article?.region || getFeedCountry(feed));
  if (feedCountry) {
    return feedCountry;
  }

  const text = getArticleSignalText(article);
  if (!text) {
    return "";
  }

  const countryKeywords = [
    ["uk", ["united kingdom", "uk", "britain", "british"]],
    ["us", ["united states", "usa", "us", "american"]],
    ["kazakhstan", ["kazakhstan", "kazakh"]],
    ["bangladesh", ["bangladesh", "bangladeshi", "taka"]],
    ["guatemala", ["guatemala", "quetzal"]],
    ["india", ["india", "indian", "rupee"]],
    ["pakistan", ["pakistan", "pakistani", "rupee"]],
    ["philippines", ["philippines", "philippine", "peso"]],
    ["romania", ["romania", "romanian", "leu"]],
    ["bulgaria", ["bulgaria", "bulgarian", "lev", "leva"]],
    ["denmark", ["denmark", "danish", "krone"]],
    ["eurozone", ["eurozone", "euro area"]],
  ];

  const matchedCountry = countryKeywords.find(([, keywords]) =>
    keywords.some((keyword) => textMatchesKeyword(text, keyword))
  );

  return matchedCountry ? matchedCountry[0] : "";
}

function getIdentityEventKey(article) {
  return getCachedArticleValue(article, "identityEventKey", () => {
    const clusterKey = getEventClusterKey(article);
    if (clusterKey) {
      return clusterKey;
    }

    const normalizedText = [
      article?.title || "",
      article?.summary || "",
      article?.description || "",
      article?.source || "",
    ]
      .join(" ")
      .toLowerCase();

    const hasTrumpPassportReleaseNoise = [
      "caitlyn",
      "jenner",
      "gender",
      "trans",
      "transgender",
      "immigration",
      "shutdown",
      "tsa",
      "study abroad",
      "cuba",
      "oil blockade",
      "population growth",
    ].some((keyword) => normalizedText.includes(keyword));

    const isTrumpPassportReleaseStory =
      normalizedText.includes("trump") &&
      (normalizedText.includes("passport") || normalizedText.includes("passports")) &&
      [
        "design",
        "release",
        "released",
        "unveiled",
        "state department",
        "america250",
        "america 250",
        "250th",
        "commemorative",
        "anniversary",
        "portrait",
        "face",
        "image",
        "signature",
        "patriot passport",
      ].some((keyword) => normalizedText.includes(keyword));

    if (isTrumpPassportReleaseStory && !hasTrumpPassportReleaseNoise) {
      return "identity_trump_passport_release";
    }

    const topicFamily = getArticleGroupingTopicFamily(article);
    const eventType = getDetailedArticleEventType(article);
    const detectedEntity = topicFamily === "banknote" ? getBanknoteEventCountry(article) : getDetectedEventEntity(article);

    if (topicFamily === "banknote") {
      if (!eventType || eventType === "banknote_other" || eventType === "banknote_auction_noise") {
        return getArticleFingerprint(article) || "";
      }

      const banknoteTerms = eventType === "banknote_signature_change"
        ? getBanknoteSignatureGroupingTerms(article, detectedEntity)
        : getEventSpecificTerms(article, detectedEntity, 2);

      if (!detectedEntity && !banknoteTerms.length) {
        return getArticleFingerprint(article) || "";
      }

      return `${topicFamily}-${eventType}-${detectedEntity || "generic"}-${banknoteTerms.join("-") || "generic"}`;
    }

    if (topicFamily === "identity_document" || topicFamily === "travel_passport") {
      if (
        !eventType ||
        eventType === "other" ||
        eventType === "travel_passport_other" ||
        eventType === "passport_noise" ||
        eventType === "noise"
      ) {
        return getArticleFingerprint(article) || "";
      }

      const identityTerms = getEventSpecificTerms(article, detectedEntity, 2);
      if (!detectedEntity && !identityTerms.length) {
        return getArticleFingerprint(article) || "";
      }

      return `${topicFamily}-${eventType}-${detectedEntity || "generic"}-${identityTerms.join("-") || "generic"}`;
    }

    const fingerprint = getArticleFingerprint(article);
    if (!fingerprint) {
      return "";
    }

    const fingerprintTokens = getArticleFingerprintTokens(article);
    const entitySignature = getArticleEntitySignature(article);
    const coreTokens = fingerprintTokens.slice(0, 6).join(" ");
    return entitySignature || coreTokens || fingerprint;
  });
}

function groupArticlesByEvent(articles) {
  intelligenceTime("groupArticlesByEvent");
  const grouped = {};

  articles.forEach((article, index) => {
    const eventKey = getIdentityEventKey(article);
    const key = eventKey || `single_${index}`;

    if (!grouped[key]) {
      grouped[key] = [];
    }

    const matchingGroup = grouped[key].find((group) => {
      const primary = group[0];
      const conflictReason = hasConflictingEventSignals(primary, article);
      if (conflictReason) {
        intelligenceDebug("[grouping conflict]", {
          leftTitle: primary?.title || "Untitled article",
          rightTitle: article?.title || "Untitled article",
          leftEventType: normalizeIntelligenceEvent(primary)?.canonicalEventType || getDetailedArticleEventType(primary),
          rightEventType: normalizeIntelligenceEvent(article)?.canonicalEventType || getDetailedArticleEventType(article),
          reason: conflictReason,
        });
        return false;
      }

      return isSameIntelligenceEvent(primary, article);
    });

    if (matchingGroup) {
      matchingGroup.push(article);
      return;
    }

    grouped[key].push([article]);
  });

  const groupedArticles = Object.values(grouped).flatMap((bucket) => bucket).map((group) => {
    const primary = group[0];
    if (group.length > 1) {
      const firstMatch = group[1] ? getEventFingerprintMatch(primary, group[1]) : null;
      const normalizedEvent = normalizeIntelligenceEvent(primary);
      intelligenceDebug("[grouping]", {
        title: primary?.title || "Untitled article",
        eventType: normalizedEvent?.canonicalEventType || getDetailedArticleEventType(primary),
        entity: normalizedEvent?.primaryEntity || getDetectedEventEntity(primary),
        fingerprint: extractEventFingerprint(primary),
        confidence: firstMatch?.confidence || "high",
        groupedWith: group.slice(1).map((item) => item?.title || "Untitled article"),
        groupedCount: group.length,
      });
    }

    return {
      ...primary,
      sources: group,
      sourceCount: group.length,
      groupedArticlesCount: Math.max(0, group.length - 1),
    };
  });
  intelligenceTimeEnd("groupArticlesByEvent");
  return groupedArticles;
}

function updateArticleFilterContext(articles) {
  if (!elements.articleFilterContext) {
    return;
  }

  const countLabel = getArticleCountLabel(articles.length);
  const exactArticleIds = Array.isArray(state.filters.articleIds) ? state.filters.articleIds : [];

  if (exactArticleIds.length) {
    const alertLabel = state.filters.alertLabel || `${exactArticleIds.length} selected articles`;
    elements.articleFilterContext.textContent = `Showing ${countLabel} from alert: ${alertLabel}`;
    elements.articleFilterContext.hidden = false;
    return;
  }

  const contextParts = [];
  if (state.filters.feedId) {
    contextParts.push(`feed: ${getSelectedOptionText(elements.feedFilter) || "Selected feed"}`);
  }
  if (state.filters.dmvFeedId) {
    contextParts.push(`USA feed: ${getSelectedOptionText(elements.dmvFeedFilter) || "Selected state"}`);
  } else if (state.dashboardMode === "usa") {
    contextParts.push("USA feeds");
  }
  if (state.filters.canadaDmvFeedPath) {
    contextParts.push(`Canada feed: ${getSelectedOptionText(elements.canadaDmvFilter) || "Selected province"}`);
  } else if (state.filters.canadaDmvAll) {
    contextParts.push("all Canada DMV");
  } else if (state.dashboardMode === "canada") {
    contextParts.push("Canada feeds");
  }
  if (state.filters.topic) {
    contextParts.push(`topic: ${state.filters.topic}`);
  }
  if (state.filters.tag) {
    contextParts.push(`tag: ${state.filters.tag}`);
  }
  if (state.filters.signalCategory) {
    contextParts.push(
      `signal: ${getSignalCategoryById(state.filters.signalCategory)?.label || state.filters.signalCategory}`
    );
  }
  if (state.filters.date) {
    contextParts.push(`date: ${state.filters.date}`);
  }
  if (state.filters.search) {
    contextParts.push(`search: ${state.filters.search}`);
  }

  elements.articleFilterContext.hidden = !contextParts.length;
  elements.articleFilterContext.textContent = contextParts.length
    ? `Showing ${countLabel} for ${contextParts.join(" + ")}`
    : "";
}

function getGroupedArticleStateKey(article) {
  return String(
    article?.id ||
      article?.canonicalLink ||
      article?.link ||
      article?.title ||
      `${article?.feedId || "feed"}-${article?.pubDate || "date"}`
  );
}

function getGroupedArticleSources(article) {
  if (!Array.isArray(article?.sources) || article.sources.length < 2) {
    return [];
  }

  const primaryKey = getGroupedArticleStateKey(article);
  return article.sources.filter((sourceArticle, index) => {
    if (!sourceArticle) {
      return false;
    }

    if (index === 0 && getGroupedArticleStateKey(sourceArticle) === primaryKey) {
      return false;
    }

    return true;
  });
}

function rerenderGroupedArticleCard(article) {
  const stateKey = getGroupedArticleStateKey(article);
  const selectorKey = window.CSS?.escape ? window.CSS.escape(stateKey) : stateKey.replace(/["\\]/g, "\\$&");
  const existingCard = elements.articlesGrid?.querySelector(`.article-card[data-article-state-key="${selectorKey}"]`);
  if (!existingCard) {
    return;
  }

  const nextNode = renderArticleCard(article);
  const nextCard = nextNode.firstElementChild || nextNode.firstChild;
  if (!nextCard) {
    return;
  }

  existingCard.replaceWith(nextCard);
}

function toggleGroupedArticleSources(article) {
  const groupedSources = getGroupedArticleSources(article);
  if (!groupedSources.length) {
    return;
  }

  const stateKey = getGroupedArticleStateKey(article);
  const selectorKey = window.CSS?.escape ? window.CSS.escape(stateKey) : stateKey.replace(/["\\]/g, "\\$&");
  const card = elements.articlesGrid?.querySelector(`.article-card[data-article-state-key="${selectorKey}"]`);
  if (!card) {
    return;
  }

  const sourcePanel = card.querySelector(".grouped-sources-inline");
  const toggleButton = card.querySelector(".article-duplicate-badge");
  if (!sourcePanel || !toggleButton) {
    return;
  }

  const isExpanded = !sourcePanel.hidden;
  const nextExpanded = !isExpanded;

  sourcePanel.hidden = !nextExpanded;
  card.classList.toggle("article-card--sources-expanded", nextExpanded);
  toggleButton.setAttribute("aria-expanded", String(nextExpanded));
  toggleButton.title = nextExpanded ? "Hide grouped sources" : "Show grouped sources";

  if (!nextExpanded) {
    const hiddenSourceRows = sourcePanel.querySelectorAll(".grouped-source-item.is-extra-source");
    hiddenSourceRows.forEach((row) => {
      row.hidden = true;
    });

    const moreButton = sourcePanel.querySelector(".grouped-sources-more");
    if (moreButton) {
      moreButton.textContent = `Show ${hiddenSourceRows.length} more sources`;
      moreButton.setAttribute("aria-expanded", "false");
    }
  }

  if (nextExpanded) {
    runtime.expandedGroupedSourceKeys.add(stateKey);
  } else {
    runtime.expandedGroupedSourceKeys.delete(stateKey);
    runtime.fullyExpandedGroupedSourceKeys.delete(stateKey);
  }

  intelligenceDebug("[source-toggle]", {
    key: stateKey,
    expanded: nextExpanded,
  });
}

function toggleGroupedArticleSourceList(article) {
  const groupedSources = getGroupedArticleSources(article);
  if (groupedSources.length <= 12) {
    return;
  }

  return;
}

function getArticleRenderSignature(article) {
  const personalBoost = hasPersonalDashboardSelections() ? computePersonalBoost(article) : { level: "", score: 0 };
  const primarySignalCategory = getPrimaryArticleSignalCategory(article);
  return [
    getGroupedArticleStateKey(article),
    article?.title || "",
    article?.source || "",
    article?.topic || "",
    article?.pubDate || "",
    article?.sourceCount || 0,
    primarySignalCategory || "",
    personalBoost.level || "",
    personalBoost.score || 0,
  ].join("|");
}

function patchSimpleArticleGrid(articlesToRender = []) {
  if (!elements.articlesGrid) {
    return;
  }

  const existingCards = Array.from(elements.articlesGrid.querySelectorAll(".article-card"));
  const existingByKey = new Map(
    existingCards.map((card) => [String(card.dataset.articleStateKey || ""), card])
  );
  const nextCards = articlesToRender.map((article) => {
    const fragment = renderArticleCard(article);
    return fragment.firstElementChild || fragment.firstChild;
  }).filter(Boolean);

  if (!existingCards.length) {
    elements.articlesGrid.innerHTML = "";
    const fragment = document.createDocumentFragment();
    nextCards.forEach((card) => fragment.appendChild(card));
    elements.articlesGrid.appendChild(fragment);
    debugPersonalDashboardLog("[refresh-grid-patch]", {
      mode: "initial-render",
      nextCount: nextCards.length,
    });
    return;
  }

  const fragment = document.createDocumentFragment();
  let replacedCount = 0;
  let reusedCount = 0;

  nextCards.forEach((nextCard) => {
    const key = String(nextCard?.dataset?.articleStateKey || "");
    const signature = String(nextCard?.dataset?.articleRenderSignature || "");
    const existingCard = key ? existingByKey.get(key) : null;
    if (existingCard && existingCard.dataset.articleRenderSignature === signature) {
      fragment.appendChild(existingCard);
      reusedCount += 1;
      return;
    }
    fragment.appendChild(nextCard);
    replacedCount += 1;
  });

  elements.articlesGrid.replaceChildren(fragment);
  debugPersonalDashboardLog("[refresh-grid-patch]", {
    mode: "patched",
    nextCount: nextCards.length,
    reusedCount,
    replacedCount,
  });
}

function renderArticleCard(article) {
  const node = elements.articleCardTemplate.content.cloneNode(true);
  const card = node.querySelector(".article-card");
  const link = node.querySelector(".article-link");
  const image = node.querySelector(".article-image");
  const topic = node.querySelector(".article-topic");
  const source = node.querySelector(".article-source");
  const date = node.querySelector(".article-date");
  const title = node.querySelector(".article-title");
  const feed = node.querySelector(".article-feed");
  const body = node.querySelector(".article-body");
  const meta = node.querySelector(".article-meta");
  const finalImageSrc = getArticleImageSrc(article);
  const primarySignalCategory = getPrimaryArticleSignalCategory(article);
  const groupedSources = getGroupedArticleSources(article);
  const articleStateKey = getGroupedArticleStateKey(article);
  const isGroupedSourcesExpanded = runtime.expandedGroupedSourceKeys.has(articleStateKey);
  const articleRenderSignature = getArticleRenderSignature(article);

  card.dataset.articleStateKey = articleStateKey;
  card.dataset.articleRenderSignature = articleRenderSignature;
  card.classList.toggle("article-card--grouped", groupedSources.length > 0);

  if (card && isGroupedSourcesExpanded && groupedSources.length) {
    card.classList.add("article-card--sources-expanded");
  }

  link.href = article.canonicalLink || article.link;
  image.src = finalImageSrc || PLACEHOLDER_IMAGE;
  image.alt = article.title || "Article thumbnail";
  image.loading = "lazy";
  image.decoding = "async";
  image.onerror = () => {
    image.onerror = null;
    image.alt = "No image available";
    image.src = PLACEHOLDER_IMAGE;
  };

  topic.textContent = getArticleCardTopic(article);
  source.textContent = article.source || "Unknown source";
  date.textContent = formatDate(article.pubDate);
  title.textContent = article.title || "Untitled article";
  feed.textContent = getFeedName(article.feedId);
  feed.title = feed.textContent;

  if (meta && primarySignalCategory) {
    const signalBadge = document.createElement("span");
    signalBadge.className = "article-signal-badge";
    signalBadge.textContent = getPrimaryArticleSignalLabel(primarySignalCategory);
    meta.appendChild(signalBadge);
  }

  if (meta && hasPersonalDashboardSelections()) {
    const personalBoost = computePersonalBoost(article);
    if (personalBoost.level) {
      const personalBadge = document.createElement("span");
      personalBadge.className = `article-personal-badge article-personal-badge--${personalBoost.level}`;
      personalBadge.textContent =
        personalBoost.level === "high"
          ? "High relevance"
          : personalBoost.level === "relevant"
            ? "Relevant"
            : "Related";
      meta.appendChild(personalBadge);
    }
  }

  if (meta && Number(article?.sourceCount || 0) > 1) {
    const duplicateBadge = groupedSources.length ? document.createElement("button") : document.createElement("span");
    duplicateBadge.className = "article-duplicate-badge";
    duplicateBadge.textContent = `+ ${article.sourceCount} sources`;

    if (groupedSources.length) {
      duplicateBadge.type = "button";
      duplicateBadge.title = isGroupedSourcesExpanded ? "Hide grouped sources" : "Show grouped sources";
      duplicateBadge.setAttribute("aria-expanded", String(isGroupedSourcesExpanded));
      duplicateBadge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleGroupedArticleSources(article);
      });
    }

    meta.appendChild(duplicateBadge);
  }

  if (groupedSources.length) {
    const sourcePanel = document.createElement("div");
    sourcePanel.className = "grouped-sources-inline";
    sourcePanel.hidden = !isGroupedSourcesExpanded;
    const hiddenExtraSources = [];

    groupedSources.forEach((sourceArticle, index) => {
      const row = document.createElement("div");
      row.className = "grouped-source-item";
      if (index >= 2) {
        row.classList.add("is-extra-source");
        row.hidden = true;
        hiddenExtraSources.push(row);
      }

      const header = document.createElement("div");
      header.className = "grouped-source-meta";
      header.textContent = [sourceArticle.source || "Unknown source", formatDate(sourceArticle.pubDate)]
        .filter(Boolean)
        .join(" • ");

      const sourceTitle = document.createElement("div");
      sourceTitle.className = "grouped-source-title";
      sourceTitle.textContent = sourceArticle.title || "Untitled article";

      row.append(header, sourceTitle);

      const sourceLink = sourceArticle.canonicalLink || sourceArticle.link;
      if (sourceLink) {
        const openLink = document.createElement("a");
        openLink.className = "grouped-source-open";
        openLink.href = sourceLink;
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        openLink.textContent = "Open";
        openLink.addEventListener("click", (event) => {
          event.stopPropagation();
        });
        row.appendChild(openLink);
      }

      sourcePanel.appendChild(row);
    });

    if (hiddenExtraSources.length) {
      const moreButton = document.createElement("button");
      moreButton.type = "button";
      moreButton.className = "grouped-sources-more";
      moreButton.textContent = `Show ${hiddenExtraSources.length} more sources`;
      moreButton.setAttribute("aria-expanded", "false");
      moreButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const expanded = moreButton.getAttribute("aria-expanded") === "true";
        const nextExpanded = !expanded;

        hiddenExtraSources.forEach((row) => {
          row.hidden = !nextExpanded;
        });

        moreButton.setAttribute("aria-expanded", String(nextExpanded));
        moreButton.textContent = nextExpanded
          ? "Hide extra sources"
          : `Show ${hiddenExtraSources.length} more sources`;

        intelligenceDebug("[source-toggle]", {
          key: `${articleStateKey}:extra`,
          expanded: nextExpanded,
        });
      });
      sourcePanel.appendChild(moreButton);
    }

    card.appendChild(sourcePanel);
  }

  return node;
}

function renderDmvPlaceholderCard(feed) {
  const card = document.createElement("div");
  const message = document.createElement("p");
  const link = document.createElement("a");
  const officialUrl = String(feed.officialUrl || feed.rssUrl || "#").trim();
  const isLinkOnly = feed?.dmvMode === "link-only";

  card.className = "empty-state";
  message.textContent = isLinkOnly ? "No RSS feed available" : "No news available";

  link.href = officialUrl || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "dmv-official-link";
  link.textContent = "Open official DMV page";

  card.append(message, link);

  return card;
}

function renderDmvEmptyState(message, officialUrl = "") {
  elements.articlesGrid.innerHTML =
    `<div class="empty-state">${message}</div>` +
    (officialUrl
      ? `<div class="empty-state"><a class="dmv-official-link" href="${officialUrl}" target="_blank" rel="noopener noreferrer">Open official DMV page</a></div>`
      : "");
}

function renderFeedGroup(titleText, cards) {
  const section = document.createElement("section");
  section.className = "dmv-feed-group";

  const heading = document.createElement("h3");
  heading.className = "dmv-feed-group-title";
  heading.textContent = titleText;

  const grid = document.createElement("div");
  grid.className = "dmv-feed-group-grid";
  cards.forEach((card) => grid.appendChild(card));

  section.appendChild(heading);
  section.appendChild(grid);
  return section;
}

function renderSkeletons() {
  elements.articlesGrid.classList.remove("is-grouped-feed-view");
  if (elements.paginationControls) {
    elements.paginationControls.hidden = true;
  }
  elements.articlesGrid.innerHTML = Array.from({ length: 8 })
    .map(
      () => `
        <article class="skeleton-card">
          <div class="skeleton-image"></div>
          <div class="skeleton-body">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
          </div>
        </article>
      `
    )
    .join("");
}

function shouldUseBackendArticleQuery() {
  return Boolean(
    !state.filters.articleIds?.length &&
    !state.filters.dmvFeedId &&
    !state.filters.canadaDmvFeedPath &&
    !state.filters.canadaDmvAll &&
    (
      hasPersonalDashboardSelections() ||
      state.filters.feedId ||
      state.filters.topic ||
      state.filters.tag ||
      state.filters.signalCategory ||
      state.filters.search ||
      state.filters.date
    )
  );
}

function getBackendArticleQueryKey() {
  const personalDomainPlan = getPersonalDashboardBackendDomainPlan();
  return JSON.stringify({
    feedId: state.filters.feedId || "",
    topic: state.filters.topic || "",
    tag: state.filters.tag || "",
    signal: state.filters.signalCategory || "",
    search: state.filters.search || "",
    date: state.filters.date || "",
    personalDashboardInterests: Array.isArray(state.personalDashboard?.interests) ? state.personalDashboard.interests.slice().sort() : [],
    personalDashboardMode: normalizePersonalDashboardMode(state.personalDashboard?.mode),
    personalDashboardDomain: personalDomainPlan?.domain || "",
  });
}

function applyBackendArticleQueryBaseParams(options = {}) {
  const params = new URLSearchParams();
  params.set("includePagination", "true");
  params.set("showDuplicates", "true");
  params.set("limit", String(options.limit || MAX_ARTICLES_IN_MEMORY));
  params.set("page", "1");

  const resolvedFeed = state.filters.feedId ? resolveFeedByIdentity(state.filters.feedId) : null;
  if (resolvedFeed?.id) {
    params.set("feedId", String(resolvedFeed.id));
  } else if (state.filters.feedId) {
    params.set("feed", state.filters.feedId);
  }

  if (state.filters.topic) {
    params.set("topic", state.filters.topic);
  }
  if (state.filters.tag) {
    params.set("tag", state.filters.tag);
  }
  if (state.filters.signalCategory) {
    params.set("signal", state.filters.signalCategory);
  }
  if (state.filters.search) {
    params.set("search", state.filters.search);
  }
  if (state.filters.date) {
    params.set("date", state.filters.date);
  }

  return params;
}

function getBackendArticleQueryParams() {
  return applyBackendArticleQueryBaseParams();
}

function buildPersonalDashboardBackendQueryParamsList() {
  const plan = getPersonalDashboardBackendDomainPlan();
  if (!plan) {
    return [];
  }

  const requestParamsList = [];
  const seenKeys = new Set();
  const perRequestLimit = Math.max(100, Math.min(250, Math.floor(MAX_ARTICLES_IN_MEMORY / 6)));
  const hasExplicitTopicFilter = Boolean(state.filters.topic);

  const addParams = (mutate, options = {}) => {
    const params = applyBackendArticleQueryBaseParams({ limit: perRequestLimit });
    if (options.includePlanTopic && !hasExplicitTopicFilter && plan.topic) {
      params.set("topic", plan.topic);
    }
    if (typeof mutate === "function") {
      mutate(params);
    }
    const key = params.toString();
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    requestParamsList.push(params);
  };

  if (plan.includeTopicBaseline !== false) {
    addParams(null, { includePlanTopic: true });
  }
  plan.searches.forEach((searchTerm) => {
    addParams((params) => {
      params.set("search", searchTerm);
    });
  });

  return requestParamsList;
}

async function ensureBackendArticleQueryData() {
  if (!shouldUseBackendArticleQuery()) {
    runtime.backendArticleQueryLoading = false;
    state.remoteQuery.activeKey = "";
    return null;
  }

  const queryKey = getBackendArticleQueryKey();
  if (runtime.backendArticleQueryCache.has(queryKey)) {
    const cached = runtime.backendArticleQueryCache.get(queryKey);
    state.remoteQuery = {
      activeKey: queryKey,
      totalCount: cached.totalCount,
      page: 1,
      limit: MAX_ARTICLES_IN_MEMORY,
    };
    return cached;
  }

  const requestId = ++runtime.backendArticleQueryRequestId;
  runtime.backendArticleQueryActiveRequestId = requestId;
  runtime.backendArticleQueryLoading = true;
  renderSkeletons();
  if (elements.resultsCount) {
    elements.resultsCount.textContent = "Loading articles...";
  }

  const personalDomainPlan = getPersonalDashboardBackendDomainPlan();
  const queryParamsList =
    personalDomainPlan && hasPersonalDashboardSelections()
      ? buildPersonalDashboardBackendQueryParamsList()
      : [getBackendArticleQueryParams()];
  const responses = await Promise.all(
    queryParamsList.map((params) => apiRequest(`/api/articles?${params.toString()}`))
  );
  if (requestId !== runtime.backendArticleQueryActiveRequestId) {
    return null;
  }

  const mergedRawArticles = [];
  responses.forEach((response) => {
    const items = Array.isArray(response?.items) ? response.items : Array.isArray(response?.articles) ? response.articles : [];
    items.forEach((item) => {
      mergedRawArticles.push(item);
    });
  });

  const dedupedRawArticleMap = new Map();
  mergedRawArticles.forEach((article) => {
    const dedupeKey =
      String(article?.id || "").trim() ||
      String(article?.canonicalLink || article?.link || "").trim().toLowerCase();
    if (!dedupeKey || dedupedRawArticleMap.has(dedupeKey)) {
      return;
    }
    dedupedRawArticleMap.set(dedupeKey, article);
  });

  const dedupedRawArticles = Array.from(dedupedRawArticleMap.values())
    .sort((left, right) => new Date(right?.pubDate || 0) - new Date(left?.pubDate || 0))
    .slice(0, MAX_ARTICLES_IN_MEMORY);
  let normalizedArticles = dedupedRawArticles.map(normalizeLoadedArticle);
  if (personalDomainPlan?.domain === "identity_documents") {
    normalizedArticles = normalizedArticles.filter((article) => !shouldExcludeIdentityDocumentsRetrievalCandidate(article));
  }
  const totalCount = normalizedArticles.length;

  if (personalDomainPlan && hasPersonalDashboardSelections()) {
    logPersonalDashboardSourceStage("[personal-dashboard-backend-domain-query]", normalizedArticles, {
      personalDashboardDomain: personalDomainPlan.domain,
      selectedInterests: normalizePersonalDashboardInterests(state.personalDashboard.interests),
      queryParamsUsed: queryParamsList.map((params) => Object.fromEntries(params.entries())),
      totalReturned: totalCount,
    });
    if (personalDomainPlan.domain === "identity_documents") {
      debugPersonalDashboardLog("[personal-dashboard-identity-subinterest-query]", {
        selectedInterests: getSelectedIdentityDocumentSubinterests(),
        backendQueryTermsUsed: Array.isArray(personalDomainPlan.searches) ? personalDomainPlan.searches.slice() : [],
        queryKey,
        totalReturned: totalCount,
      });
    }
  }

  logPersonalDashboardSourceStage("[personal-dashboard-backend-query]", normalizedArticles, {
    queryKey,
    totalCount,
    loadedCount: normalizedArticles.length,
  });
  const payload = {
    queryKey,
    articles: normalizedArticles,
    totalCount,
  };
  runtime.backendArticleQueryCache.set(queryKey, payload);
  state.remoteQuery = {
    activeKey: queryKey,
    totalCount,
    page: 1,
    limit: MAX_ARTICLES_IN_MEMORY,
  };
  runtime.backendArticleQueryLoading = false;
  return payload;
}

function getPaginationContextKey() {
  return JSON.stringify({
    dashboardMode: state.dashboardMode,
    filters: state.filters,
    analyticsScope: state.analyticsScope,
    analyticsQualityFilter: state.analyticsQualityFilter,
    personalDashboardInterests: Array.isArray(state.personalDashboard?.interests)
      ? state.personalDashboard.interests.slice().sort()
      : [],
    personalDashboardMode: normalizePersonalDashboardMode(state.personalDashboard?.mode),
  });
}

function ensurePaginationState() {
  if (!state.pagination || typeof state.pagination !== "object") {
    state.pagination = {
      page: 1,
      pageSize: ARTICLE_RENDER_PAGE_SIZE,
    };
  }

  const nextPage = Math.max(1, Number(state.pagination.page) || 1);
  const nextPageSize = Math.max(1, Number(state.pagination.pageSize) || ARTICLE_RENDER_PAGE_SIZE);
  state.pagination.page = nextPage;
  state.pagination.pageSize = nextPageSize;
  return state.pagination;
}

function syncPaginationContext() {
  ensurePaginationState();
  const nextContextKey = getPaginationContextKey();
  if (runtime.paginationContextKey !== nextContextKey) {
    runtime.paginationContextKey = nextContextKey;
    state.pagination.page = 1;
  }
}

function getPaginatedItems(items) {
  const paginationState = ensurePaginationState();
  const totalCount = Array.isArray(items) ? items.length : 0;
  const pageSize = Math.max(1, Number(paginationState.pageSize) || ARTICLE_RENDER_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, Number(paginationState.page) || 1), totalPages);
  state.pagination.page = currentPage;

  const startIndex = totalCount ? (currentPage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  if (DEBUG_PERSONAL_DASHBOARD && hasPersonalDashboardSelections()) {
    debugPersonalDashboardLog("[personal-dashboard-pagination]", {
      currentPage,
      totalPages,
      totalFiltered: totalCount,
      pageSize,
      startIndex,
      endIndex,
      selectedInterests: normalizePersonalDashboardInterests(state.personalDashboard.interests),
    });
  }

  return {
    items: Array.isArray(items) ? items.slice(startIndex, endIndex) : [],
    totalCount,
    pageSize,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
  };
}

function ensurePaginationControlsElement() {
  let container = document.getElementById("pagination-controls");
  if (!container && elements.articlesGrid?.parentElement) {
    container = document.createElement("div");
    container.id = "pagination-controls";
    container.className = "pagination-controls";
    elements.articlesGrid.insertAdjacentElement("afterend", container);
  }

  elements.paginationControls = container;
  return container;
}

function renderPaginationControls(pagination) {
  const container = ensurePaginationControlsElement();
  if (!container) {
    return;
  }

  const totalItems = Number(pagination?.totalCount) || 0;
  const page = Number(pagination?.currentPage) || 1;
  const totalPages = Number(pagination?.totalPages) || 1;
  const startDisplay = totalItems ? (Number(pagination?.startIndex) || 0) + 1 : 0;
  const endDisplay = Number(pagination?.endIndex) || 0;

  container.innerHTML = `
    <div class="pagination-summary">
      <span class="pagination-range">Showing ${startDisplay}-${endDisplay} of ${totalItems}</span>
      <span class="pagination-status">Page ${page} of ${totalPages}</span>
    </div>
    <div class="pagination-actions">
      <button class="ghost-button pagination-button" type="button" data-pagination-action="prev">Previous</button>
      <button class="ghost-button pagination-button" type="button" data-pagination-action="next">Next</button>
    </div>
  `;

  container.hidden = totalItems === 0;
  if (totalItems === 0) {
    return;
  }

  container.removeAttribute("hidden");
  elements.paginationRange = container.querySelector(".pagination-range");
  elements.paginationStatus = container.querySelector(".pagination-status");
  elements.paginationPrev = container.querySelector('[data-pagination-action="prev"]');
  elements.paginationNext = container.querySelector('[data-pagination-action="next"]');

  if (elements.paginationPrev) {
    elements.paginationPrev.disabled = page <= 1;
    elements.paginationPrev.onclick = () => {
      if (state.pagination.page <= 1) {
        return;
      }

      state.pagination.page -= 1;
      scheduleRenderArticles("pagination-prev");
    };
  }

  if (elements.paginationNext) {
    elements.paginationNext.disabled = page >= totalPages;
    elements.paginationNext.onclick = () => {
      if (state.pagination.page >= totalPages) {
        return;
      }

      state.pagination.page += 1;
      scheduleRenderArticles("pagination-next");
    };
  }

  debugPerformanceLog("[pagination-ui-rendered]", {
    page,
    totalPages,
    totalItems,
  });
}

function getSelectedFeedLabel() {
  return String(elements.feedFilter?.selectedOptions?.[0]?.textContent || "").trim();
}

function logFeedFilterDiagnostics(selectedFeedId, selectedFeedLabel, rawMatches, groupedMatches, renderedCount = 0) {
  if (!selectedFeedId) {
    return;
  }

  const firstTitles = rawMatches
    .slice(0, 10)
    .map((article) => article?.title || "Untitled article");

  debugFeedFilterLog("[feed-filter-diagnostics]", {
    selectedFeedId,
    selectedFeedLabel,
    rawMatchesBeforeRelevance: rawMatches.length,
    matchesAfterRelevance: groupedMatches.length,
    renderedCount,
    firstMatchingTitles: firstTitles,
  });
}

function finalizeRenderDiagnostics(payload = {}) {
  const renderedCardCount = document.querySelectorAll(".article-card").length;
  const maxRenderedCards = 30;
  const branchName = payload.branchName || "default";
  const total = Number(payload.total) || 0;
  const page = Number(payload.page) || 1;
  const pageSize = Number(payload.pageSize) || 30;
  const totalPages = Number(payload.totalPages) || 1;

  debugPerformanceLog("[pagination]", {
    total,
    page,
    pageSize,
    rendered: renderedCardCount,
    totalPages,
  });

  if (renderedCardCount > maxRenderedCards) {
    console.error("HARD CAP FAILED", {
      branchName,
      renderedCardCount,
      maxRenderedCards,
    });
  }

  debugPerformanceLog("[render-metrics]", {
    articleCountInMemory: state.articles.length,
    renderDurationHint: payload.durationMs || 0,
    articleCacheSize: runtime.articleComputationCache.size,
    articlePairCacheSize: runtime.articlePairComputationCache.size,
    groupedFeedCacheSize: runtime.groupedFeedCache.size,
    domCardCount: renderedCardCount,
  });
}

function logRenderingPageArticlesOnly(groupedArticlesCount, pageArticles) {
  debugPerformanceLog("[rendering-page-articles-only]", {
    groupedArticlesCount,
    pageArticlesCount: Array.isArray(pageArticles) ? pageArticles.length : 0,
  });
}

function normalizeFeedMatchValue(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "";
  }

  return text
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFeedMatchDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const normalizedUrl = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(normalizedUrl).hostname.replace(/^www\./, "").toLowerCase();
    return hostname;
  } catch {
    return "";
  }
}

function addFeedMatchTokens(tokenSet, value) {
  const normalized = normalizeFeedMatchValue(value);
  if (!normalized) {
    return;
  }

  tokenSet.add(normalized);

  const domain = getFeedMatchDomain(value);
  if (domain) {
    tokenSet.add(domain);
    const hostParts = domain.split(".");
    if (hostParts.length > 2) {
      tokenSet.add(hostParts.slice(-2).join("."));
    }
  }
}

function getSelectedFeedResolution(feedIdentity) {
  ensureFeedLookupCaches();
  const cacheKey = String(feedIdentity || "").trim();
  if (runtime.selectedFeedResolutionCache.has(cacheKey)) {
    return runtime.selectedFeedResolutionCache.get(cacheKey);
  }

  const selectedFeed = resolveFeedByIdentity(feedIdentity);
  const resolution = {
    feedIdentity: cacheKey,
    selectedFeed,
    selectedFeedId: String(selectedFeed?.id || "").trim(),
    selectedSourceId: String(selectedFeed?.sourceId || "").trim(),
    selectedExactUrl: normalizeFeedExactUrl(
      selectedFeed?.rssUrl || selectedFeed?.url || selectedFeed?.officialUrl || selectedFeed?.siteUrl || selectedFeed?.homepage || ""
    ),
    selectedDomain: getFeedDiagnosticDomain(selectedFeed),
  };
  runtime.selectedFeedResolutionCache.set(cacheKey, resolution);
  return resolution;
}

function getArticleFeedIdentityInfo(article) {
  return getCachedArticleValue(article, "articleFeedIdentityInfo", () => {
    const derivedFeed = resolveFeedByIdentity(article?.feedId);
    return {
      feedId: String(article?.feedId || "").trim(),
      sourceId: String(article?.sourceId || derivedFeed?.sourceId || "").trim(),
      exactFeedUrl: normalizeFeedExactUrl(
        article?.feedUrl
          || article?.rssUrl
          || derivedFeed?.rssUrl
          || derivedFeed?.url
          || derivedFeed?.officialUrl
          || derivedFeed?.siteUrl
          || derivedFeed?.homepage
          || ""
      ),
      articleDomain: getFeedMatchDomain(article?.url || article?.link || article?.canonicalLink || ""),
      feedDomain: getFeedDiagnosticDomain(derivedFeed),
      articleFeed: article?.source || article?.sourceName || derivedFeed?.name || "",
    };
  });
}

function articleBelongsToSelectedFeed(article, selectedFeed) {
  const selectedResolution = typeof selectedFeed === "string"
    ? getSelectedFeedResolution(selectedFeed)
    : getSelectedFeedResolution(getUniqueFeedIdentity(selectedFeed));
  const articleInfo = getArticleFeedIdentityInfo(article);

  let matched = false;
  let matchReason = "no-match";

  if (selectedResolution.selectedFeedId && articleInfo.feedId === selectedResolution.selectedFeedId) {
    matched = true;
    matchReason = "feed-id";
  } else if (selectedResolution.selectedSourceId && articleInfo.sourceId === selectedResolution.selectedSourceId) {
    matched = true;
    matchReason = "source-id";
  } else if (selectedResolution.selectedExactUrl && articleInfo.exactFeedUrl === selectedResolution.selectedExactUrl) {
    matched = true;
    matchReason = "feed-url";
  }

  debugFeedFilterLog(matched ? "[selected-feed-match]" : "[selected-feed-reject]", {
    selectedFeedId: selectedResolution.selectedFeedId || selectedResolution.feedIdentity,
    articleFeedId: articleInfo.feedId,
    reason: matchReason,
  });

  return { matched, matchReason };
}

function articleMatchesSelectedFeed(article, feedId) {
  if (!feedId) {
    return true;
  }

  return articleBelongsToSelectedFeed(article, feedId).matched;
}

function groupedArticleMatchesFeedFilter(article, feedId) {
  return articleMatchesSelectedFeed(article, feedId);
}

function renderArticlesFallback(error) {
  console.warn("[render-articles-fallback]", {
    message: error instanceof Error ? error.message : String(error),
  });

  ensurePaginationState();

  let fallbackAllArticles = [];
  try {
    const shouldIgnoreFeedIdForGrouping = Boolean(state.filters?.feedId) && !state.filters?.date;
    fallbackAllArticles = state.filters?.date
      ? sortArticlesForCurrentDashboardMode(state.articles.filter(articleMatchesFilters))
      : state.filters?.feedId
        ? (() => {
            const selectedFeedResolution = getSelectedFeedResolution(state.filters.feedId);
            const candidateArticles = selectedFeedResolution.selectedFeedId
              ? (runtime.articlesByFeedId.get(selectedFeedResolution.selectedFeedId) || [])
              : state.articles.filter((article) => articleMatchesSelectedFeed(article, state.filters.feedId));
            const feedMatches = candidateArticles.filter((article) => articleMatchesFilters(article, { ignoreFeedId: true }));
            const rawFeedMatches = hasPersonalDashboardSelections()
              ? sortArticlesForCurrentDashboardMode(feedMatches)
              : sortArticlesByPublicationDate(feedMatches);
            return prepareDateFirstGroupedArticles(rawFeedMatches);
          })()
        : (() => {
          const visibleArticles = getVisibleArticles({ ignoreFeedId: shouldIgnoreFeedIdForGrouping });
          const groupedArticles = prepareDateFirstGroupedArticles(visibleArticles);
          const feedScopedArticles = shouldIgnoreFeedIdForGrouping
            ? groupedArticles.filter((article) => groupedArticleMatchesFeedFilter(article, state.filters.feedId))
            : groupedArticles;
          return sortArticlesByPublicationDate(feedScopedArticles);
        })();
  } catch (innerError) {
    console.warn("[render-articles-fallback-inner]", {
      message: innerError instanceof Error ? innerError.message : String(innerError),
    });
    fallbackAllArticles = state.articles
      .filter((article) => {
        try {
          return articleMatchesFilters(article);
        } catch (_error) {
          return true;
        }
      });
    fallbackAllArticles = sortArticlesForCurrentDashboardMode(fallbackAllArticles);
  }

  const fallbackPagination = getPaginatedItems(fallbackAllArticles);
  const MAX_RENDERED_ARTICLES = 30;
  const fallbackPageArticles = Array.isArray(fallbackPagination.items) ? fallbackPagination.items : [];
  const articlesToRender = fallbackPageArticles.slice(0, MAX_RENDERED_ARTICLES);

  if (elements.resultsCount) {
    elements.resultsCount.textContent = `${fallbackPagination.totalCount} results`;
  }

  if (elements.articlesGrid) {
    elements.articlesGrid.classList.remove("is-grouped-feed-view");
    elements.articlesGrid.classList.remove("has-personal-lanes");
    elements.articlesGrid.innerHTML = "";

    if (!articlesToRender.length) {
      elements.articlesGrid.innerHTML = `<div class="empty-state">No articles match the active filters.</div>`;
    } else {
      const fragment = document.createDocumentFragment();
      articlesToRender.forEach((article) => {
        fragment.appendChild(renderArticleCard(article));
      });
      elements.articlesGrid.appendChild(fragment);
    }
  }

  renderPaginationControls(fallbackPagination);

  const renderedCards = document.querySelectorAll(".article-card").length;
  debugPerformanceLog("[pagination-fallback]", {
    total: fallbackAllArticles.length,
    page: fallbackPagination.currentPage,
    pageSize: fallbackPagination.pageSize,
    rendered: renderedCards,
    totalPages: fallbackPagination.totalPages,
  });
  if (renderedCards > 30) {
    console.error("HARD CAP FAILED", renderedCards);
  }
}

function renderArticles() {
  const shouldDebugFeedRender = DEBUG_FEED_FILTER;
  const shouldDebugPersonalDashboard = DEBUG_PERSONAL_DASHBOARD && hasPersonalDashboardSelections();
  const feedRenderStartedAt = shouldDebugFeedRender ? performance.now() : 0;
  let feedRenderGroupedCount = 0;
  let feedRenderFilteredCount = 0;
  const renderReason = runtime.lastRenderedReason || "render";
  if (shouldDebugFeedRender) {
    debugFeedFilterLog("[feed-render-start]", {
      selectedFeed: state.filters.feedId || "",
      page: state.pagination.page,
      reason: renderReason,
    });
  }
  intelligenceTime("renderArticles");
  try {
    intelligenceTime("renderArticles:filter-group");
    syncPaginationContext();
    const useBackendQuery = shouldUseBackendArticleQuery();
    if (useBackendQuery) {
      const queryKey = getBackendArticleQueryKey();
      const cachedQuery = runtime.backendArticleQueryCache.get(queryKey);
      if (!cachedQuery) {
        if (!runtime.backendArticleQueryLoading) {
          void ensureBackendArticleQueryData()
            .then((result) => {
              if (result) {
                scheduleRenderArticles("backend-article-query-ready", { mode: "frame" });
              }
            })
            .catch((error) => {
              runtime.backendArticleQueryLoading = false;
              elements.resultsCount.textContent = error?.message || "Failed to load filtered articles.";
            });
        }
        return;
      }
    }
    let articles;
    const shouldIgnoreFeedIdForGrouping = Boolean(state.filters.feedId) && !state.filters.date;
    const totalRawArticles = Array.isArray(state.articles) ? state.articles.length : 0;
    let filteredRawArticles = [];
    let groupedArticlesCount = 0;
    const activeFeedId = state.filters.feedId || "";
    const activeFeedResolution = activeFeedId ? getSelectedFeedResolution(activeFeedId) : null;
    const activeFeedLabel = getSelectedFeedLabel();
    let personalDashboardBasePool = Array.isArray(state.articles) ? state.articles : [];
    let feedDebugRawMatches = [];
    let feedDebugAfterRelevanceMatches = [];

    if (useBackendQuery) {
      const cachedQuery = runtime.backendArticleQueryCache.get(getBackendArticleQueryKey()) || {
        articles: [],
        totalCount: 0,
      };
      personalDashboardBasePool = cachedQuery.articles;
      filteredRawArticles = sortArticlesForCurrentDashboardMode(
        cachedQuery.articles.filter((article) => articleMatchesFilters(article, { ignoreFeedId: true }))
      );
      const groupedArticles = prepareDateFirstGroupedArticles(filteredRawArticles);
      groupedArticlesCount = groupedArticles.length;
      articles = groupedArticles;
    } else if (activeFeedId && !state.filters.date) {
      const cachedFeedResult = getCachedGroupedFeedResult(activeFeedId);
      feedDebugRawMatches = cachedFeedResult.rawMatches;
      feedDebugAfterRelevanceMatches = cachedFeedResult.filteredMatches;
      personalDashboardBasePool = cachedFeedResult.rawMatches;
      filteredRawArticles = cachedFeedResult.filteredMatches;
      const groupedArticles = cachedFeedResult.groupedArticles;
      groupedArticlesCount = groupedArticles.length;
      feedRenderFilteredCount = filteredRawArticles.length;
      feedRenderGroupedCount = groupedArticlesCount;
      articles = groupedArticles;
    } else if (state.filters.date) {
      personalDashboardBasePool = state.articles;
      filteredRawArticles = sortArticlesForCurrentDashboardMode(
        state.articles.filter(articleMatchesFilters)
      );
      articles = filteredRawArticles;
      groupedArticlesCount = articles.length;
      feedRenderFilteredCount = filteredRawArticles.length;
      feedRenderGroupedCount = groupedArticlesCount;
    } else {
      personalDashboardBasePool = state.articles;
      const visibleArticles = getVisibleArticles({ ignoreFeedId: shouldIgnoreFeedIdForGrouping });
      filteredRawArticles = visibleArticles;
      const groupedArticles = prepareDateFirstGroupedArticles(visibleArticles);
      groupedArticlesCount = groupedArticles.length;
      feedRenderFilteredCount = filteredRawArticles.length;
      feedRenderGroupedCount = groupedArticlesCount;
      const feedScopedArticles = shouldIgnoreFeedIdForGrouping
        ? groupedArticles.filter((article) => groupedArticleMatchesFeedFilter(article, state.filters.feedId))
        : groupedArticles;
      articles = sortArticlesByPublicationDate(feedScopedArticles);
    }

    const selectedUsDmvEntry = getSelectedUsDmvCatalogEntry();
    const selectedUsDmvFeed = getSelectedDmvFeed();
    const selectedCanadaEntry = getSelectedCanadaCatalogEntry();
    const selectedDmvOfficialUrl = String(
      selectedUsDmvFeed?.officialUrl ||
        selectedUsDmvEntry?.officialUrl ||
        selectedCanadaEntry?.officialUrl ||
        ""
    ).trim();

    syncFilterUx();
    updateArticleFilterContext(articles);
    const articlePagination = getPaginatedItems(articles);
    if (useBackendQuery && !hasPersonalDashboardSelections() && Number(state.remoteQuery.totalCount) > articlePagination.totalCount) {
      articlePagination.totalCount = Number(state.remoteQuery.totalCount);
      articlePagination.totalPages = Math.max(1, Math.ceil(articlePagination.totalCount / articlePagination.pageSize));
    }
    const pageArticles = Array.isArray(articlePagination.items)
      ? articlePagination.items.slice(0, ARTICLE_RENDER_PAGE_SIZE)
      : [];
    const MAX_RENDERED_ARTICLES = 30;
    const articlesToRender = Array.isArray(pageArticles)
      ? pageArticles.slice(0, MAX_RENDERED_ARTICLES)
      : Array.isArray(articles)
        ? articles.slice(0, MAX_RENDERED_ARTICLES)
        : [];

    if (shouldDebugPersonalDashboard) {
      const advancedFilterOptions =
        useBackendQuery || (activeFeedId && !state.filters.date)
          ? { ignoreFeedId: true, ignorePersonalDashboard: true }
          : { ignorePersonalDashboard: true };
      const afterAdvancedFilters = personalDashboardBasePool.filter((article) =>
        articleMatchesFilters(article, advancedFilterOptions)
      );
      const afterPersonalDashboard = afterAdvancedFilters.filter((article) =>
        articleMatchesPersonalDashboardSelection(article)
      );
      const branch =
        useBackendQuery
          ? "backend-query"
          : activeFeedId && !state.filters.date
            ? "feed-filter"
            : state.filters.date
              ? "date-filter"
              : "default";
      logPersonalDashboardSourceStage("[personal-dashboard-before-filters]", personalDashboardBasePool, {
        branch,
      });
      logPersonalDashboardSourceStage("[personal-dashboard-after-advanced-filters]", afterAdvancedFilters, {
        branch,
      });
      logPersonalDashboardSourceStage("[personal-dashboard-after-personal-dashboard]", afterPersonalDashboard, {
          branch,
        });
      debugPersonalDashboardLog("[personal-dashboard-final-visible]", {
          branch,
          finalVisibleCount: Array.isArray(articles) ? articles.length : 0,
          finalRenderedCount: Array.isArray(articlesToRender) ? articlesToRender.length : 0,
        });
        logIdentityDocumentTopResults(articlesToRender);
        logDigitalIdentitySubgroupDiagnostics(afterAdvancedFilters);
      }

    if (activeFeedId) {
      logFeedFilterDiagnostics(
        activeFeedId,
        activeFeedLabel,
        feedDebugRawMatches,
        feedDebugAfterRelevanceMatches,
        articlesToRender.length
      );
    }
    intelligenceTimeEnd("renderArticles:filter-group");

    const renderDiagnostics = {
      branchName: "feed-filter",
      total: articles.length,
      page: articlePagination.currentPage,
      pageSize: articlePagination.pageSize,
      totalPages: articlePagination.totalPages,
    };

    if (state.filters.feedId) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.remove("is-grouped-feed-view");
      elements.articlesGrid.classList.remove("has-personal-lanes");
      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        elements.articlesGrid.innerHTML =
          `<div class="empty-state">No articles match the active filters.</div>`;
        renderPaginationControls(articlePagination);
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      patchSimpleArticleGrid(articlesToRender);
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    if ((selectedUsDmvEntry || selectedCanadaEntry) && !state.filters.feedId) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.remove("is-grouped-feed-view");
      elements.articlesGrid.classList.remove("has-personal-lanes");
      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        renderDmvEmptyState(
          isUsLinkOnlyEntry(selectedUsDmvEntry) || isCanadaLinkOnlyEntry(selectedCanadaEntry)
            ? "No RSS feed available for this DMV."
            : "No news available",
          selectedDmvOfficialUrl
        );
        renderPaginationControls(articlePagination);
        renderDiagnostics.branchName = "selected-dmv-empty";
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      patchSimpleArticleGrid(articlesToRender);
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      renderDiagnostics.branchName = "selected-dmv";
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    if (state.dashboardMode === "usa" && !getActiveArticleFeedId()) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.add("is-grouped-feed-view");
      elements.articlesGrid.classList.remove("has-personal-lanes");
      const dmvFeeds = getUsDmvFeeds();
      const articlesByFeedId = new Map();

      articlesToRender.forEach((article) => {
        const items = articlesByFeedId.get(article.feedId) || [];
        items.push(article);
        articlesByFeedId.set(article.feedId, items);
      });

      const visibleFeedIds = new Set(articlesToRender.map((article) => article.feedId).filter(Boolean));
      const visibleFeeds = dmvFeeds.filter((feed) => visibleFeedIds.has(feed.id));

      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        elements.articlesGrid.innerHTML =
          `<div class="empty-state">No articles match the active filters.</div>`;
        renderPaginationControls(articlePagination);
        renderDiagnostics.branchName = "usa-grouped-empty";
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      const fragment = document.createDocumentFragment();
      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      visibleFeeds.forEach((feed) => {
        const feedArticles = articlesByFeedId.get(feed.id) || [];
        const groupCards = feedArticles.length
          ? feedArticles.map((article) => renderArticleCard(article))
          : [renderDmvPlaceholderCard(feed)];
        fragment.appendChild(renderFeedGroup(feed.name || "Untitled feed", groupCards));
      });
      elements.articlesGrid.appendChild(fragment);
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      renderDiagnostics.branchName = "usa-grouped";
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    if (state.dashboardMode === "canada" && !state.filters.canadaDmvFeedPath) {
      intelligenceTime("renderArticles:dom-update");
      elements.articlesGrid.classList.add("is-grouped-feed-view");
      elements.articlesGrid.classList.remove("has-personal-lanes");
      const canadaEntries = getCanadaDmvCatalogEntries();
      const articlesByFeedId = new Map();

      articlesToRender.forEach((article) => {
        const items = articlesByFeedId.get(article.feedId) || [];
        items.push(article);
        articlesByFeedId.set(article.feedId, items);
      });

      const visibleFeedIds = new Set(articlesToRender.map((article) => article.feedId).filter(Boolean));
      const visibleEntries = canadaEntries.filter((entry) => {
        const feed = getFeedForCatalogEntry(entry);
        return feed ? visibleFeedIds.has(feed.id) : false;
      });

      elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
      elements.articlesGrid.innerHTML = "";

      if (!articlePagination.totalCount) {
        elements.articlesGrid.innerHTML =
          `<div class="empty-state">No imported news available for Canada DMV entries yet.</div>`;
        renderPaginationControls(articlePagination);
        renderDiagnostics.branchName = "canada-grouped-empty";
        intelligenceTimeEnd("renderArticles:dom-update");
        finalizeRenderDiagnostics(renderDiagnostics);
        return;
      }

      const fragment = document.createDocumentFragment();
      logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
      visibleEntries.forEach((entry) => {
        const importedFeed = getFeedForCatalogEntry(entry);
        const feedArticles = importedFeed ? articlesByFeedId.get(importedFeed.id) || [] : [];
        const entryLabel = getCatalogEntrySubdivisionLabel(entry);
        const entryCountry = getCatalogEntryCountry(entry);
        const feedLike = importedFeed || {
          name: entryLabel,
          topic: "General",
          officialUrl: entry.officialUrl,
          rssUrl: "",
          dmvMode: getCatalogEntryMode(entry),
          dmvRegion: entryCountry,
          dmvCountry: entryCountry,
          dmvSubdivision: entryLabel,
          dmvSubdivisionType: entry.subdivisionType || "province-territory",
          dmvSourceFamily: entry.sourceFamily || "dmv",
        };
        const groupCards = feedArticles.length
          ? feedArticles.map((article) => renderArticleCard(article))
          : [renderDmvPlaceholderCard(feedLike)];
        fragment.appendChild(renderFeedGroup(entryLabel, groupCards));
      });
      elements.articlesGrid.appendChild(fragment);
      renderPaginationControls(articlePagination);
      intelligenceTimeEnd("renderArticles:dom-update");
      renderDiagnostics.branchName = "canada-grouped";
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    intelligenceTime("renderArticles:dom-update");
    elements.resultsCount.textContent = `${articlePagination.totalCount} results`;
    elements.articlesGrid.classList.remove("is-grouped-feed-view");
    elements.articlesGrid.classList.remove("has-personal-lanes");
    elements.articlesGrid.innerHTML = "";

    if (!articlePagination.totalCount) {
      const emptyStateMessage = state.filters.canadaDmvAll
        ? "Canada DMV entries are shown as official links unless RSS news is available."
        : selectedCanadaEntry
          ? isCanadaLinkOnlyEntry(selectedCanadaEntry)
            ? "This Canada DMV entry is available as an official link only."
            : "No imported news available for this Canada DMV entry yet."
          : selectedUsDmvEntry
            ? isUsLinkOnlyEntry(selectedUsDmvEntry)
              ? "No RSS feed available for this DMV."
              : "No imported news available for this USA DMV entry yet."
            : selectedUsDmvFeed
              ? "No imported news available for this USA DMV entry yet."
              : "No articles match the active filters.";
      const officialUrl = !state.filters.canadaDmvAll ? selectedDmvOfficialUrl : "";
      renderDmvEmptyState(emptyStateMessage, officialUrl);
      renderPaginationControls(articlePagination);
      renderDiagnostics.branchName = "default-empty";
      intelligenceTimeEnd("renderArticles:dom-update");
      finalizeRenderDiagnostics(renderDiagnostics);
      return;
    }

    logRenderingPageArticlesOnly(groupedArticlesCount, articlesToRender);
    patchSimpleArticleGrid(articlesToRender);
    renderPaginationControls(articlePagination);
    intelligenceTimeEnd("renderArticles:dom-update");
    renderDiagnostics.branchName = state.filters.feedId ? "feed-filter" : "default";
    finalizeRenderDiagnostics(renderDiagnostics);
  } catch (error) {
    renderArticlesFallback(error);
  } finally {
    intelligenceTimeEnd("renderArticles");
    if (shouldDebugFeedRender) {
      const durationMs = Math.round(performance.now() - feedRenderStartedAt);
      debugFeedFilterLog("[feed-render-end]", {
        selectedFeed: state.filters.feedId || "",
        durationMs,
        articleCount: feedRenderFilteredCount,
        groupedCount: feedRenderGroupedCount,
        reason: renderReason,
      });
      debugFeedFilterLog(
        renderReason.includes("feed-filter") ? "[feed-switch-duration]" : "[article-render-duration]",
        {
          durationMs,
          articleCount: feedRenderFilteredCount,
          groupedCount: feedRenderGroupedCount,
          reason: renderReason,
        }
      );
    }
  }
}

function renderDashboard() {
  renderSummary();
  renderPersonalDashboard();
  renderFeedOptions();
  renderTagManager();
  renderDmvOfficialLink();
  renderDmvModeIndicator();
  renderFeedList();
  renderArticles();
  syncFeedFormMode();
  syncFeedPanelVisibility();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return response.json().catch(() => ({}));
}

async function loadAllArticles() {
  // TODO: Personal Dashboard can only inspect this frontend working set unless another backend query path is active.
  const response = await apiRequest(
    `/api/articles?includePagination=true&showDuplicates=true&limit=${MAX_ARTICLES_IN_MEMORY}&page=1`
  );
  const items = Array.isArray(response?.items) ? response.items : [];
  logPersonalDashboardSourceStage("[personal-dashboard-api-response]", items, {
    source: "loadAllArticles",
    totalItems: items.length,
  });
  return {
    totalCount: Number(response?.pagination?.total) || items.length,
    items: items
      .slice()
      .sort((a, b) => new Date(b?.pubDate || 0) - new Date(a?.pubDate || 0))
      .slice(0, MAX_ARTICLES_IN_MEMORY),
  };
}

function applySnapshotPayload(snapshotPayload, options = {}) {
  const { render = true } = options;
  if (!snapshotPayload) {
    return;
  }

  runtime.articleComputationCache.clear();
  runtime.articlePairComputationCache.clear();
  state.feeds = snapshotPayload.feeds;
  rebuildFeedLookupCaches();
  state.articles = snapshotPayload.normalizedArticles;
  logPersonalDashboardSourceStage("[personal-dashboard-frontend-state]", state.articles, {
    source: "loadSnapshot",
    totalAvailable: snapshotPayload.totalAvailable,
    loadedInFrontend: snapshotPayload.normalizedArticles.length,
  });
  state.articleStats = {
    totalAvailable: snapshotPayload.totalAvailable,
    loadedInFrontend: snapshotPayload.normalizedArticles.length,
  };
  runtime.lastSnapshotSignature = snapshotPayload.signature;
  runtime.articleDataRevision += 1;
  rebuildArticleFeedIndexes();
  clearFeedRenderCaches();
  runtime.backendArticleQueryCache.clear();
  debugPerformanceLog("[memory]", {
    totalArticlesAvailable: state.articleStats.totalAvailable,
    articleCountInMemory: state.articles.length,
    feedCount: state.feeds.length,
    articleCacheSize: runtime.articleComputationCache.size,
    articlePairCacheSize: runtime.articlePairComputationCache.size,
    groupedFeedCacheSize: runtime.groupedFeedCache.size,
  });
  state.dmvCatalog = snapshotPayload.dmvCatalog;
  restoreExactArticleFilterFromSession();
  syncDashboardAlerts(snapshotPayload.feeds, snapshotPayload.normalizedArticles);
  syncActivityLog();
  syncNewArticleNotifications(snapshotPayload.normalizedArticles);
  syncFeedErrorNotifications();
  runtime.lastBackgroundRefreshAt = Date.now();

  if (!render) {
    return;
  }

  renderDashboard();
  syncFeedPanelVisibility();
  runtime.lastRefreshStatusAt = runtime.lastBackgroundRefreshAt;
  updateRefreshStatus();
  clearPendingBackgroundRefresh();
}

async function loadSnapshot(options = {}) {
  const background = Boolean(options.background);
  const reason = String(options.reason || (background ? "background-refresh" : "full-refresh"));
  const [feeds, articleResponse, dmvCatalog] = await Promise.all([
    apiRequest("/api/feeds"),
    loadAllArticles(),
    apiRequest("/api/dmv-catalog"),
  ]);
  const previousArticles = Array.isArray(state.articles) ? state.articles.slice() : [];
  const previousSignature = runtime.lastSnapshotSignature || buildArticleSnapshotSignature(previousArticles);
  const normalizedArticles = (articleResponse?.items || [])
    .slice(0, MAX_ARTICLES_IN_MEMORY)
    .map(normalizeLoadedArticle);
  const totalAvailable = Number(articleResponse?.totalCount) || normalizedArticles.length;
  const nextSignature = buildArticleSnapshotSignature(normalizedArticles);
  const newArticleCount = countNewArticles(previousArticles, normalizedArticles);
  const snapshotChanged = previousSignature !== nextSignature;
  const snapshotPayload = {
    feeds: Array.isArray(feeds) ? feeds : [],
    dmvCatalog: Array.isArray(dmvCatalog) ? dmvCatalog : [],
    normalizedArticles,
    totalAvailable,
    signature: nextSignature,
  };

  if (!background) {
    applySnapshotPayload(snapshotPayload, { render: true });
    return;
  }

  runtime.lastBackgroundRefreshAt = Date.now();

  if (!snapshotChanged) {
    runtime.lastRefreshStatusAt = runtime.lastBackgroundRefreshAt;
    updateRefreshStatus();
    return;
  }
  runtime.pendingSnapshot = snapshotPayload;
  runtime.pendingBackgroundRefresh = true;
  runtime.pendingBackgroundRefreshReason = reason;
  runtime.pendingBackgroundNewArticles = Math.max(1, newArticleCount);
  runtime.lastRefreshStatusAt = runtime.lastBackgroundRefreshAt;
  updateRefreshStatus({
    pendingCount: runtime.pendingBackgroundNewArticles,
  });
}

async function refreshFeedsOnly() {
  const feeds = await apiRequest("/api/feeds");
  state.feeds = Array.isArray(feeds) ? feeds : [];
  rebuildFeedLookupCaches();
  clearFeedRenderCaches();
  renderSummary();
  renderFeedOptions();
  renderFeedList();
  syncFeedFormMode();
  syncFeedPanelVisibility();
}

function startPolling() {
  if (runtime.pollTimer) {
    window.clearInterval(runtime.pollTimer);
  }

  if (AUTO_REFRESH_MODE === "off") {
    runtime.pollTimer = null;
    updateRefreshStatus();
    return;
  }

  runtime.pollTimer = window.setInterval(() => {
    void loadSnapshot({ background: true, reason: "polling" });
  }, POLLING_INTERVAL_MS);
  updateRefreshStatus();
}

function initRealtime() {
  if (runtime.eventSource) {
    runtime.eventSource.close();
    runtime.eventSource = null;
  }
  runtime.realtimeEnabled = false;
  startPolling();
}

async function updateFeed(feedId, payload) {
  return apiRequest(`/api/feeds/${feedId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function deleteFeed(feedId) {
  return apiRequest(`/api/feeds/${feedId}`, {
    method: "DELETE",
  });
}

async function importDmvFeeds() {
  if (!elements.importDmvButton) {
    return;
  }

  const originalLabel = elements.importDmvButton.textContent;
  elements.importDmvButton.disabled = true;
  elements.importDmvButton.textContent = "Importing DMV feeds...";
  elements.feedFormStatus.textContent = "Importing DMV feeds...";

  try {
    const result = await apiRequest("/api/admin/import-dmv", {
      method: "POST",
    });

    elements.feedFormStatus.textContent =
      `Imported ${result.imported ?? 0}, skipped ${result.skipped ?? 0}, failed ${result.failed ?? 0}`;
    showNotification({
      title: "DMV import completed",
      message: `Imported ${result.imported ?? 0}, skipped ${result.skipped ?? 0}, failed ${result.failed ?? 0}.`,
      type: result.failed ? "warning" : "success",
    });
    await loadSnapshot();
  } catch (error) {
    elements.feedFormStatus.textContent = error.message;
    showNotification({
      title: "DMV import failed",
      message: error.message,
      type: "warning",
    });
  } finally {
    elements.importDmvButton.disabled = false;
    elements.importDmvButton.textContent = originalLabel;
  }
}

function bindEvents() {
  if (elements.connectionStatus) {
    elements.connectionStatus.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-apply-refresh]") : null;
      if (!target) {
        return;
      }

      updateRefreshStatus({ message: "Refreshing dashboard..." });
      if (runtime.pendingSnapshot) {
        const pendingSnapshot = runtime.pendingSnapshot;
        applySnapshotPayload(pendingSnapshot, { render: true });
        return;
      }
      await loadSnapshot({ background: false, reason: "pending-refresh-apply" });
    });
  }

  if (elements.articlesGrid) {
    elements.articlesGrid.addEventListener("mouseenter", () => {
      runtime.articleGridHovered = true;
      markRefreshInteraction("article-grid-hover");
      updateRefreshStatus();
    });
    elements.articlesGrid.addEventListener("mouseleave", () => {
      runtime.articleGridHovered = false;
      markRefreshInteraction("article-grid-leave", 1500);
      updateRefreshStatus();
      if (runtime.pendingBackgroundRefresh) {
        schedulePendingBackgroundRefresh();
      }
    });
  }

  if (elements.sidebar) {
    elements.sidebar.addEventListener("mouseenter", () => {
      runtime.sidebarHovered = true;
      markRefreshInteraction("sidebar-hover");
      updateRefreshStatus();
    });
    elements.sidebar.addEventListener("mouseleave", () => {
      runtime.sidebarHovered = false;
      markRefreshInteraction("sidebar-leave", 1500);
      updateRefreshStatus();
      if (runtime.pendingBackgroundRefresh) {
        schedulePendingBackgroundRefresh();
      }
    });
  }

  window.addEventListener("scroll", () => {
    markRefreshInteraction("scroll", REFRESH_SCROLL_PAUSE_MS);
    if (runtime.pendingBackgroundRefresh) {
      schedulePendingBackgroundRefresh();
    }
  }, { passive: true });

  const debouncedSearchRender = debounce((value) => {
    clearExactArticleFilter();
    state.filters.search = value;
    scheduleRenderArticles("search-filter", { mode: "frame" });
  }, 250);

  elements.searchFilter.addEventListener("input", (event) => {
    debouncedSearchRender(event.target.value.trim());
  });

  elements.topicFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    state.filters.topic = event.target.value;
    scheduleRenderArticles("topic-filter", { mode: "frame" });
  });

  if (elements.tagFilter) {
    elements.tagFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.tag = normalizeFilterTag(event.target.value);
      scheduleRenderArticles("tag-filter", { mode: "frame" });
    });
  }

  if (elements.signalFilter) {
    elements.signalFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.signalCategory = String(event.target.value || "").trim();
      scheduleRenderArticles("signal-filter", { mode: "frame" });
    });
  }

  if (elements.tagAddButton) {
    elements.tagAddButton.addEventListener("click", addTagFromInput);
  }

  if (elements.tagAddInput) {
    elements.tagAddInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      addTagFromInput();
    });
  }

  if (elements.tagManagerToggle) {
    elements.tagManagerToggle.addEventListener("click", () => {
      state.tagManagerExpanded = !state.tagManagerExpanded;
      syncTagManagerVisibility();
    });
  }

  if (elements.tagResetButton) {
    elements.tagResetButton.addEventListener("click", () => {
      resetActiveTags();
      refreshTagControls();
    });
  }

  if (elements.tagManagerList) {
    elements.tagManagerList.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-remove-tag]") : null;
      if (!target) {
        return;
      }

      if (target.dataset.confirmRemove !== "true") {
        elements.tagManagerList.querySelectorAll("[data-confirm-remove='true']").forEach((button) => {
          button.dataset.confirmRemove = "false";
          button.textContent = "remove";
          button.setAttribute("aria-label", `Prepare to remove ${button.dataset.removeTag || "tag"}`);
        });
        target.dataset.confirmRemove = "true";
        target.textContent = "confirm";
        target.setAttribute("aria-label", `Confirm removing ${target.dataset.removeTag || "tag"}`);
        return;
      }

      removeActiveTag(target.dataset.removeTag || "");
    });
  }

  if (elements.keywordToggle) {
    elements.keywordToggle.addEventListener("click", () => {
      state.noiseKeywordsExpanded = !state.noiseKeywordsExpanded;
      window.localStorage.setItem(NOISE_KEYWORDS_EXPANDED_STORAGE_KEY, String(state.noiseKeywordsExpanded));
      syncNoiseKeywordVisibility();
    });
  }

  [elements.includeKeywordsInput, elements.excludeKeywordsInput].forEach((input) => {
    input?.addEventListener("change", applyKeywordInputs);
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      applyKeywordInputs();
    });
  });

  if (elements.keywordResetButton) {
    elements.keywordResetButton.addEventListener("click", () => {
      resetKeywordFilters();
      scheduleRenderArticles("keyword-reset", { mode: "frame" });
    });
  }

  if (elements.personalDashboardGroups) {
    elements.personalDashboardGroups.addEventListener("click", (event) => {
      const groupToggle = event.target instanceof Element
        ? event.target.closest("[data-personal-group-toggle]")
        : null;
      if (groupToggle) {
        togglePersonalDashboardGroup(groupToggle.dataset.personalGroupToggle || "");
        return;
      }

      const removeInterest = event.target instanceof Element
        ? event.target.closest("[data-remove-personal-interest]")
        : null;
      if (removeInterest) {
        setPersonalDashboardInterest(removeInterest.dataset.removePersonalInterest || "", false);
      }
    });

    elements.personalDashboardGroups.addEventListener("change", (event) => {
      const checkbox = event.target instanceof Element
        ? event.target.closest("[data-personal-interest]")
        : null;
      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      setPersonalDashboardInterest(checkbox.dataset.personalInterest || "", checkbox.checked);
    });
  }

  if (elements.personalDashboardInterests) {
    elements.personalDashboardInterests.addEventListener("click", (event) => {
      const removeInterest = event.target instanceof Element
        ? event.target.closest("[data-remove-personal-interest]")
        : null;
      if (!removeInterest) {
        return;
      }

      setPersonalDashboardInterest(removeInterest.dataset.removePersonalInterest || "", false);
    });
  }

  if (elements.personalDashboardClear) {
    elements.personalDashboardClear.addEventListener("click", () => {
      clearPersonalDashboardPreferences();
      renderPersonalDashboard();
      clearFeedRenderCaches();
      scheduleRenderArticles("personal-dashboard-clear", { mode: "frame" });
    });
  }

  elements.feedFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    const rawValue = String(event.target.value || "").trim();
    const resolvedFeed = resolveFeedForDiagnostics(rawValue);
    state.filters.feedId = resolvedFeed ? getUniqueFeedIdentity(resolvedFeed) : rawValue;
    debugFeedFilterLog("[selected-feed-change]", {
      rawValue,
      selectedFeedState: state.filters.feedId,
      resolvedFeed: resolvedFeed?.name || "",
      resolvedFeedId: String(resolvedFeed?.id || "").trim(),
      resolvedDomain: getFeedDiagnosticDomain(resolvedFeed),
    });
    state.filters.dmvFeedId = "";
    state.filters.canadaDmvFeedPath = "";
    state.filters.canadaDmvAll = false;
    state.dashboardMode = "normal";
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
    if (elements.canadaDmvFilter) {
      elements.canadaDmvFilter.value = "";
    }
    scheduleRenderArticles("feed-filter", { mode: "timeout" });
  });

  if (elements.dmvFeedFilter) {
    elements.dmvFeedFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.dmvFeedId = event.target.value;
      state.filters.feedId = "";
      state.filters.canadaDmvFeedPath = "";
      state.filters.canadaDmvAll = false;
      state.dashboardMode = "normal";
      elements.feedFilter.value = "";
      if (elements.canadaDmvFilter) {
        elements.canadaDmvFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      scheduleRenderArticles("dmv-feed-filter", { mode: "frame" });
    });
  }

  if (elements.canadaDmvFilter) {
    elements.canadaDmvFilter.addEventListener("change", (event) => {
      clearExactArticleFilter();
      state.filters.canadaDmvFeedPath = event.target.value;
      state.filters.canadaDmvAll = event.target.value === "";
      state.filters.feedId = "";
      state.filters.dmvFeedId = "";
      state.dashboardMode = "normal";
      elements.feedFilter.value = "";
      if (elements.dmvFeedFilter) {
        elements.dmvFeedFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      scheduleRenderArticles("canada-dmv-filter", { mode: "frame" });
    });
  }

  elements.dateFilter.addEventListener("change", (event) => {
    clearExactArticleFilter();
    state.filters.date = event.target.value;
    renderSummary();
    scheduleRenderArticles("date-filter", { mode: "frame" });
  });

  elements.paginationPrev?.addEventListener("click", () => {
    if (state.pagination.page <= 1) {
      return;
    }

    state.pagination.page -= 1;
    scheduleRenderArticles("pagination-prev", { mode: "frame" });
  });

  elements.paginationNext?.addEventListener("click", () => {
    state.pagination.page += 1;
    scheduleRenderArticles("pagination-next", { mode: "frame" });
  });

  elements.summaryGrid.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const dismissButton = target?.closest("[data-dismiss-dashboard-alert]");
    if (dismissButton) {
      dismissDashboardAlert(dismissButton.dataset.dismissDashboardAlert || "");
      return;
    }

    const dismissActivityButton = target?.closest("[data-dismiss-activity-item]");
    if (dismissActivityButton) {
      dismissActivityItem(dismissActivityButton.dataset.dismissActivityItem || "");
      return;
    }

    const clearActivityButton = target?.closest("[data-clear-activity-log]");
    if (clearActivityButton) {
      clearActivityLog();
      return;
    }

    const analyticsScopeTarget = getAnalyticsScopeTargetFromEvent(event);
    if (analyticsScopeTarget) {
      state.analyticsScope = analyticsScopeTarget.dataset.analyticsScope === "active" ? "active" : "all";
      renderSummary();
      return;
    }

    const analyticsQualityFilterTarget = getAnalyticsQualityFilterTargetFromEvent(event);
    if (analyticsQualityFilterTarget) {
      const nextFilter = analyticsQualityFilterTarget.dataset.analyticsQualityFilter || "all";
      state.analyticsQualityFilter = ["high", "inactive", "zero"].includes(nextFilter) ? nextFilter : "all";
      renderSummary();
      return;
    }

    const dashboardAlertTarget = getDashboardAlertTargetFromEvent(event);
    if (dashboardAlertTarget) {
      const alert = runtime.dashboardAlerts.find((item) => item.id === dashboardAlertTarget.dataset.alertId);
      applyAlertArticleFilter(alert);
      return;
    }

    const activityTarget = getActivityLogTargetFromEvent(event);
    if (activityTarget) {
      const activityItem = runtime.activityLog.find((item) => item.id === activityTarget.dataset.activityId);
      applyActivityItemFilter(activityItem);
      return;
    }

    const analyticsFeedTarget = getAnalyticsFeedTargetFromEvent(event);
    if (analyticsFeedTarget) {
      applyAnalyticsFeedFilter({
        feedId: analyticsFeedTarget.dataset.analyticsFeedId || "",
        todayOnly: analyticsFeedTarget.dataset.analyticsTodayOnly === "true",
      });
      return;
    }

    const analyticsFilterTarget = getAnalyticsFilterTargetFromEvent(event);
    if (analyticsFilterTarget) {
      applyAnalyticsFilter({
        topic: analyticsFilterTarget.dataset.analyticsTopic || "",
        todayOnly: analyticsFilterTarget.dataset.analyticsTodayOnly === "true",
      });
      return;
    }

    const todayCard = getTodaySummaryCardFromEvent(event);
    if (todayCard) {
      applyTodayArticleFilter();
    }
  });

  elements.summaryGrid.addEventListener("keydown", (event) => {
    const dashboardAlertTarget = getDashboardAlertTargetFromEvent(event);
    if (dashboardAlertTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const alert = runtime.dashboardAlerts.find((item) => item.id === dashboardAlertTarget.dataset.alertId);
      applyAlertArticleFilter(alert);
      return;
    }

    const activityTarget = getActivityLogTargetFromEvent(event);
    if (activityTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const activityItem = runtime.activityLog.find((item) => item.id === activityTarget.dataset.activityId);
      applyActivityItemFilter(activityItem);
      return;
    }

    const analyticsFeedTarget = getAnalyticsFeedTargetFromEvent(event);
    if (analyticsFeedTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      applyAnalyticsFeedFilter({
        feedId: analyticsFeedTarget.dataset.analyticsFeedId || "",
        todayOnly: analyticsFeedTarget.dataset.analyticsTodayOnly === "true",
      });
      return;
    }

    const analyticsFilterTarget = getAnalyticsFilterTargetFromEvent(event);
    if (analyticsFilterTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      applyAnalyticsFilter({
        topic: analyticsFilterTarget.dataset.analyticsTopic || "",
        todayOnly: analyticsFilterTarget.dataset.analyticsTodayOnly === "true",
      });
      return;
    }

    const todayCard = getTodaySummaryCardFromEvent(event);
    if (!todayCard || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    applyTodayArticleFilter();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.filters = {
      search: "",
      topic: "",
      tag: "",
      signalCategory: "",
      feedId: "",
      dmvFeedId: "",
      canadaDmvFeedPath: "",
      canadaDmvAll: false,
      sourceGroup: "all",
      date: "",
      articleIds: [],
      alertLabel: "",
    };
    clearStoredExactArticleFilter();
    resetKeywordFilters();
    state.dashboardMode = "normal";

    elements.searchFilter.value = "";
    elements.topicFilter.value = "";
    if (elements.tagFilter) {
      elements.tagFilter.value = "";
    }
    if (elements.signalFilter) {
      elements.signalFilter.value = "";
    }
    elements.feedFilter.value = "";
    if (elements.dmvFeedFilter) {
      elements.dmvFeedFilter.value = "";
    }
    if (elements.canadaDmvFilter) {
      elements.canadaDmvFilter.value = "";
    }
    elements.dateFilter.value = "";
    if (elements.feedPanelSearch) {
      elements.feedPanelSearch.value = "";
    }
    if (elements.feedVisibilityFilter) {
      elements.feedVisibilityFilter.value = "all";
    }
    renderDmvOfficialLink();
    renderDmvModeIndicator();
    renderSummary();
    scheduleRenderArticles("clear-filters", { mode: "frame" });
    renderFeedList();
  });

  if (elements.activeFilterList) {
    elements.activeFilterList.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest("[data-clear-filter]");
      if (!button) {
        return;
      }

      clearActiveFilter(button.dataset.clearFilter || "");
    });
  }

  elements.themeToggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  elements.refreshButton.addEventListener("click", async () => {
    updateRefreshStatus({ message: "Refreshing dashboard..." });
    try {
      if (runtime.pendingSnapshot) {
        const pendingSnapshot = runtime.pendingSnapshot;
        applySnapshotPayload(pendingSnapshot, { render: true });
        showNotification({
          title: "Dashboard refreshed",
          message: "New cached articles have been applied.",
          type: "success",
        });
        return;
      }
      await loadSnapshot({ background: false, reason: "manual-refresh" });
      showNotification({
        title: "Dashboard refreshed",
        message: "Latest stored articles have been loaded.",
        type: "success",
      });
    } catch (error) {
      updateRefreshStatus({ message: error.message });
      showNotification({
        title: "Dashboard refresh failed",
        message: error.message,
        type: "warning",
      });
    }
  });

  elements.feedForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selectedSourceType = normalizeFeedSourceTypeValue(elements.feedSourceType?.value || "rss");
    if (!state.editingFeedId && selectedSourceType === "rss" && getRssBackedFeedCount() >= MAX_RSS_FEEDS) {
      elements.feedFormStatus.textContent = MAX_RSS_FEEDS_MESSAGE;
      syncFeedFormMode();
      return;
    }

    elements.feedSubmit.disabled = true;
    const isEditing = Boolean(state.editingFeedId);
    elements.feedFormStatus.textContent = isEditing ? "Saving changes..." : "Adding source...";

    try {
      const payload = {
        name: elements.feedName.value.trim(),
        topic: elements.feedTopic.value.trim(),
        rssUrl: elements.feedUrl.value.trim(),
        sourceType: selectedSourceType,
      };

      debugIntelligenceLog("[add-source]", {
        sourceName: payload.name,
        topic: payload.topic,
        sourceType: selectedSourceType,
        sourceUrl: payload.rssUrl,
        requestPayload: payload,
      });

      if (isEditing) {
        const updatedFeed = await updateFeed(state.editingFeedId, payload);
        state.feeds = state.feeds.map((feed) => (feed.id === updatedFeed.id ? updatedFeed : feed));
        rebuildFeedLookupCaches();
        clearFeedRenderCaches();
        renderSummary();
        renderFeedOptions();
        renderFeedList();
        elements.feedFormStatus.textContent = "Source updated.";
        showNotification({
          title: "Source updated",
          message: payload.name || "Source updated successfully.",
          type: "success",
        });
      } else {
        const responseBody = await apiRequest("/api/feeds", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            isActive: true,
          }),
        });
        state.feeds = [responseBody].concat(state.feeds.filter((feed) => feed.id !== responseBody.id));
        rebuildFeedLookupCaches();
        clearFeedRenderCaches();
        renderSummary();
        renderFeedOptions();
        renderFeedList();
        debugIntelligenceLog("[add-source-response]", {
          sourceName: payload.name,
          topic: payload.topic,
          sourceType: selectedSourceType,
          sourceUrl: payload.rssUrl,
          responseStatus: 201,
          responseBody,
        });
        elements.feedFormStatus.textContent = "Source added.";
        showNotification({
          title: "Source added",
          message: payload.name || "Source added successfully.",
          type: "success",
        });
      }

      resetFeedForm({ preserveStatus: true });
      syncAddSourcePanel(false);
      syncFeedFormMode();
    } catch (error) {
      const errorMessage = error?.message || "Could not add source.";
      debugIntelligenceLog("[add-source-error]", {
        sourceName: elements.feedName.value.trim(),
        topic: elements.feedTopic.value.trim(),
        sourceType: selectedSourceType,
        sourceUrl: elements.feedUrl.value.trim(),
        responseStatus: "error",
        responseBody: errorMessage,
      });
      elements.feedFormStatus.textContent = `Could not add source: ${errorMessage}`;
      showNotification({
        title: "Could not add source",
        message: errorMessage,
        type: "warning",
      });
    } finally {
      syncFeedFormMode();
    }
  });

  if (elements.importDmvButton) {
    elements.importDmvButton.addEventListener("click", async () => {
      await importDmvFeeds();
    });
  }

  if (elements.googleAlertsBatchSubmit) {
    elements.googleAlertsBatchSubmit.addEventListener("click", async () => {
      const { parsed, invalid: clientInvalid } = parseGoogleAlertsBatchInput(elements.googleAlertsBatchInput?.value || "");
      if (!parsed.length && clientInvalid.length) {
        elements.googleAlertsBatchStatus.textContent = `No valid rows found. ${clientInvalid.length} row${clientInvalid.length === 1 ? "" : "s"} need the format: feed name | RSS URL | topic.`;
        showNotification({
          title: "Google Alerts import needs review",
          message: elements.googleAlertsBatchStatus.textContent,
          type: "warning",
        });
        return;
      }
      if (!parsed.length) {
        elements.googleAlertsBatchStatus.textContent = "Paste at least one Google Alerts RSS feed.";
        return;
      }

      elements.googleAlertsBatchSubmit.disabled = true;
      elements.googleAlertsBatchStatus.textContent = `Validating ${parsed.length} Google Alerts feed${parsed.length === 1 ? "" : "s"}...`;

      try {
        const result = await apiRequest("/api/feeds/batch-google-alerts", {
          method: "POST",
          body: JSON.stringify({ feeds: parsed }),
        });
        const addedFeeds = Array.isArray(result.added) ? result.added : [];
        if (addedFeeds.length) {
          state.feeds = addedFeeds.concat(
            state.feeds.filter((feed) => !addedFeeds.some((addedFeed) => addedFeed.id === feed.id))
          );
          rebuildFeedLookupCaches();
          clearFeedRenderCaches();
          renderSummary();
          renderFeedOptions();
          renderFeedList();
        }

        const summary = result.summary || {};
        const invalidCount = Number(summary.invalid || 0) + clientInvalid.length;
        const totalImported = Number(summary.totalImported ?? summary.added ?? 0);
        elements.googleAlertsBatchStatus.textContent =
          `Google Alerts import complete: ${Number(summary.added || 0)} added, ` +
          `${Number(summary.skippedDuplicate || 0)} skipped duplicate, ${invalidCount} invalid, ` +
          `${totalImported} total imported.`;
        showNotification({
          title: "Google Alerts import complete",
          message: elements.googleAlertsBatchStatus.textContent,
          type: Number(summary.added || 0) > 0 ? "success" : "warning",
        });

        if (Number(summary.added || 0) > 0 && elements.googleAlertsBatchInput) {
          elements.googleAlertsBatchInput.value = "";
        }
      } catch (error) {
        const errorMessage = error?.message || "Could not import Google Alerts feeds.";
        elements.googleAlertsBatchStatus.textContent = `Could not import Google Alerts feeds: ${errorMessage}`;
        showNotification({
          title: "Google Alerts import failed",
          message: errorMessage,
          type: "warning",
        });
      } finally {
        elements.googleAlertsBatchSubmit.disabled = false;
        syncFeedFormMode();
      }
    });
  }

  if (elements.feedCancel) {
    elements.feedCancel.addEventListener("click", () => {
      resetFeedForm();
    });
  }

  if (elements.feedSourceType) {
    elements.feedSourceType.addEventListener("change", () => {
      syncFeedFormMode();
    });
  }

  if (elements.dmvToggleButton) {
    elements.dmvToggleButton.addEventListener("click", () => {
      clearExactArticleFilter();
      state.dashboardMode = state.dashboardMode === "usa" ? "normal" : "usa";
      state.filters.feedId = "";
      state.filters.dmvFeedId = "";
      state.filters.canadaDmvFeedPath = "";
      state.filters.canadaDmvAll = false;
      elements.feedFilter.value = "";
      if (elements.dmvFeedFilter) {
        elements.dmvFeedFilter.value = "";
      }
      if (elements.canadaDmvFilter) {
        elements.canadaDmvFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      scheduleRenderArticles("usa-dashboard-toggle", { mode: "frame" });
    });
  }

  if (elements.canadaToggleButton) {
    elements.canadaToggleButton.addEventListener("click", () => {
      clearExactArticleFilter();
      state.dashboardMode = state.dashboardMode === "canada" ? "normal" : "canada";
      state.filters.feedId = "";
      state.filters.dmvFeedId = "";
      state.filters.canadaDmvFeedPath = "";
      state.filters.canadaDmvAll = false;
      elements.feedFilter.value = "";
      if (elements.dmvFeedFilter) {
        elements.dmvFeedFilter.value = "";
      }
      if (elements.canadaDmvFilter) {
        elements.canadaDmvFilter.value = "";
      }
      renderFeedList();
      renderDmvOfficialLink();
      renderDmvModeIndicator();
      scheduleRenderArticles("canada-dashboard-toggle", { mode: "frame" });
    });
  }

  if (elements.feedPanelSearch) {
    elements.feedPanelSearch.addEventListener(
      "input",
      debounce(() => {
        renderFeedList();
      }, 150)
    );
  }

  if (elements.feedVisibilityFilter) {
    elements.feedVisibilityFilter.addEventListener("change", () => {
      renderFeedList();
    });
  }

  if (elements.feedGroupTabs) {
    elements.feedGroupTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-source-group]");
      if (!button) {
        return;
      }

      state.filters.sourceGroup = button.dataset.sourceGroup || "all";
      renderFeedList();
    });
  }

  if (elements.feedPanelToggle && elements.feedPanelContent) {
    syncFeedPanelVisibility();

    elements.feedPanelToggle.addEventListener("click", () => {
      state.feedPanelCollapsed = !state.feedPanelCollapsed;
      syncFeedPanelVisibility();
      window.localStorage.setItem(
        FEED_PANEL_COLLAPSED_STORAGE_KEY,
        String(state.feedPanelCollapsed)
      );
    });
  }

  if (elements.addSourceToggle && elements.addSourceContent) {
    syncAddSourcePanel(false);

    elements.addSourceToggle.addEventListener("click", () => {
      const expanded = elements.addSourceToggle.getAttribute("aria-expanded") === "true";
      syncAddSourcePanel(!expanded);
    });
  }

  elements.feedList.addEventListener("click", async (event) => {
    const viewButton = event.target.closest('[data-action="view-feed-articles"]');
    const editButton = event.target.closest('[data-action="edit-feed"]');
    const deleteButton = event.target.closest('[data-action="delete-feed"]');

    if (viewButton) {
      const feedId = viewButton.dataset.feedId;
      applySourceListFeedFilter(feedId);
      return;
    }

    if (editButton) {
      const feedId = editButton.dataset.feedId;
      const feed = state.feeds.find((item) => item.id === feedId);
      if (!feed) {
        return;
      }
      startFeedEdit(feed);

      return;
    }

    if (deleteButton) {
      const feedId = deleteButton.dataset.feedId;
      const confirmed = window.confirm("Delete this feed?");
      if (!confirmed) {
        return;
      }

      try {
        elements.feedFormStatus.textContent = "Deleting feed...";
        await deleteFeed(feedId);
        elements.feedFormStatus.textContent = "Feed deleted.";
        await loadSnapshot();
      } catch (error) {
        elements.feedFormStatus.textContent = error.message;
      }
    }
  });
}

async function init() {
  console.info("APP_BUILD", APP_BUILD);
  loadTheme();
  loadActiveTags();
  loadKeywordFilters();
  loadPersonalDashboardPreferences();
  ensurePersonalDashboardElements();
  runtime.activityLog = SHOW_ACTIVITY_LOG ? loadStoredActivityLog() : [];
  runtime.activityLogId = SHOW_ACTIVITY_LOG
    ? runtime.activityLog.reduce((maxId, entry) => Math.max(maxId, Number(entry.id) || 0), 0)
    : 0;
  state.noiseKeywordsExpanded = isNoiseKeywordsExpanded();
  state.feedPanelCollapsed = isFeedPanelCollapsed();
  resetDashboardState();
  syncFeedFormMode();
  bindEvents();
  renderSkeletons();
  syncNoiseKeywordVisibility();
  await loadSnapshot();
  syncNoiseKeywordVisibility();
  syncFeedPanelVisibility();
  initRealtime();
}

window.addEventListener("beforeunload", () => {
  if (runtime.pollTimer) {
    window.clearInterval(runtime.pollTimer);
  }

  if (runtime.eventSource) {
    runtime.eventSource.close();
  }
});

void init();
