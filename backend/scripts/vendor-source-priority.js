import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceAnalysisDir = path.resolve(__dirname, "../data/source-analysis");
const keesingWorkbookPath = path.join(sourceAnalysisDir, "keesing_platform_tags.xlsx");
const vendorWorkbookPath = path.join(sourceAnalysisDir, "Uitklaptabel.xls");

const DOMAIN_TERMS = {
  shared_security_printing: [
    "security printing",
    "security feature",
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
    "security foil",
    "holographic foil",
  ],
  identity_documents: [
    "passport",
    "passports",
    "travel document",
    "identity card",
    "id card",
    "residence permit",
    "residence card",
    "visa",
    "visas",
    "secure documents",
    "secure document",
    "document security",
    "passport personalization",
    "document authentication",
  ],
  banknotes: [
    "banknote",
    "banknotes",
    "currency",
    "security thread",
    "banknote security",
    "cash",
    "polymer note",
    "commemorative note",
    "central bank",
    "currency note",
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
    "eid",
    "liveness",
    "document verification",
  ],
};

const NICHE_TERMS = {
  ovd: ["ovd", "optically variable device", "optical security device"],
  holography: ["holography", "hologram", "holograms", "holographic foil"],
  security_inks: ["security ink", "security inks", "optically variable ink", "uv ink", "fluorescent ink", "magnetic ink"],
  micro_optics: ["micro optics", "microlens", "micro-optic", "nano optics", "microstructure"],
  intaglio: ["intaglio", "engraved printing", "tactile printing", "raised print"],
};

const PRIORITY_VENDOR_MATCHERS = [
  { label: "SICPA", terms: ["sicpa"] },
  { label: "KURZ", terms: ["kurz", "leonhard kurz"] },
  { label: "SURYS", terms: ["surys"] },
  { label: "Optaglio", terms: ["optaglio"] },
  { label: "IQ Structures", terms: ["iq structures"] },
  { label: "Hueck Folien", terms: ["hueck folien"] },
  { label: "Crane Currency", terms: ["crane currency"] },
  { label: "De La Rue", terms: ["de la rue", "delarue"] },
  { label: "G+D", terms: ["g+d", "giesecke & devrient", "giesecke and devrient"] },
  { label: "Veridos", terms: ["veridos"] },
  { label: "Bundesdruckerei", terms: ["bundesdruckerei"] },
  { label: "Orell Fussli", terms: ["orell fussli", "orell füssli"] },
  { label: "Authentix", terms: ["authentix"] },
  { label: "Regula", terms: ["regula"] },
  { label: "Canadian Bank Note", terms: ["canadian bank note", "cbn"] },
  { label: "Arjowiggins Security", terms: ["arjowiggins security"] },
  { label: "Cetis", terms: ["cetis"] },
  { label: "Jura", terms: ["jura jsp", "jura"] },
  { label: "Covestro", terms: ["covestro", "bayer materialscience"] },
];

const PRIORITY_VENDOR_HINTS = {
  "sicpa": ["security inks", "banknote security", "authentication feature"],
  "kurz": ["holography", "hologram", "security foil", "ovd"],
  "surys": ["holography", "ovd", "optically variable device", "security features"],
  "optaglio": ["holography", "ovd", "security feature"],
  "iq structures": ["micro optics", "microlens", "holography"],
  "hueck folien": ["holographic foil", "security foil", "holography"],
  "crane currency": ["banknote security", "security thread", "intaglio"],
  "de la rue": ["banknote security", "security features", "intaglio"],
  "g+d": ["banknote security", "security printing", "document security"],
  "veridos": ["secure documents", "passport security", "document security"],
  "bundesdruckerei": ["secure documents", "document security", "passport security"],
  "orell fussli": ["banknote security", "security printing", "intaglio"],
  "authentix": ["banknote security", "authentication feature", "security features"],
  "regula": ["document security", "passport security", "authentication feature"],
  "canadian bank note": ["banknote security", "passport security", "security printing"],
  "arjowiggins security": ["security paper", "banknote security", "document security"],
  "cetis": ["secure documents", "passport security", "security printing"],
  "jura": ["security ink", "security printing"],
  "covestro": ["polycarbonate", "secure documents", "document security"],
};

