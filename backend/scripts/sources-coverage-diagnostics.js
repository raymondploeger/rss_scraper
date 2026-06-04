import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceAnalysisDir = path.resolve(__dirname, "../data/source-analysis");
const keesingWorkbookPath = path.join(sourceAnalysisDir, "keesing_platform_tags.xlsx");
const vendorWorkbookPath = path.join(sourceAnalysisDir, "Uitklaptabel.xls");

const TAG_GAP_TERMS = [
  "security printing",
  "security-features",
  "security features",
  "holography",
  "hologram",
  "ovd",
  "micro optics",
  "security inks",
  "intaglio",
  "anti-counterfeit",
  "document security",
  "passport security",
  "banknote security",
];

const CATEGORY_TERMS = {
  identity_documents: [
    "passport",
    "passports",
    "travel document",
    "id documents",
    "id document",
    "identity card",
    "residence permit",
    "residence card",
    "visa",
    "visas",
    "icao",
    "border control",
    "document authentication",
    "passport security",
  ],
  banknotes: [
    "banknote",
    "banknotes",
    "currency",
    "counterfeit currency",
    "polymer note",
    "commemorative note",
    "cash circulation",
    "banknote security",
    "security thread",
    "central bank",
  ],
  shared_security_printing: [
    "security printing",
    "security features",
    "security-features",
    "hologram",
    "holography",
    "ovd",
    "optically variable device",
    "micro optics",
    "microlens",
    "security ink",
    "security inks",
    "intaglio",
    "anti-counterfeit",
    "document security",
    "passport security",
    "banknote security",
  ],
  digital_identity_biometrics: [
    "digital identity",
    "identity verification",
    "biometric",
    "biometrics",
    "authentication",
    "kyc",
    "onboarding",
    "wallet",
    "eudi",
    "liveness",
    "eid",
  ],
};

const PRIORITY_VENDOR_MATCHERS = [
  { label: "SICPA", terms: ["sicpa"] },
  { label: "KURZ", terms: ["kurz", "leonhard kurz"] },
  { label: "SURYS", terms: ["surys"] },
  { label: "Optaglio", terms: ["optaglio"] },
  { label: "Hueck Folien", terms: ["hueck folien"] },
  { label: "IQ Structures", terms: ["iq structures"] },
  { label: "Crane Currency", terms: ["crane currency"] },
  { label: "De La Rue", terms: ["de la rue", "delarue"] },
  { label: "G+D", terms: ["g+d", "giesecke & devrient", "giesecke and devrient"] },
  { label: "Veridos", terms: ["veridos"] },
  { label: "Bundesdruckerei", terms: ["bundesdruckerei"] },
  { label: "Orell Füssli", terms: ["orell füssli", "orell fussli"] },
  { label: "Authentix", terms: ["authentix"] },
  { label: "Jura", terms: ["jura jsp", "jura"] },
  { label: "Covestro", terms: ["covestro", "bayer materialscience"] },
  { label: "Regula", terms: ["regula"] },
  { label: "Arjowiggins Security", terms: ["arjowiggins security"] },
  { label: "Canadian Bank Note", terms: ["canadian bank note", "cbn"] },
  { label: "Cetis", terms: ["cetis"] },
  { label: "Atlantic Zeiser", terms: ["atlantic zeiser"] },
  { label: "Abnote", terms: ["abnote"] },
];

const PRIORITY_VENDOR_HINTS = {
  "sicpa": ["security inks", "banknote security", "authentication feature"],
  "kurz": ["holography", "hologram", "security foil", "ovd"],
  "surys": ["holography", "ovd", "optically variable device", "security features"],
  "optaglio": ["holography", "ovd", "security feature"],
  "hueck folien": ["holographic foil", "security foil", "holography"],
  "iq structures": ["micro optics", "microlens", "holography"],
  "crane currency": ["banknote security", "security thread", "intaglio"],
  "de la rue": ["banknote security", "security features", "intaglio"],
  "g+d": ["banknote security", "security printing", "document security"],
  "veridos": ["secure documents", "passport security", "document security"],
  "bundesdruckerei": ["secure documents", "document security", "passport security"],
  "orell füssli": ["banknote security", "security printing", "intaglio"],
  "orell fussli": ["banknote security", "security printing", "intaglio"],
  "authentix": ["banknote security", "authentication feature", "security features"],
  "jura": ["security ink", "security printing"],
  "covestro": ["polycarbonate", "secure documents", "document security"],
  "regula": ["document security", "passport security", "authentication feature"],
  "arjowiggins security": ["security paper", "banknote security", "document security"],
  "canadian bank note": ["banknote security", "passport security", "security printing"],
  "cetis": ["secure documents", "passport security", "security printing"],
  "atlantic zeiser": ["personalization", "security printing", "document security"],
  "abnote": ["secure documents", "passport security", "document security"],
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatRows(rows = []) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value == null ? "" : value,
      ])
    )
  );
}

