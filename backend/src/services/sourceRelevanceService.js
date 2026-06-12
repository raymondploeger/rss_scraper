export const SOURCE_RELEVANCE_RULES = [
  {
    name: "Veridos Press & Media",
    sourceKeys: ["veridos press & media", "veridos.com/en/about/press-media"],
    rejectPagePatterns: [
      "/home.html",
      "/career",
      "/careers",
      "/downloads",
      "/imprint",
      "/projects",
      "/support",
    ],
    rejectExactPaths: [
      "/en",
      "/home",
      "/en/home",
      "/en/home.html",
      "/en/about/press-media",
      "/en/about/press-media/press-releases",
    ],
    rejectTitlePatterns: [
      "careers",
      "downloads",
      "home",
      "imprint",
      "projects",
      "support",
    ],
    include: [
      "credential",
      "credentials",
      "eid",
      "government identity",
      "identity",
      "identity document",
      "identity documents",
      "id card",
      "id cards",
      "passport",
      "passports",
      "secure document",
      "secure documents",
      "secure identities",
      "secure identity",
      "travel document",
      "travel documents",
    ],
    exclude: [
      "career",
      "careers",
      "download",
      "downloads",
      "imprint",
      "job",
      "jobs",
      "project overview",
      "support",
    ],
  },
  {
    name: "IN Groupe Newsroom",
    sourceKeys: ["in groupe newsroom", "ingroupe.com/newsroom"],
    rejectPagePatterns: [
      "/a-global-company",
      "/about",
      "/brands",
      "/company",
      "/customer-case",
      "/customer-cases",
      "/customers",
      "/dsar",
      "/group",
      "/integrity-and-compliance",
      "/innovation",
      "/leadership",
      "/media-library",
      "/mediatheque",
      "/newsroom/media",
      "/purpose",
      "/responsibility",
      "/strategy",
      "/values",
      "/values-purpose",
      "/vision-and-strategy",
      "/you-are-government",
      "/you-are-business",
    ],
    rejectExactPaths: [
      "/newsroom",
      "/en/newsroom",
      "/fr/newsroom",
    ],
    rejectTitlePatterns: [
      "corporate responsibility",
      "customer case",
      "customer cases",
      "data subject access request",
      "media library",
      "new organization and executive committee",
      "the group brands",
      "newsroom",
      "welcome to our media library",
      "welcome to our newsroom",
      "we help governments assert their sovereignty",
    ],
    include: [
      "credential",
      "credentials",
      "banknote",
      "banknotes",
      "digital identity",
      "eid",
      "government identity",
      "identities",
      "identity",
      "identity document",
      "identity documents",
      "id card",
      "id cards",
      "passport",
      "passports",
      "secure document",
      "secure documents",
      "secure identity",
      "secure identities",
      "security thread",
    ],
    exclude: [
      "compliance",
      "corporate responsibility",
      "customer case",
      "customer cases",
      "media library",
      "values and purpose",
      "vision and strategy",
    ],
  },
  {
    name: "HID Press Releases",
    sourceKeys: ["hid press releases", "newsroom.hidglobal.com/press-releases"],
    rejectPagePatterns: [
      "/es/press-releases",
      "/pt/press-releases",
      "/de/press-releases",
      "/fr/press-releases",
    ],
    rejectExactPaths: [
      "/press-releases",
      "/en/press-releases",
      "/es/press-releases",
      "/pt/press-releases",
      "/de/press-releases",
      "/fr/press-releases",
    ],
    rejectTitlePatterns: [
      "press releases",
    ],
    include: [
      "credential",
      "credentials",
      "document",
      "documents",
      "eid",
      "government id",
      "government identity",
      "identity",
      "identity document",
      "identity documents",
      "id card",
      "id cards",
      "passport",
      "passports",
      "secure identity",
      "secure identities",
    ],
    exclude: [
      "commercial launch",
      "embedded application environment",
      "mercury security",
      "press release index",
      "school safety",
    ],
  },
  {
    name: "SICPA Newsroom",
    sourceKeys: ["sicpa newsroom", "sicpa.com/all-press-releases"],
    include: [
      "anti-counterfeit",
      "authentication",
      "banknote",
      "banknotes",
      "digital identity",
      "digital identity wallet",
      "digital passport",
      "digital travel credential",
      "eid",
      "excise stamp",
      "identity document",
      "id document",
      "passport",
      "passports",
      "secure document",
      "security printing",
      "sovereign solutions",
      "tax stamp",
    ],
    protectedInclude: [
      "anti-counterfeit",
      "authentication",
      "banknote",
      "banknotes",
      "digital identity wallet",
      "digital passport",
      "digital travel credential",
      "eid",
      "excise stamp",
      "identity document",
      "id document",
      "passport",
      "passports",
      "secure document",
      "security printing",
      "tax stamp",
    ],
    exclude: [
      "campus",
      "community",
      "corporate social responsibility",
      "csr",
      "education",
      "erp",
      "fuel integrity",
      "fuel marking",
      "minergie",
      "sap",
      "sustainability report",
      "underserved communities",
      "water scarcity",
    ],
  },
  {
    name: "G+D Press Releases",
    sourceKeys: ["g+d press releases", "gi-de.com/en/about-us/press/press-releases"],
    rejectPagePatterns: [
      "/about-us/ventures",
      "/currency-technology/currency-management",
      "/currency-technology/software",
      "/currency-technology/cash",
      "/identity-technologies/veridos",
      "/ventures",
      "/veridos",
    ],
    rejectExactPaths: [
      "/en",
      "/en/about-us/press/press-releases",
    ],
    rejectTitlePatterns: [
      "end-to-end cash and currency management",
      "g+d ventures",
      "secure cash management software",
      "veridos - your trusted identity partner",
    ],
    include: [
      "authentication",
      "banknote",
      "banknotes",
      "cash",
      "credential",
      "credentials",
      "currency",
      "government identity",
      "identity",
      "identity documents",
      "identity technology",
      "passport",
      "passports",
      "public sector identity",
      "secure document",
      "secure documents",
      "secure identities",
      "secure identity",
      "security printing",
      "sovereign solutions",
      "veridos",
      "xtec",
    ],
    exclude: [
      "5g",
      "asset tracking",
      "banking market",
      "cloud-based remote esim",
      "compliance expert",
      "connected car",
      "connectivity",
      "crypto",
      "digital payments",
      "esim",
      "e-sim",
      "iot",
      "mobile ticketing",
      "netcetera",
      "payment security",
      "payment",
      "payments",
      "rabo investments",
      "remote esim",
      "rivian",
      "secunet",
      "sim",
      "telecom",
      "telecommunications",
      "trusted software",
      "wearable",
    ],
  },
  {
    name: "KURZ Press Releases",
    sourceKeys: ["kurz press releases", "kurz-world.com/en/newsroom/press"],
    include: [
      "anti-counterfeit",
      "anticounterfeit",
      "banknote",
      "banknotes",
      "card",
      "cards",
      "counterfeit",
      "counterfeits",
      "currency",
      "forgeries",
      "forgery",
      "high security",
      "hologram",
      "holograms",
      "holography",
      "identity",
      "ovd",
      "optical security",
      "secure document",
      "secure documents",
      "security feature",
      "security features",
      "security printing",
      "trustseal",
    ],
    protectedInclude: [
      "anti-counterfeit",
      "anticounterfeit",
      "banknote",
      "banknotes",
      "counterfeit protection",
      "counterfeit",
      "counterfeits",
      "forgeries",
      "forgery",
      "hologram",
      "holograms",
      "holography",
      "ovd",
      "security against counterfeits",
      "security feature",
      "security features",
      "security printing",
    ],
    exclude: [
      "automotive",
      "beverage",
      "brand enhancement",
      "consumer electronics",
      "cosmetics",
      "decoration",
      "decorative",
      "decorative finishing",
      "embellishment",
      "home appliances",
      "jersey",
      "labels",
      "luxe pack",
      "mobility",
      "packaging",
      "pentawards",
      "rpet",
      "spirits",
      "surface finishing",
      "textile",
      "textiles",
      "vestel",
      "wine",
      "wine & spirits",
    ],
  },
  {
    name: "Bundesdruckerei Press Releases",
    sourceKeys: ["bundesdruckerei press releases", "bundesdruckerei.de/en/newsroom/press-releases"],
    rejectPagePatterns: [
      "/antragsportal",
      "/d-trust/portal",
      "/ehealth-antragsportal",
      "/fields-of-use",
      "/fields-use",
      "/group",
      "/portal",
      "/solutions",
      "/trust-services",
    ],
    rejectExactPaths: [
      "/de",
      "/en/newsroom",
      "/en/newsroom/latest-news",
      "/en/newsroom/press-releases",
    ],
    rejectTitlePatterns: [
      "d-trust ehealth antragsportal",
      "d-trust portal",
      "latest news",
      "press releases of the bundesdruckerei-group",
    ],
    include: [
      "ausweis",
      "banknote",
      "banknotes",
      "d-trust",
      "eid",
      "government identity",
      "government solutions",
      "identity document",
      "identity documents",
      "id card",
      "id cards",
      "passport",
      "passports",
      "secure identities",
      "secure identity",
      "security printing",
      "self-sovereign identity",
      "trust service",
      "trust services",
    ],
    exclude: [
      "accessibility",
      "accessibility statement",
      "adva network",
      "company restructures",
      "company structure",
      "cooperates with start-ups",
      "corporate",
      "corporate governance",
      "event",
      "events",
      "genua",
      "group structure",
      "innovation hub",
      "industrial remote maintenance",
      "management board",
      "remote maintenance",
      "secunet",
      "start-ups",
      "supervisory board",
      "telematics infrastructure",
      "whistleblowing",
    ],
  },
];

