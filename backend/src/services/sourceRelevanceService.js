export const SOURCE_RELEVANCE_RULES = [
  {
    name: "G+D Press Releases",
    sourceKeys: ["g+d press releases", "gi-de.com/en/about-us/press/press-releases"],
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