function readWorkbook(filePath) {
  return XLSX.readFile(filePath, { cellDates: false });
}

function getSheetRows(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
}

function findHeaderRow(rows, requiredHeaders = []) {
  const normalizedRequired = requiredHeaders.map(normalizeText);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index].map(normalizeText);
    if (normalizedRequired.every((header) => row.includes(header))) {
      return index;
    }
  }
  return -1;
}

function rowsToObjects(rows, headerRowIndex) {
  const headers = rows[headerRowIndex].map((header, index) => normalizeText(header) || `column_${index + 1}`);
  return rows
    .slice(headerRowIndex + 1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function containsAny(text, terms = []) {
  const haystack = normalizeText(text);
  return terms.some((term) => haystack.includes(normalizeText(term)));
}

function matchTerms(text, terms = []) {
  const haystack = normalizeText(text);
  return terms.filter((term) => haystack.includes(normalizeText(term)));
}

function getCategoryMatches(tagRow) {
  const tagText = `${tagRow["tag name"] || ""} ${tagRow["tag slug"] || ""}`;
  return Object.fromEntries(
    Object.entries(CATEGORY_TERMS).map(([categoryId, terms]) => [categoryId, matchTerms(tagText, terms)])
  );
}

function analyzeTagCoverage(tagRows) {
  const rankedTags = tagRows
    .filter((row) => row["tag name"])
    .map((row) => {
      const postCount = Number(row["posts using tag"] || row["api tag count"] || 0) || 0;
      const categoryMatches = getCategoryMatches(row);
      return {
        tagName: String(row["tag name"] || ""),
        tagSlug: String(row["tag slug"] || ""),
        postCount,
        categoryMatches,
      };
    })
    .sort((left, right) => right.postCount - left.postCount);

  const tagsByCategory = Object.fromEntries(
    Object.keys(CATEGORY_TERMS).map((categoryId) => [
      categoryId,
      rankedTags.filter((tag) => categoryMatchesPresent(tag.categoryMatches[categoryId])).slice(0, 20),
    ])
  );

  const gapTags = rankedTags
    .map((tag) => ({
      tagName: tag.tagName,
      tagSlug: tag.tagSlug,
      postCount: tag.postCount,
      matchedGapTerms: matchTerms(`${tag.tagName} ${tag.tagSlug}`, TAG_GAP_TERMS),
    }))
    .filter((tag) => tag.matchedGapTerms.length > 0)
    .sort((left, right) => right.postCount - left.postCount);

  const expectedGapCoverage = TAG_GAP_TERMS.map((term) => {
    const matchingTags = rankedTags.filter((tag) => containsAny(`${tag.tagName} ${tag.tagSlug}`, [term]));
    return {
      gap_term: term,
      matching_tag_count: matchingTags.length,
      matching_posts_sum: matchingTags.reduce((sum, tag) => sum + tag.postCount, 0),
      example_tags: matchingTags.slice(0, 5).map((tag) => tag.tagName),
    };
  }).sort((left, right) => right.matching_posts_sum - left.matching_posts_sum);

  return {
    rankedTags,
    tagsByCategory,
    gapTags,
    expectedGapCoverage,
  };
}

function categoryMatchesPresent(matches = []) {
  return Array.isArray(matches) && matches.length > 0;
}

function normalizeVendorName(name) {
  return normalizeText(name)
    .replace(/[’']/g, "")
    .replace(/\s*&\s*/g, " & ");
}

function looksLikeRss(text) {
  return containsAny(text, ["rss", ".xml", "/feed", "feedburner", "atom"]);
}

function looksLikeNewsPage(text) {
  return containsAny(text, ["news", "press", "media", "blog", "article", "insights", "updates"]);
}

function looksLikeUsableLink(text) {
  return containsAny(text, ["http://", "https://", "www."]);
}

function isMarkedNvt(value) {
  return normalizeText(value) === "nvt";
}

function getVendorSourceState(vendor) {
  const rssNews = String(vendor["rss / news"] || "");
  const website = String(vendor["website"] || "");
  const links = String(vendor["links"] || "");
  const contact = String(vendor["email / contact"] || "");
  const social = String(vendor["social media"] || "");
  const stats = String(vendor["stats"] || "");
  const combined = [rssNews, website, links, contact, social, stats].join(" ");

  const markedNvt =
    isMarkedNvt(rssNews) ||
    (isMarkedNvt(social) && isMarkedNvt(stats) && !looksLikeUsableLink(website) && !looksLikeUsableLink(links));

  const hasRss = looksLikeRss(rssNews) || looksLikeRss(links);
  const hasNewsPage = looksLikeNewsPage(rssNews) || looksLikeNewsPage(links) || looksLikeNewsPage(website);
  const hasWebsite = looksLikeUsableLink(website);
  const hasAnyUsableSource = hasRss || hasNewsPage || hasWebsite || looksLikeUsableLink(links);

  let sourceState = "no_usable_source";
  if (markedNvt) {
    sourceState = "marked_nvt";
  } else if (hasRss) {
    sourceState = "has_rss";
  } else if (hasNewsPage) {
    sourceState = "has_news_page";
  } else if (hasWebsite || looksLikeUsableLink(links)) {
    sourceState = "website_only";
  }

  return {
    combined,
    markedNvt,
    hasRss,
    hasNewsPage,
    hasWebsite,
    hasAnyUsableSource,
    sourceState,
  };
}

function computeVendorPriority(vendor, tagCoverage) {
  const company = String(vendor.company || "");
  const normalizedCompany = normalizeVendorName(company);
  const sourceState = getVendorSourceState(vendor);
  const nicheHints = PRIORITY_VENDOR_HINTS[normalizedCompany] || [];
  const vendorText = [
    company,
    vendor["website"],
    vendor["rss / news"],
    vendor["links"],
    vendor["social media"],
    vendor["stats"],
  ].join(" ");

  const matchedNicheHints = nicheHints.filter((term) => containsAny(vendorText, [term])).length ? nicheHints : [];
  const matchedGapTerms = TAG_GAP_TERMS.filter((term) => containsAny(vendorText, [term]));
  const matchedVendorMatcher = PRIORITY_VENDOR_MATCHERS.find((matcher) =>
    matcher.terms.some((term) => normalizedCompany.includes(normalizeVendorName(term)))
  );
  const isPriorityVendor = Boolean(matchedVendorMatcher);

  let priorityScore = 0;
  if (isPriorityVendor) {
    priorityScore += 45;
  }
  if (sourceState.hasRss) {
    priorityScore += 25;
  } else if (sourceState.hasNewsPage) {
    priorityScore += 18;
  } else if (sourceState.hasWebsite) {
    priorityScore += 8;
  }
  priorityScore += Math.min(20, matchedGapTerms.length * 6);
  priorityScore += Math.min(15, nicheHints.length * 3);
  if (containsAny(vendorText, ["hologram", "holography", "ovd", "micro optics", "security inks", "intaglio"])) {
    priorityScore += 10;
  }
  if (sourceState.markedNvt) {
    priorityScore -= 20;
  }

  let recommendedAction = "low_priority";
  if (isPriorityVendor && sourceState.hasRss) {
    recommendedAction = "add_rss_feed";
  } else if (isPriorityVendor && sourceState.hasNewsPage) {
    recommendedAction = "add_news_scraper";
  } else if (isPriorityVendor && sourceState.hasWebsite) {
    recommendedAction = "verify_link";
  } else if (sourceState.markedNvt) {
    recommendedAction = "no_action";
  } else if (priorityScore >= 35 && sourceState.hasNewsPage) {
    recommendedAction = "add_news_scraper";
  } else if (priorityScore >= 35 && sourceState.hasRss) {
    recommendedAction = "add_rss_feed";
  } else if (priorityScore >= 25 && !sourceState.hasAnyUsableSource) {
    recommendedAction = "verify_link";
  }

  return {
    company,
    priorityScore,
    isPriorityVendor,
    priorityVendorLabel: matchedVendorMatcher?.label || "",
    recommendedAction,
    sourceState: sourceState.sourceState,
    matchedGapTerms,
    nicheHints: matchedNicheHints.length ? matchedNicheHints : nicheHints,
    sourceSignals: [
      sourceState.hasRss ? "rss" : "",
      sourceState.hasNewsPage ? "news_page" : "",
      sourceState.hasWebsite ? "website" : "",
      sourceState.markedNvt ? "nvt" : "",
    ].filter(Boolean),
  };
}

function analyzeVendorCoverage(vendorRows, tagCoverage) {
  const vendors = vendorRows
    .filter((row) => row.company)
    .map((row) => {
      const normalized = {
        company: String(row.company || "").trim(),
        "website": String(row.website || "").trim(),
        "email / contact": String(row["email / contact"] || "").trim(),
        "rss / news": String(row["rss / news"] || "").trim(),
        "links": String(row.links || "").trim(),
        "social media": String(row["social media"] || "").trim(),
        "stats": String(row.stats || "").trim(),
      };
      return {
        ...normalized,
        ...computeVendorPriority(normalized, tagCoverage),
      };
    });

  const summary = {
    totalVendors: vendors.length,
    vendorsWithRss: vendors.filter((vendor) => vendor.sourceState === "has_rss").length,
    vendorsWithNewsPage: vendors.filter((vendor) => vendor.sourceState === "has_news_page").length,
    vendorsWithOnlyWebsite: vendors.filter((vendor) => vendor.sourceState === "website_only").length,
    vendorsWithNoUsableSource: vendors.filter((vendor) => vendor.sourceState === "no_usable_source").length,
    vendorsMarkedNvt: vendors.filter((vendor) => vendor.sourceState === "marked_nvt").length,
  };

  const highPriorityVendors = vendors
    .filter((vendor) => vendor.isPriorityVendor)
    .sort((left, right) => right.priorityScore - left.priorityScore);

  return {
    vendors,
    summary,
    highPriorityVendors,
  };
}

function printTagCoverage(tagCoverage) {
  console.log("\n=== Top Keesing Tags By Usage ===");
  console.table(formatRows(
    tagCoverage.rankedTags.slice(0, 20).map((tag) => ({
      tag_name: tag.tagName,
      tag_slug: tag.tagSlug,
      posts_using_tag: tag.postCount,
    }))
  ));

  console.log("\n=== Tags Related To Identity Documents ===");
  console.table(formatRows(
    tagCoverage.tagsByCategory.identity_documents.slice(0, 15).map((tag) => ({
      tag_name: tag.tagName,
      tag_slug: tag.tagSlug,
      posts_using_tag: tag.postCount,
      matched_terms: tag.categoryMatches.identity_documents,
    }))
  ));

  console.log("\n=== Tags Related To Banknotes ===");
  console.table(formatRows(
    tagCoverage.tagsByCategory.banknotes.slice(0, 15).map((tag) => ({
      tag_name: tag.tagName,
      tag_slug: tag.tagSlug,
      posts_using_tag: tag.postCount,
      matched_terms: tag.categoryMatches.banknotes,
    }))
  ));

  console.log("\n=== Tags Related To Shared Security Printing ===");
  console.table(formatRows(
    tagCoverage.tagsByCategory.shared_security_printing.slice(0, 20).map((tag) => ({
      tag_name: tag.tagName,
      tag_slug: tag.tagSlug,
      posts_using_tag: tag.postCount,
      matched_terms: tag.categoryMatches.shared_security_printing,
    }))
  ));

  console.log("\n=== Tags Related To Digital Identity & Biometrics ===");
  console.table(formatRows(
    tagCoverage.tagsByCategory.digital_identity_biometrics.slice(0, 15).map((tag) => ({
      tag_name: tag.tagName,
      tag_slug: tag.tagSlug,
      posts_using_tag: tag.postCount,
      matched_terms: tag.categoryMatches.digital_identity_biometrics,
    }))
  ));

  console.log("\n=== Tags Suggesting Missing Source Coverage ===");
  console.table(formatRows(
    tagCoverage.gapTags.slice(0, 25).map((tag) => ({
      tag_name: tag.tagName,
      tag_slug: tag.tagSlug,
      posts_using_tag: tag.postCount,
      matched_gap_terms: tag.matchedGapTerms,
    }))
  ));

  console.log("\n=== Target Gap Term Coverage ===");
  console.table(formatRows(tagCoverage.expectedGapCoverage));
}

function printVendorCoverage(vendorCoverage) {
  console.log("\n=== Vendor Coverage Summary ===");
  console.table(formatRows([{
    total_vendors: vendorCoverage.summary.totalVendors,
    vendors_with_rss: vendorCoverage.summary.vendorsWithRss,
    vendors_with_news_page: vendorCoverage.summary.vendorsWithNewsPage,
    vendors_with_only_website: vendorCoverage.summary.vendorsWithOnlyWebsite,
    vendors_with_no_usable_source: vendorCoverage.summary.vendorsWithNoUsableSource,
    vendors_marked_nvt: vendorCoverage.summary.vendorsMarkedNvt,
  }]));

  console.log("\n=== High-priority Vendors For Shared Security Printing ===");
  console.table(formatRows(
    vendorCoverage.highPriorityVendors.map((vendor) => ({
      company: vendor.company,
      website: vendor.website,
      rss_news: vendor["rss / news"],
      links: vendor.links,
      source_state: vendor.sourceState,
      priority_vendor_label: vendor.priorityVendorLabel,
      priority_score: vendor.priorityScore,
      recommended_action: vendor.recommendedAction,
      source_signals: vendor.sourceSignals,
      niche_hints: vendor.nicheHints,
      matched_gap_terms: vendor.matchedGapTerms,
    }))
  ));

  console.log("\n=== Top Vendor Candidates Overall ===");
  console.table(formatRows(
    vendorCoverage.vendors
      .slice()
      .sort((left, right) => right.priorityScore - left.priorityScore)
      .slice(0, 30)
      .map((vendor) => ({
        company: vendor.company,
        source_state: vendor.sourceState,
        priority_vendor_label: vendor.priorityVendorLabel,
        priority_score: vendor.priorityScore,
        recommended_action: vendor.recommendedAction,
        niche_hints: vendor.nicheHints,
        matched_gap_terms: vendor.matchedGapTerms,
      }))
  ));
}

function printFinalAssessment(tagCoverage, vendorCoverage) {
  const sharedSecurityTagVolume = tagCoverage.tagsByCategory.shared_security_printing
    .reduce((sum, tag) => sum + tag.postCount, 0);
  const priorityVendorCoverage = vendorCoverage.highPriorityVendors.filter((vendor) =>
    vendor.recommendedAction === "add_rss_feed" || vendor.recommendedAction === "add_news_scraper"
  ).length;
  const likelyCoverageProblem =
    sharedSecurityTagVolume > 150 &&
    priorityVendorCoverage < Math.max(6, Math.ceil(vendorCoverage.highPriorityVendors.length * 0.4));

  console.log("\n=== Coverage Assessment ===");
  console.table(formatRows([{
    shared_security_tag_posts_sum: sharedSecurityTagVolume,
    priority_vendors_identified: vendorCoverage.highPriorityVendors.length,
    priority_vendors_with_actionable_sources: priorityVendorCoverage,
    likely_missing_topics_are_source_coverage_problem: likelyCoverageProblem,
    assessment_reason: likelyCoverageProblem
      ? "Keesing shows meaningful niche security-printing tag volume while many relevant vendors still need RSS or news-source onboarding."
      : "Current source availability appears less constrained, so classifier quality may now be the larger limiting factor.",
  }]));
}

function main() {
  const keesingWorkbook = readWorkbook(keesingWorkbookPath);
  const vendorWorkbook = readWorkbook(vendorWorkbookPath);

  const tagSummaryRows = getSheetRows(keesingWorkbook, "Tag_Summary");
  const vendorRowsRaw = getSheetRows(vendorWorkbook, vendorWorkbook.SheetNames[0]);

  const tagHeaderRow = findHeaderRow(tagSummaryRows, ["Tag Name", "Tag Slug", "Posts Using Tag"]);
  const vendorHeaderRow = findHeaderRow(vendorRowsRaw, ["Company", "WEBSITE", "RSS / NEWS"]);

  if (tagHeaderRow === -1) {
    throw new Error("Could not find the Keesing Tag_Summary header row.");
  }
  if (vendorHeaderRow === -1) {
    throw new Error("Could not find the vendor workbook header row.");
  }

  const tagRows = rowsToObjects(tagSummaryRows, tagHeaderRow);
  const vendorRows = rowsToObjects(vendorRowsRaw, vendorHeaderRow);

  const tagCoverage = analyzeTagCoverage(tagRows);
  const vendorCoverage = analyzeVendorCoverage(vendorRows, tagCoverage);

  console.log("\n=== Source Coverage Diagnostics ===");
  console.table(formatRows([{
    keesing_workbook: path.basename(keesingWorkbookPath),
    vendor_workbook: path.basename(vendorWorkbookPath),
    keesing_tags_loaded: tagRows.filter((row) => row["tag name"]).length,
    vendor_rows_loaded: vendorRows.filter((row) => row.company).length,
  }]));

  printTagCoverage(tagCoverage);
  printVendorCoverage(vendorCoverage);
  printFinalAssessment(tagCoverage, vendorCoverage);
}

try {
  main();
} catch (error) {
  console.error("Failed to run source coverage diagnostics.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