const DOMAIN_WEIGHTS = {
  shared_security_printing: 4.5,
  identity_documents: 2.5,
  banknotes: 2.25,
  digital_identity_biometrics: 1.5,
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

function matchTerms(text, terms = []) {
  const haystack = normalizeText(text);
  return terms.filter((term) => haystack.includes(normalizeText(term)));
}

function looksLikeRss(text) {
  return matchTerms(text, ["rss", ".xml", "/feed", "feedburner", "atom"]).length > 0;
}

function looksLikeNewsPage(text) {
  return matchTerms(text, ["news", "press", "media", "blog", "article", "insights", "updates"]).length > 0;
}

function looksLikeUsableLink(text) {
  return matchTerms(text, ["http://", "https://", "www."]).length > 0;
}

function isMarkedNvt(text) {
  return normalizeText(text) === "nvt";
}

function normalizeVendorName(name) {
  return normalizeText(name)
    .replace(/[’']/g, "")
    .replace(/\s*&\s*/g, " & ");
}

function getTagGapWeights() {
  const workbook = readWorkbook(keesingWorkbookPath);
  const tagRowsRaw = getSheetRows(workbook, "Tag_Summary");
  const headerRow = findHeaderRow(tagRowsRaw, ["Tag Name", "Tag Slug", "Posts Using Tag"]);
  if (headerRow === -1) {
    return new Map();
  }
  const tagRows = rowsToObjects(tagRowsRaw, headerRow);
  const termWeights = new Map();

  for (const row of tagRows) {
    const tagText = `${row["tag name"] || ""} ${row["tag slug"] || ""}`;
    const postCount = Number(row["posts using tag"] || row["api tag count"] || 0) || 0;
    for (const term of DOMAIN_TERMS.shared_security_printing) {
      if (matchTerms(tagText, [term]).length > 0) {
        termWeights.set(term, (termWeights.get(term) || 0) + postCount);
      }
    }
  }

  return termWeights;
}

function getSourceState(vendor) {
  const rssNews = String(vendor["rss / news"] || "");
  const website = String(vendor.website || "");
  const links = String(vendor.links || "");
  const markedNvt = isMarkedNvt(rssNews);
  const hasRss = looksLikeRss(rssNews) || looksLikeRss(links);
  const hasNewsPage = looksLikeNewsPage(rssNews) || looksLikeNewsPage(links) || looksLikeNewsPage(website);
  const hasWebsite = looksLikeUsableLink(website);

  return {
    markedNvt,
    hasRss,
    hasNewsPage,
    hasWebsite,
    acquisitionMethod: markedNvt
      ? "ignore"
      : hasRss
        ? "rss"
        : hasNewsPage
          ? "scraper"
          : hasWebsite
            ? "verify"
            : "ignore",
  };
}

function findPriorityVendorMatcher(company) {
  const normalizedCompany = normalizeVendorName(company);
  return PRIORITY_VENDOR_MATCHERS.find((matcher) =>
    matcher.terms.some((term) => normalizedCompany.includes(normalizeVendorName(term)))
  );
}

function chooseSourceUrl(vendor, sourceState) {
  const rssNews = String(vendor["rss / news"] || "").trim();
  const links = String(vendor.links || "").trim();
  const website = String(vendor.website || "").trim();

  if (sourceState.hasRss && rssNews) {
    return rssNews.split(/\s+/).find((token) => token.startsWith("http")) || rssNews;
  }
  if (sourceState.hasNewsPage && rssNews) {
    return rssNews.split(/\s+/).find((token) => token.startsWith("http")) || rssNews;
  }
  if (sourceState.hasNewsPage && links) {
    return links.split(/\s+/).find((token) => token.startsWith("http")) || links;
  }
  return website || links || "";
}

function computeDomainScores(vendor, tagGapWeights) {
  const vendorText = [
    vendor.company,
    vendor.website,
    vendor["rss / news"],
    vendor.links,
    vendor["social media"],
    vendor.stats,
  ].join(" ");
  const matcher = findPriorityVendorMatcher(vendor.company || "");
  const normalizedLabel = normalizeVendorName(matcher?.label || vendor.company || "");
  const hints = PRIORITY_VENDOR_HINTS[normalizedLabel] || [];

  const domainScores = {};
  for (const [domainId, terms] of Object.entries(DOMAIN_TERMS)) {
    const matched = matchTerms(vendorText, terms);
    let score = matched.length * 8;
    if (domainId === "shared_security_printing") {
      score += matched.reduce((sum, term) => sum + Math.min(12, Math.round((tagGapWeights.get(term) || 0) / 20)), 0);
      score += matchTerms(hints.join(" "), terms).length * 6;
      if (matcher) {
        score += 18;
      }
    } else if (matcher && ["Veridos", "Bundesdruckerei", "Regula", "Cetis", "Covestro"].includes(matcher.label)) {
      if (domainId === "identity_documents") {
        score += 12;
      }
    } else if (matcher && ["Crane Currency", "De La Rue", "G+D", "Canadian Bank Note", "SICPA"].includes(matcher.label)) {
      if (domainId === "banknotes") {
        score += 12;
      }
    }
    domainScores[domainId] = score;
  }

  const nicheScores = Object.fromEntries(
    Object.entries(NICHE_TERMS).map(([topicId, terms]) => {
      const matched = matchTerms(vendorText, terms);
      const hintMatches = matchTerms(hints.join(" "), terms);
      return [topicId, (matched.length * 10) + (hintMatches.length * 8) + (matcher ? 4 : 0)];
    })
  );

  return { domainScores, nicheScores, matcher };
}

function buildVendorPriorityRows(vendorRows, tagGapWeights) {
  return vendorRows
    .filter((row) => row.company)
    .map((row) => {
      const vendor = {
        company: String(row.company || "").trim(),
        website: String(row.website || "").trim(),
        "email / contact": String(row["email / contact"] || "").trim(),
        "rss / news": String(row["rss / news"] || "").trim(),
        links: String(row.links || "").trim(),
        "social media": String(row["social media"] || "").trim(),
        stats: String(row.stats || "").trim(),
      };
      const sourceState = getSourceState(vendor);
      const { domainScores, nicheScores, matcher } = computeDomainScores(vendor, tagGapWeights);

      let totalPriorityScore = 0;
      for (const [domainId, score] of Object.entries(domainScores)) {
        totalPriorityScore += score * DOMAIN_WEIGHTS[domainId];
      }
      if (sourceState.hasRss) {
        totalPriorityScore += 22;
      } else if (sourceState.hasNewsPage) {
        totalPriorityScore += 16;
      } else if (sourceState.hasWebsite) {
        totalPriorityScore += 6;
      }
      if (sourceState.markedNvt) {
        totalPriorityScore -= 25;
      }
      if (matcher) {
        totalPriorityScore += 30;
      }
      totalPriorityScore += Object.values(nicheScores).reduce((sum, value) => sum + Math.min(14, value), 0) * 0.35;

      return {
        ...vendor,
        priorityVendorLabel: matcher?.label || "",
        sourceState,
        sourceUrl: chooseSourceUrl(vendor, sourceState),
        domainScores,
        nicheScores,
        totalPriorityScore: Math.round(totalPriorityScore),
      };
    })
    .sort((left, right) => right.totalPriorityScore - left.totalPriorityScore);
}

function printTop50(rows) {
  console.log("\n=== Top 50 Vendor Source Priority ===");
  console.table(formatRows(
    rows.slice(0, 50).map((vendor, index) => ({
      rank: index + 1,
      vendor_name: vendor.company,
      priority_vendor_label: vendor.priorityVendorLabel,
      rss_available: vendor.sourceState.hasRss,
      news_page_available: vendor.sourceState.hasNewsPage,
      source_url: vendor.sourceUrl,
      recommended_acquisition_method: vendor.sourceState.acquisitionMethod,
      total_priority_score: vendor.totalPriorityScore,
      shared_security_printing_score: vendor.domainScores.shared_security_printing,
      identity_documents_score: vendor.domainScores.identity_documents,
      banknotes_score: vendor.domainScores.banknotes,
      digital_identity_score: vendor.domainScores.digital_identity_biometrics,
    }))
  ));
}

function printTopNiche(rows) {
  const nicheWeighted = rows
    .map((vendor) => ({
      ...vendor,
      nicheTotal:
        vendor.nicheScores.ovd +
        vendor.nicheScores.holography +
        vendor.nicheScores.security_inks +
        vendor.nicheScores.micro_optics +
        vendor.nicheScores.intaglio,
    }))
    .filter((vendor) => vendor.nicheTotal > 0 || vendor.priorityVendorLabel)
    .sort((left, right) => right.nicheTotal - left.nicheTotal || right.totalPriorityScore - left.totalPriorityScore);

  console.log("\n=== Top 20 Vendors For OVD / Holography / Security Inks / Micro Optics / Intaglio ===");
  console.table(formatRows(
    nicheWeighted.slice(0, 20).map((vendor, index) => ({
      rank: index + 1,
      vendor_name: vendor.company,
      priority_vendor_label: vendor.priorityVendorLabel,
      source_url: vendor.sourceUrl,
      recommended_acquisition_method: vendor.sourceState.acquisitionMethod,
      niche_total: vendor.nicheTotal,
      ovd_score: vendor.nicheScores.ovd,
      holography_score: vendor.nicheScores.holography,
      security_inks_score: vendor.nicheScores.security_inks,
      micro_optics_score: vendor.nicheScores.micro_optics,
      intaglio_score: vendor.nicheScores.intaglio,
    }))
  ));
}

function printSummary(rows) {
  console.log("\n=== Vendor Source Priority Summary ===");
  console.table(formatRows([{
    total_vendors_scored: rows.length,
    rss_method_count: rows.filter((vendor) => vendor.sourceState.acquisitionMethod === "rss").length,
    scraper_method_count: rows.filter((vendor) => vendor.sourceState.acquisitionMethod === "scraper").length,
    verify_method_count: rows.filter((vendor) => vendor.sourceState.acquisitionMethod === "verify").length,
    ignore_method_count: rows.filter((vendor) => vendor.sourceState.acquisitionMethod === "ignore").length,
  }]));
}

function main() {
  const vendorWorkbook = readWorkbook(vendorWorkbookPath);
  const vendorRowsRaw = getSheetRows(vendorWorkbook, vendorWorkbook.SheetNames[0]);
  const vendorHeaderRow = findHeaderRow(vendorRowsRaw, ["Company", "WEBSITE", "RSS / NEWS"]);

  if (vendorHeaderRow === -1) {
    throw new Error("Could not find the vendor workbook header row.");
  }

  const vendorRows = rowsToObjects(vendorRowsRaw, vendorHeaderRow);
  const tagGapWeights = getTagGapWeights();
  const prioritizedVendors = buildVendorPriorityRows(vendorRows, tagGapWeights);

  console.log("\n=== Vendor Source Priority Diagnostics ===");
  console.table(formatRows([{
    vendor_workbook: path.basename(vendorWorkbookPath),
    keesing_workbook: path.basename(keesingWorkbookPath),
    vendors_loaded: vendorRows.filter((row) => row.company).length,
    priority_vendor_targets: PRIORITY_VENDOR_MATCHERS.length,
  }]));

  printSummary(prioritizedVendors);
  printTop50(prioritizedVendors);
  printTopNiche(prioritizedVendors);
}

try {
  main();
} catch (error) {
  console.error("Failed to run vendor source priority diagnostics.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