export function getSourceRelevanceRule(feed) {
  const fingerprint = [
    feed?.name,
    feed?.rssUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return SOURCE_RELEVANCE_RULES.find((rule) =>
    rule.sourceKeys.some((sourceKey) => fingerprint.includes(sourceKey))
  ) || null;
}

function buildSourceTermPattern(term) {
  const normalizedTerm = String(term || "").trim().toLowerCase();
  if (!normalizedTerm) {
    return null;
  }

  const escaped = normalizedTerm
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s\\-/&]+");

  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

export function findSourceRuleMatches(text, terms = []) {
  return terms.filter((term) => {
    const pattern = buildSourceTermPattern(term);
    return pattern ? pattern.test(text) : false;
  });
}

function getArticlePath(article) {
  const rawUrl = String(article?.link || "").trim();
  if (!rawUrl) {
    return "";
  }

  try {
    const parsed = new URL(rawUrl, "https://example.invalid");
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return pathname.toLowerCase();
  } catch {
    return rawUrl.split("?")[0].replace(/\/+$/, "").toLowerCase();
  }
}

function findRejectedPageMatches(rule, article) {
  const articlePath = getArticlePath(article);
  const title = String(article?.title || "").trim().toLowerCase();
  const rejectedExactPaths = (rule.rejectExactPaths || []).filter((path) =>
    articlePath === String(path || "").replace(/\/+$/, "").toLowerCase()
  );
  const rejectedPathPatterns = (rule.rejectPagePatterns || []).filter((pattern) =>
    articlePath.includes(String(pattern || "").toLowerCase())
  );
  const rejectedTitlePatterns = (rule.rejectTitlePatterns || []).filter((pattern) =>
    title.includes(String(pattern || "").toLowerCase())
  );

  return [
    ...rejectedExactPaths.map((match) => `path:${match}`),
    ...rejectedPathPatterns.map((match) => `path-pattern:${match}`),
    ...rejectedTitlePatterns.map((match) => `title:${match}`),
  ];
}

export function getSourceRelevanceAssessment(feed, article) {
  const rule = getSourceRelevanceRule(feed);
  if (!rule) {
    return {
      accepted: true,
      rule: null,
      includedTerms: [],
      excludedTerms: [],
      reason: "no-source-rule",
    };
  }

  const articleText = [
    article?.title,
    article?.link,
    article?.contentSnippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const rejectedPageMatches = findRejectedPageMatches(rule, article);
  if (rejectedPageMatches.length) {
    return {
      accepted: false,
      rule,
      includedTerms: findSourceRuleMatches(articleText, rule.include),
      excludedTerms: findSourceRuleMatches(articleText, rule.exclude),
      rejectedPageMatches,
      reason: `rejected-page:${rejectedPageMatches.join(", ")}`,
    };
  }

  const protectedText = [
    article?.title,
    article?.link,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const protectedTerms = findSourceRuleMatches(protectedText, rule.protectedInclude || []);
  if (protectedTerms.length) {
    return {
      accepted: true,
      rule,
      includedTerms: findSourceRuleMatches(articleText, rule.include),
      excludedTerms: findSourceRuleMatches(articleText, rule.exclude),
      protectedTerms,
      reason: `protected-source-term:${protectedTerms.join(", ")}`,
    };
  }

  const excludedTerms = findSourceRuleMatches(articleText, rule.exclude);
  if (excludedTerms.length) {
    return {
      accepted: false,
      rule,
      includedTerms: findSourceRuleMatches(articleText, rule.include),
      excludedTerms,
      reason: `excluded-term:${excludedTerms.join(", ")}`,
    };
  }

  const includedTerms = findSourceRuleMatches(articleText, rule.include);
  return {
    accepted: includedTerms.length > 0,
    rule,
    includedTerms,
    excludedTerms: [],
    reason: includedTerms.length > 0 ? "included-term" : "missing-allowlist-term",
  };
}

export function articleMatchesSourceRelevanceRule(feed, article) {
  return getSourceRelevanceAssessment(feed, article).accepted;
}
