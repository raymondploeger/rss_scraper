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
const articleLimit = Math.max(500, Math.min(5000, Number(limitArg ? limitArg.split("=")[1] : 3000) || 3000));

const DIGITAL_SUBGROUP_BASELINE_MINIMUM_SCORE = 18;

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

const SUBGROUPS = {
  kyc: {
    label: "KYC",
    strong: ["kyc", "know your customer", "customer due diligence"],
    weak: ["due diligence"],
    hybrid: {
      minimumDomainScore: 12,
      minimumInterestScore: 22,
      related: ["aml", "aml/kyc", "customer due diligence", "cdd", "fraud prevention", "identity proofing", "onboarding"],
    },
    focus: [
      "kyc",
      "know your customer",
      "aml",
      "aml/kyc",
      "customer due diligence",
      "cdd",
      "regulated onboarding",
      "banking verification",
      "fintech compliance",
      "sanctions screening",
      "financial crime",
      "synthetic identity fraud",
      "synthetic identity fraud in financial services",
      "financial services",
      "fraud prevention",
    ],
  },
  identity_verification: {
    label: "Identity Verification",
    strong: ["identity verification", "document verification", "id verification"],
    weak: ["verification platform"],
    hybrid: {
      minimumDomainScore: 11,
      minimumInterestScore: 20,
      related: ["document verification", "id verification", "identity proofing", "proof of identity", "idv"],
    },
    focus: [
      "identity verification",
      "document verification",
      "id verification",
      "identity proofing",
      "proof of identity",
      "remote identity proofing",
      "idv",
      "biometric identity proofing",
      "document and face verification",
      "proofing",
      "face verification",
    ],
  },
  authentication: {
    label: "Authentication",
    strong: ["authentication", "login verification", "multi-factor authentication"],
    weak: ["authenticator"],
    hybrid: {
      minimumDomainScore: 11,
      minimumInterestScore: 20,
      related: ["passkey", "fido", "login", "multi-factor", "multi factor", "mfa", "access management"],
    },
    focus: [
      "authentication",
      "login authentication",
      "multi-factor authentication",
      "multi factor authentication",
      "passkeys",
      "passkey",
      "fido",
      "account access",
      "trusted access",
      "authenticator",
      "zero trust authentication",
      "continuous authentication",
      "user authentication",
      "mfa",
      "login",
      "access management",
    ],
  },
};

const CROSS_ANALYSIS = {
  kyc: ["identity_verification", "authentication"],
  identity_verification: ["kyc", "authentication"],
  authentication: ["kyc", "identity_verification"],
};

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
    titleText: [article.title, article.normalizedTitle].filter(Boolean).join(" ").toLowerCase(),
    tagText: [article.keywords].filter(Boolean).join(" ").toLowerCase(),
    metadataText: [article.topic, sourceText].filter(Boolean).join(" ").toLowerCase(),
    bodyText: [article.summary, article.summaryShort, article.contentSnippet].filter(Boolean).join(" ").toLowerCase(),
    sourceText,
    domainText,
    topic: normalizeKeyword(article.topic),
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

function computeInterestScore(article, subgroupId) {
  const subgroup = SUBGROUPS[subgroupId];
  const context = buildContext(article);
  const domainContext = getDomainContextProfile(context, "digital_identity_biometrics");
  const strongKeywords = subgroup.strong;
  const weakKeywords = subgroup.weak;

  const titleStrongHits = countBoostKeywordMatches(context.titleText, strongKeywords);
  const tagStrongHits = countBoostKeywordMatches(context.tagText, strongKeywords);
  const metaStrongHits = countBoostKeywordMatches(context.metadataText, strongKeywords);
  const bodyStrongHits = countBoostKeywordMatches(context.bodyText, strongKeywords);
  const titleWeakHits = countBoostKeywordMatches(context.titleText, weakKeywords);
  const tagWeakHits = countBoostKeywordMatches(context.tagText, weakKeywords);
  const metaWeakHits = countBoostKeywordMatches(context.metadataText, weakKeywords);
  const bodyWeakHits = countBoostKeywordMatches(context.bodyText, weakKeywords);

  let score = domainContext.score * 0.65;
  score += (titleStrongHits * 5.5) + (tagStrongHits * 4.5) + (metaStrongHits * 3.5) + (bodyStrongHits * 1.5);
  score += (titleWeakHits * 1.5) + (tagWeakHits * 1.5) + (metaWeakHits * 1) + (bodyWeakHits * 0.35);

  if (contextMatchesSpecialistSource(context, "digital_identity_biometrics")) {
    score += 10;
  }

  score -= domainContext.excludedHits * 10;
  score = Math.max(0, Math.round(score));

  return {
    score,
    domainScore: domainContext.score,
  };
}

