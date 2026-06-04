import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  buildSecurityPrintingContext,
  countMatches,
  getSecurityPrintingProductionLikeAssessment,
  matchedKeywords,
} from "./lib/security-printing-production-like.js";

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

const LEGACY_DOMAIN_CONTEXTS = {
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

const SUBGROUPS = {
  security_printing_core: {
    label: "Security Printing",
    strong: ["security printing", "secure printing", "security printer", "banknote printing", "document printing", "printing works"],
    weak: ["secure print"],
    related: ["security feature", "banknote production", "printing works", "security press", "secure printworks"],
  },
  security_inks: {
    label: "Security Inks",
    strong: ["security ink", "security inks", "optically variable ink", "uv ink", "fluorescent ink", "ir ink", "color-shifting ink", "magnetic ink"],
    weak: ["specialty ink", "security pigment"],
    related: ["ink technology", "pigment", "optically variable", "fluorescent", "infrared ink"],
  },
  micro_optics: {
    label: "Micro Optics",
    strong: ["micro optics", "micro-optics", "micro optical", "microlens", "micro-optic structures", "nano optics", "nanostructures", "optical microstructures"],
    weak: ["optical security", "microlens array"],
    related: ["nanostructure", "microstructure", "optical structure", "micro imaging"],
  },
  holography: {
    label: "Holography",
    strong: ["holography", "holographic", "hologram", "holographic stripe", "holographic foil", "holographic security feature"],
    weak: ["diffractive", "holo"],
    related: ["foil", "diffractive optical", "holographic element"],
  },
  ovd: {
    label: "OVD",
    strong: ["ovd", "optically variable device", "diffractive feature", "optical security device"],
    weak: ["optically variable", "ovd kinegram"],
    related: ["kinematic feature", "diffractive", "optical variable", "security device"],
  },
  intaglio: {
    label: "Intaglio",
    strong: ["intaglio", "engraved printing", "tactile printing", "raised print"],
    weak: ["engraved", "engraving"],
    related: ["plate engraving", "raised printing", "tactile security"],
  },
  anti_counterfeit: {
    label: "Anti-counterfeit",
    strong: ["anti-counterfeit", "anti counterfeit", "counterfeit prevention", "counterfeit protection", "authentication feature", "brand protection", "anti-forgery"],
    weak: ["authentication", "anti-copy"],
    related: ["forgery protection", "authentication technology", "brand authentication"],
  },
  personalization: {
    label: "Personalization",
    strong: ["personalization", "secure personalization", "card personalization", "laser personalization", "passport personalization"],
    weak: ["document personalization"],
    related: ["issuance personalization", "personalisation", "personalized credential"],
  },
  secure_documents: {
    label: "Secure Documents",
    strong: ["secure documents", "secure document", "document security", "identity document", "travel document", "credential security"],
    weak: ["travel document security", "document protection"],
    related: ["document authentication", "document integrity", "credential protection"],
  },
};

const SPECIAL_OVERLAPS = [
  ["security_printing_core", "anti_counterfeit", "Security Printing ↔ Anti-counterfeit"],
  ["security_printing_core", "secure_documents", "Security Printing ↔ Secure Documents"],
  ["holography", "ovd", "Holography ↔ OVD"],
  ["micro_optics", "holography", "Micro Optics ↔ Holography"],
  ["micro_optics", "ovd", "Micro Optics ↔ OVD"],
  ["personalization", "secure_documents", "Personalization ↔ Secure Documents"],
  ["security_inks", "security_printing_core", "Security Inks ↔ Security Printing"],
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

function getLegacyDomainContextProfile(context, groupId) {
  const config = LEGACY_DOMAIN_CONTEXTS[groupId];
  if (!config) {
    return { score: 0, excludedHits: 0 };
  }

  const strongKeywords = Array.isArray(config.strong) ? config.strong : [];
  const weakKeywords = Array.isArray(config.weak) ? config.weak : [];
  const excludedKeywords = Array.isArray(config.excluded) ? config.excluded : [];

  const strongTitleHits = countMatches(context.titleText, strongKeywords);
  const strongTagHits = countMatches(context.tagText, strongKeywords);
  const strongMetaHits = countMatches(context.metadataText, strongKeywords);
  const strongBodyHits = countMatches(context.bodyText, strongKeywords);
  const weakTitleHits = countMatches(context.titleText, weakKeywords);
  const weakTagHits = countMatches(context.tagText, weakKeywords);
  const weakMetaHits = countMatches(context.metadataText, weakKeywords);
  const weakBodyHits = countMatches(context.bodyText, weakKeywords);
  const excludedHits =
    countMatches(context.titleText, excludedKeywords) +
    countMatches(context.tagText, excludedKeywords) +
    countMatches(context.metadataText, excludedKeywords);

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

function getLegacyApproximateDominantDomain(article) {
  const context = buildSecurityPrintingContext(article);
  const banknoteSignals = getLegacyDomainContextProfile(context, "banknote_intelligence");
  const identitySignals = getLegacyDomainContextProfile(context, "identity_documents");
  const digitalSignals = getLegacyDomainContextProfile(context, "digital_identity_biometrics");
  const securityAssessment = getSecurityPrintingProductionLikeAssessment(article);

  const banknoteScore = banknoteSignals.score + (context.topic === "banknotes" || context.topic === "banknote" ? 18 : 0);
  const identityScore = identitySignals.score + (context.topic === "identity documents" ? 18 : 0);
  const digitalScore = digitalSignals.score + (context.topic === "digital id" ? 20 : 0);
  const securityScore = securityAssessment.legacyScore + (context.topic === "banknotes" || context.topic === "identity documents" ? 6 : 0);

  const candidates = [
    { domain: "banknotes", score: banknoteScore },
    { domain: "identity_documents", score: identityScore },
    { domain: "digital_identity_biometrics", score: digitalScore },
    { domain: "shared_security", score: securityScore },
  ].sort((left, right) => right.score - left.score);

  if (!candidates.length || candidates[0].score < 8) {
    return "other";
  }
  if ((candidates[0].score - candidates[1].score) < 2 && candidates[0].score < 14) {
    return "other";
  }
  return candidates[0].domain;
}

function computeSubgroupAssessment(article, subgroupId, productionAssessment = getSecurityPrintingProductionLikeAssessment(article)) {
  const subgroup = SUBGROUPS[subgroupId];
  const context = productionAssessment.context;
  const strongKeywords = subgroup.strong;
  const weakKeywords = subgroup.weak;
  const relatedKeywords = subgroup.related;

  const titleStrongHits = countMatches(context.titleText, strongKeywords);
  const tagStrongHits = countMatches(context.tagText, strongKeywords);
  const metaStrongHits = countMatches(context.metadataText, strongKeywords);
  const bodyStrongHits = countMatches(context.bodyText, strongKeywords);
  const titleWeakHits = countMatches(context.titleText, weakKeywords);
  const tagWeakHits = countMatches(context.tagText, weakKeywords);
  const metaWeakHits = countMatches(context.metadataText, weakKeywords);
  const bodyWeakHits = countMatches(context.bodyText, weakKeywords);

  let score = productionAssessment.productionScore * 0.65;
  score += (titleStrongHits * 5.5) + (tagStrongHits * 4.5) + (metaStrongHits * 3.5) + (bodyStrongHits * 1.5);
  score += (titleWeakHits * 1.5) + (tagWeakHits * 1.5) + (metaWeakHits * 1) + (bodyWeakHits * 0.35);
  score -= productionAssessment.excludedHits * 10;
  score = Math.max(0, Math.round(score));

  const haystack = `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`;
  const directStrong = matchedKeywords(haystack, subgroup.strong);
  const directWeak = matchedKeywords(haystack, subgroup.weak);
  const related = matchedKeywords(haystack, subgroup.related);

  const directMatch = directStrong.length > 0 || (directWeak.length > 0 && score >= 18);
  const hybridMatch =
    !directMatch &&
    productionAssessment.productionScore >= 7 &&
    score >= 18 &&
    (directWeak.length > 0 || related.length > 0);
  const included = directMatch || hybridMatch;

  return {
    subgroupId,
    score,
    domainScore: productionAssessment.productionScore,
    directMatch,
    hybridMatch,
    included,
    directStrong,
    directWeak,
    related,
  };
}

function chooseTopRows(rows, limit = 20) {
  return rows
    .slice()
    .sort((left, right) => {
      if (Number(right.directMatch) !== Number(left.directMatch)) {
        return Number(right.directMatch) - Number(left.directMatch);
      }
      if ((right.directStrong?.length || 0) !== (left.directStrong?.length || 0)) {
        return (right.directStrong?.length || 0) - (left.directStrong?.length || 0);
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

  const strongestOther = Object.entries(allAssessments)
    .filter(([otherId, other]) => otherId !== subgroupId && other.included)
    .sort((left, right) => right[1].score - left[1].score)[0];

  const ownEvidenceScore = (record.directStrong.length * 4) + (record.related.length * 2) + record.directWeak.length;
  const strongestOtherScore = strongestOther
    ? (strongestOther[1].directStrong.length * 4) + (strongestOther[1].related.length * 2) + strongestOther[1].directWeak.length
    : 0;

  if (!record.directMatch && record.directWeak.length === 0 && record.related.length === 0) {
    return { likelyFalsePositive: true, reason: "no_subgroup_specific_evidence" };
  }
  if (strongestOther && strongestOther[1].score >= record.score + 30 && strongestOtherScore >= ownEvidenceScore + 2) {
    return { likelyFalsePositive: true, reason: `looks_more_like_${strongestOther[0]}` };
  }
  if (subgroupId === "ovd" && record.directStrong.length === 0 && record.related.includes("security device")) {
    return { likelyFalsePositive: true, reason: "generic_security_device_only" };
  }
  if (subgroupId === "secure_documents" && record.directStrong.length === 0 && record.directWeak.length > 0) {
    return { likelyFalsePositive: true, reason: "generic_document_security_only" };
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

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "security-printing-subgroup-diagnostics",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadArticles(client);
    const legacyCandidateArticles = articles.filter((article) => {
      const dominant = getLegacyApproximateDominantDomain(article);
      const securityDomain = getSecurityPrintingProductionLikeAssessment(article).includedLegacy;
      return dominant === "shared_security" || securityDomain;
    });
    const candidateArticles = articles.filter((article) => getSecurityPrintingProductionLikeAssessment(article).includedProduction);

    const subgroupResults = new Map();
    Object.keys(SUBGROUPS).forEach((subgroupId) => subgroupResults.set(subgroupId, []));
    const specialOverlapResults = new Map(SPECIAL_OVERLAPS.map(([, , label]) => [label, []]));

    candidateArticles.forEach((article) => {
      const productionAssessment = getSecurityPrintingProductionLikeAssessment(article);
      const assessments = Object.fromEntries(
        Object.keys(SUBGROUPS).map((subgroupId) => [subgroupId, computeSubgroupAssessment(article, subgroupId, productionAssessment)])
      );

      Object.entries(assessments).forEach(([subgroupId, assessment]) => {
        if (!assessment.included) {
          return;
        }

        const overlaps = Object.entries(assessments)
          .filter(([otherId, other]) => otherId !== subgroupId && other.included)
          .map(([otherId]) => otherId);
        const falsePositive = determineFalsePositive(subgroupId, assessment, assessments);
        subgroupResults.get(subgroupId).push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          pubDate: article.pubDate,
          link: article.link || "",
          matchType: assessment.directMatch ? "direct" : assessment.hybridMatch ? "hybrid" : "other",
          score: assessment.score,
          domainScore: assessment.domainScore,
          directMatch: assessment.directMatch,
          hybridMatch: assessment.hybridMatch,
          directStrong: assessment.directStrong,
          directWeak: assessment.directWeak,
          related: assessment.related,
          overlaps,
          likelyFalsePositive: falsePositive.likelyFalsePositive,
          falsePositiveReason: falsePositive.reason,
          allAssessments: assessments,
        });
      });

      SPECIAL_OVERLAPS.forEach(([leftId, rightId, label]) => {
        if (assessments[leftId]?.included && assessments[rightId]?.included) {
          specialOverlapResults.get(label).push({
            title: article.title || "",
            source: article.source || article.feedName || "",
            link: article.link || "",
            left_score: assessments[leftId].score,
            right_score: assessments[rightId].score,
            overlap_reasons: [
              ...assessments[leftId].directStrong,
              ...assessments[leftId].related,
              ...assessments[rightId].directStrong,
              ...assessments[rightId].related,
            ].slice(0, 8),
          });
        }
      });
    });

    await client.query("COMMIT");

    console.log("\n=== Shared Security Printing Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      old_candidate_pool_size: legacyCandidateArticles.length,
      security_candidate_pool: candidateArticles.length,
      production_helper_used: "getSecurityPrintingProductionLikeAssessment()",
      legacy_logic_removed: "stale security_printing keyword copy and dominant-domain bottleneck from active candidate selection",
      subgroup_scope: Object.values(SUBGROUPS).map((subgroup) => subgroup.label).join(", "),
    }]));

    const summaryRows = Object.entries(SUBGROUPS).map(([subgroupId, subgroup]) => {
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

    Object.entries(SUBGROUPS).forEach(([subgroupId, subgroup]) => {
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
        match_reasons: [...row.directStrong, ...row.directWeak, ...row.related].slice(0, 8),
        overlap_reasons: row.overlaps
          .flatMap((otherId) => row.allAssessments[otherId] ? [...row.allAssessments[otherId].directStrong, ...row.allAssessments[otherId].related] : [])
          .slice(0, 8),
      }))));
    });

    console.log("\n=== Special Overlap Analysis ===");
    SPECIAL_OVERLAPS.forEach(([, , label]) => {
      console.log(`\n--- ${label} ---`);
      console.table(formatRows((specialOverlapResults.get(label) || []).slice(0, 20)));
    });

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
    const worstSpecialOverlap = Array.from(specialOverlapResults.entries())
      .sort((left, right) => right[1].length - left[1].length)[0];
    const optimizeFirst = summaryRows
      .slice()
      .sort((left, right) => {
        const leftScore = (left.total_count ? left.likely_false_positives / left.total_count : 0) + (left.total_count ? left.overlap_count / left.total_count : 0);
        const rightScore = (right.total_count ? right.likely_false_positives / right.total_count : 0) + (right.total_count ? right.overlap_count / right.total_count : 0);
        return rightScore - leftScore;
      })[0];

    const recommendationMap = {
      security_printing_core: "A) optimize Security Printing",
      security_inks: "B) optimize Security Inks",
      micro_optics: "C) optimize Micro Optics",
      holography: "D) optimize Holography",
      ovd: "E) optimize OVD",
      anti_counterfeit: "F) optimize Anti-counterfeit",
      personalization: "G) optimize Personalization",
      secure_documents: "H) optimize Secure Documents",
      intaglio: "A) optimize Security Printing",
    };

    console.log("\n=== Diagnostic Conclusions ===");
    console.table(formatRows([{
      worst_precision_subgroup: worstPrecision?.subgroup || "",
      worst_precision_ratio: worstPrecision?.total_count ? (worstPrecision.likely_false_positives / worstPrecision.total_count).toFixed(2) : "0.00",
      highest_overlap_subgroup: highestOverlap?.subgroup || "",
      highest_overlap_ratio: highestOverlap?.total_count ? (highestOverlap.overlap_count / highestOverlap.total_count).toFixed(2) : "0.00",
      worst_special_overlap: worstSpecialOverlap?.[0] || "",
      worst_special_overlap_count: worstSpecialOverlap?.[1]?.length || 0,
      optimize_first: recommendationMap[optimizeFirst?.subgroup_id] || "",
      optimize_first_reason: optimizeFirst
        ? "highest combined overlap and false-positive pressure in the shared security group"
        : "",
    }]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors during diagnostics.
    }
    console.error("Failed to run Shared Security Printing subgroup diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