function assessSubgroup(article, subgroupId) {
  const subgroup = SUBGROUPS[subgroupId];
  const context = buildContext(article);
  const scoreResult = computeInterestScore(article, subgroupId);
  const directStrong = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    subgroup.strong
  );
  const directWeak = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    subgroup.weak
  );
  const related = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    subgroup.hybrid.related
  );
  const focus = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    subgroup.focus
  );

  const directMatch = directStrong.length > 0 || (directWeak.length > 0 && scoreResult.score >= subgroup.hybrid.minimumInterestScore);
  const hybridMatch =
    !directMatch &&
    scoreResult.domainScore >= subgroup.hybrid.minimumDomainScore &&
    scoreResult.score >= subgroup.hybrid.minimumInterestScore &&
    (directWeak.length > 0 || related.length > 0);
  const beforeIncluded = scoreResult.score >= DIGITAL_SUBGROUP_BASELINE_MINIMUM_SCORE;
  const included = directMatch || hybridMatch;

  return {
    subgroupId,
    score: scoreResult.score,
    domainScore: scoreResult.domainScore,
    beforeIncluded,
    included,
    directMatch,
    hybridMatch,
    directStrong,
    directWeak,
    related,
    focus,
  };
}

function chooseTopRows(rows, limit = 20) {
  return rows
    .slice()
    .sort((left, right) => {
      if (Number(right.directMatch) !== Number(left.directMatch)) {
        return Number(right.directMatch) - Number(left.directMatch);
      }
      if ((right.focus?.length || 0) !== (left.focus?.length || 0)) {
        return (right.focus?.length || 0) - (left.focus?.length || 0);
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

  const others = CROSS_ANALYSIS[subgroupId].map((otherId) => ({
    subgroupId: otherId,
    assessment: allAssessments[otherId],
  }));
  const strongestOther = others
    .slice()
    .sort((left, right) => {
      const leftScore = (left.assessment.focus.length * 4) + (left.assessment.directStrong.length * 3) + left.assessment.related.length;
      const rightScore = (right.assessment.focus.length * 4) + (right.assessment.directStrong.length * 3) + right.assessment.related.length;
      return rightScore - leftScore;
    })[0];

  const ownEvidenceScore = (record.focus.length * 4) + (record.directStrong.length * 3) + record.related.length + record.directWeak.length;
  const strongestOtherScore = strongestOther
    ? (strongestOther.assessment.focus.length * 4) + (strongestOther.assessment.directStrong.length * 3) + strongestOther.assessment.related.length + strongestOther.assessment.directWeak.length
    : 0;

  if (!record.directMatch && record.focus.length === 0 && record.related.length === 0) {
    return { likelyFalsePositive: true, reason: "no_subgroup_specific_evidence" };
  }
  if (!record.directMatch && strongestOther && strongestOtherScore >= ownEvidenceScore + 3) {
    return {
      likelyFalsePositive: true,
      reason: `looks_more_like_${strongestOther.subgroupId}`,
    };
  }
  if (subgroupId === "kyc" && !record.directMatch && strongestOther?.subgroupId === "identity_verification" && strongestOtherScore >= ownEvidenceScore + 2) {
    return { likelyFalsePositive: true, reason: "identity_verification_like" };
  }
  if (subgroupId === "authentication" && record.focus.length === 0 && !record.directMatch && record.related.length === 0) {
    return { likelyFalsePositive: true, reason: "missing_login_access_evidence" };
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
    application_name: "digital-subgroup-overlap-diagnostics",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadArticles(client);
    const candidateArticles = articles.filter((article) => getApproximateDominantDomain(article) === "digital_identity_biometrics");

    const subgroupResults = new Map();
    Object.keys(SUBGROUPS).forEach((subgroupId) => {
      subgroupResults.set(subgroupId, []);
    });

    candidateArticles.forEach((article) => {
      const assessments = Object.fromEntries(
        Object.keys(SUBGROUPS).map((subgroupId) => [subgroupId, assessSubgroup(article, subgroupId)])
      );

      Object.entries(assessments).forEach(([subgroupId, assessment]) => {
        if (!assessment.included) {
          return;
        }

        const overlaps = CROSS_ANALYSIS[subgroupId].filter((otherId) => assessments[otherId].included);
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
          directStrong: assessment.directStrong,
          directWeak: assessment.directWeak,
          related: assessment.related,
          focus: assessment.focus,
          overlaps,
          likelyFalsePositive: falsePositive.likelyFalsePositive,
          falsePositiveReason: falsePositive.reason,
          allAssessments: assessments,
        });
      });
    });

    await client.query("COMMIT");

    console.log("\n=== Digital Subgroup Overlap Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      digital_candidate_pool: candidateArticles.length,
      subgroup_scope: "KYC, Identity Verification, Authentication",
    }]));

    const summaryRows = Object.entries(SUBGROUPS).map(([subgroupId, subgroup]) => {
      const rows = subgroupResults.get(subgroupId) || [];
      const directCount = rows.filter((row) => row.matchType === "direct").length;
      const hybridCount = rows.filter((row) => row.matchType === "hybrid").length;
      const overlapCount = rows.filter((row) => row.overlaps.length > 0).length;
      const falsePositiveCount = rows.filter((row) => row.likelyFalsePositive).length;
      return {
        subgroup: subgroup.label,
        total_count: rows.length,
        direct_match_count: directCount,
        hybrid_match_count: hybridCount,
        overlap_with_other_two: overlapCount,
        likely_false_positives: falsePositiveCount,
      };
    });

    console.log("\n=== Summary ===");
    console.table(formatRows(summaryRows));

    for (const [subgroupId, subgroup] of Object.entries(SUBGROUPS)) {
      const rows = subgroupResults.get(subgroupId) || [];
      const overlapRows = rows.filter((row) => row.overlaps.length > 0);
      const falsePositives = rows.filter((row) => row.likelyFalsePositive);
      const topRows = chooseTopRows(rows, 20).map((row) => ({
        title: row.title,
        source: row.source,
        matchType: row.matchType,
        subgroupScore: row.score,
        domainScore: row.domainScore,
        directStrong: row.directStrong,
        directWeak: row.directWeak,
        related: row.related,
        focus: row.focus,
        overlaps: row.overlaps,
        likelyFalsePositive: row.likelyFalsePositive,
        falsePositiveReason: row.falsePositiveReason,
      }));

      console.log(`\n=== ${subgroup.label} ===`);
      console.table(formatRows([{
        total_count: rows.length,
        direct_match_count: rows.filter((row) => row.matchType === "direct").length,
        hybrid_match_count: rows.filter((row) => row.matchType === "hybrid").length,
        overlap_with_other_two: overlapRows.length,
        likely_false_positives: falsePositives.length,
      }]));

      console.log(`\n--- ${subgroup.label}: Top 20 Article Titles With Match Reasons ---`);
      console.table(formatRows(topRows));
    }

    const pairwiseRows = [];
    Object.entries(CROSS_ANALYSIS).forEach(([subgroupId, otherIds]) => {
      const subgroupRows = subgroupResults.get(subgroupId) || [];
      otherIds.forEach((otherId) => {
        const looksMoreLike = subgroupRows
          .filter((row) => row.likelyFalsePositive && row.falsePositiveReason === `looks_more_like_${otherId}`)
          .slice(0, 20)
          .map((row) => ({
            sourceSubgroup: SUBGROUPS[subgroupId].label,
            looksMoreLike: SUBGROUPS[otherId].label,
            title: row.title,
            source: row.source,
            matchType: row.matchType,
            sourceSubgroupScore: row.score,
            sourceFocus: row.focus,
            otherFocus: row.allAssessments[otherId].focus,
            otherDirectStrong: row.allAssessments[otherId].directStrong,
            otherRelated: row.allAssessments[otherId].related,
          }));
        pairwiseRows.push(...looksMoreLike);
      });
    });

    console.log("\n=== Cross-Subgroup Misclassification Samples ===");
    if (!pairwiseRows.length) {
      console.log("(no strong cross-subgroup misclassification samples found)");
    } else {
      console.table(formatRows(pairwiseRows));
    }

    const recommendationScores = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };
    const kycRows = subgroupResults.get("kyc") || [];
    const idvRows = subgroupResults.get("identity_verification") || [];
    const authRows = subgroupResults.get("authentication") || [];

    recommendationScores.A += kycRows.filter((row) =>
      row.falsePositiveReason === "looks_more_like_identity_verification" ||
      row.falsePositiveReason === "looks_more_like_authentication"
    ).length;
    recommendationScores.B += authRows.filter((row) =>
      row.falsePositiveReason === "looks_more_like_kyc" ||
      row.falsePositiveReason === "looks_more_like_identity_verification" ||
      row.falsePositiveReason === "missing_login_access_evidence"
    ).length;
    recommendationScores.C += idvRows.filter((row) =>
      row.falsePositiveReason === "looks_more_like_kyc" ||
      row.falsePositiveReason === "looks_more_like_authentication" ||
      row.falsePositiveReason === "no_subgroup_specific_evidence"
    ).length;
    if (Math.max(recommendationScores.A, recommendationScores.B, recommendationScores.C) < 5) {
      recommendationScores.D = 1;
    }

    const recommendedAction = Object.entries(recommendationScores).sort((left, right) => right[1] - left[1])[0][0];
    const recommendationText = {
      A: "strengthen KYC financial-compliance evidence",
      B: "strengthen Authentication login/access evidence",
      C: "separate Identity Verification from generic digital identity",
      D: "leave current behavior as-is",
    };

    console.log("\n=== Recommendation ===");
    console.table(formatRows([{
      next_safe_change: recommendedAction,
      recommendation: recommendationText[recommendedAction],
      score_A: recommendationScores.A,
      score_B: recommendationScores.B,
      score_C: recommendationScores.C,
      score_D: recommendationScores.D,
    }]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures.
    }
    console.error("Failed to run digital subgroup overlap diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
