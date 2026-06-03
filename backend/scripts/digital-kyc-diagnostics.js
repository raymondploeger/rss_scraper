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

const DIGITAL_DOMAIN_CONTEXT = {
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
};

const DIGITAL_SPECIALIST_SOURCES = ["biometric update", "digital identity", "authentication", "identity verification"];

const CURRENT_KYC_CONFIG = {
  strong: ["kyc", "know your customer", "customer due diligence"],
  weak: ["due diligence"],
  hybrid: {
    minimumDomainScore: 12,
    minimumInterestScore: 22,
    related: ["aml", "aml/kyc", "customer due diligence", "cdd", "fraud prevention", "identity proofing", "onboarding"],
  },
};

const STRONG_KYC_EVIDENCE = [
  "kyc",
  "know your customer",
  "aml",
  "anti-money laundering",
  "customer due diligence",
  "cdd",
  "sanctions screening",
  "financial crime",
  "regulated onboarding",
  "banking compliance",
  "fintech compliance",
];

const WEAK_KYC_EVIDENCE = [
  "onboarding",
  "fraud prevention",
  "synthetic identity",
  "identity fraud",
  "financial services",
];

const IDV_EVIDENCE = [
  "idv",
  "identity verification",
  "document verification",
  "identity proofing",
  "remote identity proofing",
  "document and face verification",
  "proof of identity",
  "face verification",
  "document and face",
];

const AUTH_EVIDENCE = [
  "authentication",
  "login",
  "passkey",
  "fido",
  "trusted access",
  "continuous authentication",
  "authenticator",
  "account access",
  "mfa",
  "multi-factor authentication",
  "multi factor authentication",
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

function matchedKeywords(text, keywords = []) {
  return keywords.filter((keyword) => textMatchesKeyword(text, keyword));
}

function countBoostKeywordMatches(text, keywords = []) {
  return keywords.filter((keyword) => textMatchesKeyword(text, keyword)).length;
}

function getHostname(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
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
  };
}

function getDigitalDomainContextProfile(context) {
  const strongTitleHits = countBoostKeywordMatches(context.titleText, DIGITAL_DOMAIN_CONTEXT.strong);
  const strongTagHits = countBoostKeywordMatches(context.tagText, DIGITAL_DOMAIN_CONTEXT.strong);
  const strongMetaHits = countBoostKeywordMatches(context.metadataText, DIGITAL_DOMAIN_CONTEXT.strong);
  const strongBodyHits = countBoostKeywordMatches(context.bodyText, DIGITAL_DOMAIN_CONTEXT.strong);
  const weakTitleHits = countBoostKeywordMatches(context.titleText, DIGITAL_DOMAIN_CONTEXT.weak);
  const weakTagHits = countBoostKeywordMatches(context.tagText, DIGITAL_DOMAIN_CONTEXT.weak);
  const weakMetaHits = countBoostKeywordMatches(context.metadataText, DIGITAL_DOMAIN_CONTEXT.weak);
  const weakBodyHits = countBoostKeywordMatches(context.bodyText, DIGITAL_DOMAIN_CONTEXT.weak);
  const excludedHits =
    countBoostKeywordMatches(context.titleText, DIGITAL_DOMAIN_CONTEXT.excluded) +
    countBoostKeywordMatches(context.tagText, DIGITAL_DOMAIN_CONTEXT.excluded) +
    countBoostKeywordMatches(context.metadataText, DIGITAL_DOMAIN_CONTEXT.excluded);

  let score =
    (strongTitleHits * 5) +
    (strongTagHits * 4) +
    (strongMetaHits * 3.5) +
    (strongBodyHits * 1.25) +
    (weakTitleHits * 2) +
    (weakTagHits * 1.5) +
    (weakMetaHits * 1.25) +
    (weakBodyHits * 0.35);

  if (context.topic === "digital id") {
    score += 10;
  }

  return { score, excludedHits };
}

function contextMatchesDigitalSpecialistSource(context) {
  return DIGITAL_SPECIALIST_SOURCES.some((specialistSource) =>
    context.sourceText.includes(specialistSource) || context.domainText.includes(specialistSource)
  );
}

function getApproximateDominantDomain(article) {
  const context = buildContext(article);
  const digitalSignals = getDigitalDomainContextProfile(context);
  const identityScore =
    countBoostKeywordMatches(`${context.titleText} ${context.tagText} ${context.metadataText}`, [
      "passport",
      "identity card",
      "id card",
      "visa",
      "border control",
      "travel document",
    ]) * 3;
  const banknoteScore =
    countBoostKeywordMatches(`${context.titleText} ${context.tagText} ${context.metadataText}`, [
      "banknote",
      "banknotes",
      "central bank",
      "currency redesign",
    ]) * 3;
  const digitalScore =
    digitalSignals.score +
    (context.topic === "digital id" ? 20 : 0) +
    (contextMatchesDigitalSpecialistSource(context) ? 14 : 0);

  const candidates = [
    { domain: "digital_identity_biometrics", score: digitalScore },
    { domain: "identity_documents", score: identityScore },
    { domain: "banknotes", score: banknoteScore },
  ].sort((left, right) => right.score - left.score);

  if (!candidates.length || candidates[0].score < 8) {
    return "other";
  }
  if ((candidates[0].score - candidates[1].score) < 2 && candidates[0].score < 14) {
    return "other";
  }
  return candidates[0].domain;
}

function computeCurrentKycAssessment(article) {
  const context = buildContext(article);
  const domainContext = getDigitalDomainContextProfile(context);

  const strongMatches = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    CURRENT_KYC_CONFIG.strong
  );
  const weakMatches = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    CURRENT_KYC_CONFIG.weak
  );
  const hybridRelatedMatches = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    CURRENT_KYC_CONFIG.hybrid.related
  );

  let score = domainContext.score * 0.65;
  score += countBoostKeywordMatches(context.titleText, CURRENT_KYC_CONFIG.strong) * 5.5;
  score += countBoostKeywordMatches(context.tagText, CURRENT_KYC_CONFIG.strong) * 4.5;
  score += countBoostKeywordMatches(context.metadataText, CURRENT_KYC_CONFIG.strong) * 3.5;
  score += countBoostKeywordMatches(context.bodyText, CURRENT_KYC_CONFIG.strong) * 1.5;
  score += countBoostKeywordMatches(context.titleText, CURRENT_KYC_CONFIG.weak) * 1.5;
  score += countBoostKeywordMatches(context.tagText, CURRENT_KYC_CONFIG.weak) * 1.5;
  score += countBoostKeywordMatches(context.metadataText, CURRENT_KYC_CONFIG.weak) * 1;
  score += countBoostKeywordMatches(context.bodyText, CURRENT_KYC_CONFIG.weak) * 0.35;

  if (contextMatchesDigitalSpecialistSource(context)) {
    score += 10;
  }

  score -= domainContext.excludedHits * 10;
  score = Math.max(0, Math.round(score));

  const directMatch =
    strongMatches.length > 0 ||
    (weakMatches.length > 0 && score >= CURRENT_KYC_CONFIG.hybrid.minimumInterestScore);
  const hybridMatch =
    !directMatch &&
    domainContext.score >= CURRENT_KYC_CONFIG.hybrid.minimumDomainScore &&
    score >= CURRENT_KYC_CONFIG.hybrid.minimumInterestScore &&
    (weakMatches.length > 0 || hybridRelatedMatches.length > 0);

  return {
    currentMatchType: directMatch ? "direct" : hybridMatch ? "hybrid" : "excluded",
    included: directMatch || hybridMatch,
    kycScore: score,
    domainScore: domainContext.score,
    directStrongMatches: strongMatches,
    directWeakMatches: weakMatches,
    hybridRelatedMatches,
    beforeIncluded: score >= DIGITAL_SUBGROUP_BASELINE_MINIMUM_SCORE,
  };
}

function classifyKycArticle(article) {
  const context = buildContext(article);
  const evidenceText = `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`;
  const kyc = computeCurrentKycAssessment(article);
  const strongKycEvidence = matchedKeywords(evidenceText, STRONG_KYC_EVIDENCE);
  const weakKycEvidence = matchedKeywords(evidenceText, WEAK_KYC_EVIDENCE);
  const idvEvidence = matchedKeywords(evidenceText, IDV_EVIDENCE);
  const authenticationEvidence = matchedKeywords(evidenceText, AUTH_EVIDENCE);

  let recommendedAction = "ambiguous_keep_for_now";
  let explanation = "";

  if (strongKycEvidence.length >= 2) {
    recommendedAction = "keep_as_kyc";
    explanation = "Strong financial-compliance or KYC terminology is present.";
  } else if (strongKycEvidence.length >= 1 && idvEvidence.length <= strongKycEvidence.length + 1 && authenticationEvidence.length === 0) {
    recommendedAction = "keep_as_kyc";
    explanation = "Direct KYC/compliance evidence outweighs adjacent signals.";
  } else if (strongKycEvidence.length === 0 && weakKycEvidence.length > 0 && idvEvidence.length >= 2) {
    recommendedAction = "demote_from_kyc";
    explanation = "Weak KYC evidence is present, but the article reads more like identity verification.";
  } else if (strongKycEvidence.length === 0 && weakKycEvidence.length > 0 && authenticationEvidence.length >= 2) {
    recommendedAction = "demote_from_kyc";
    explanation = "Weak KYC evidence is present, but the article reads more like authentication/access control.";
  } else if (strongKycEvidence.length === 0 && weakKycEvidence.length > 0) {
    recommendedAction = "require_stronger_kyc_evidence";
    explanation = "Only weak/ambiguous KYC-adjacent evidence is present.";
  } else if (strongKycEvidence.length === 0 && idvEvidence.length >= 2) {
    recommendedAction = "demote_from_kyc";
    explanation = "Identity verification evidence dominates without financial-compliance evidence.";
  } else if (strongKycEvidence.length === 0 && authenticationEvidence.length >= 2) {
    recommendedAction = "demote_from_kyc";
    explanation = "Authentication/login evidence dominates without financial-compliance evidence.";
  } else {
    recommendedAction = "ambiguous_keep_for_now";
    explanation = "The article sits between KYC and adjacent digital identity themes.";
  }

  return {
    id: article.id,
    title: article.title || "",
    source: article.source || article.feedName || "",
    currentKycMatchType: kyc.currentMatchType,
    kycScore: kyc.kycScore,
    domainScore: kyc.domainScore,
    strongKycEvidence,
    weakKycEvidence,
    idvEvidence,
    authenticationEvidence,
    recommendedAction,
    explanation,
  };
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
    application_name: "digital-kyc-diagnostics",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadArticles(client);
    const digitalArticles = articles.filter((article) => getApproximateDominantDomain(article) === "digital_identity_biometrics");
    const kycArticles = digitalArticles
      .map((article) => ({ article, assessment: computeCurrentKycAssessment(article) }))
      .filter(({ assessment }) => assessment.included)
      .map(({ article }) => classifyKycArticle(article));

    await client.query("COMMIT");

    const strongKycEvidenceCount = kycArticles.filter((row) => row.strongKycEvidence.length > 0).length;
    const weakOnlyKycEvidenceCount = kycArticles.filter((row) => row.strongKycEvidence.length === 0 && row.weakKycEvidence.length > 0).length;
    const idvHeavyCount = kycArticles.filter((row) => row.idvEvidence.length > Math.max(0, row.strongKycEvidence.length + row.weakKycEvidence.length)).length;
    const authenticationHeavyCount = kycArticles.filter((row) => row.authenticationEvidence.length > Math.max(0, row.strongKycEvidence.length + row.weakKycEvidence.length)).length;
    const recommendedDemotions = kycArticles.filter((row) => row.recommendedAction === "demote_from_kyc").length;
    const recommendedKeep = kycArticles.filter((row) => row.recommendedAction === "keep_as_kyc").length;

    console.log("\n=== KYC Focused Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      digital_candidate_pool: digitalArticles.length,
      total_kyc_articles: kycArticles.length,
      strong_kyc_evidence_count: strongKycEvidenceCount,
      weak_only_kyc_evidence_count: weakOnlyKycEvidenceCount,
      idv_heavy_count: idvHeavyCount,
      authentication_heavy_count: authenticationHeavyCount,
      recommended_demotions: recommendedDemotions,
      recommended_keep: recommendedKeep,
    }]));

    const summaryRecommendations = [];
    if (weakOnlyKycEvidenceCount > 0) {
      summaryRecommendations.push("make weak KYC terms insufficient on their own");
    }
    if (strongKycEvidenceCount < kycArticles.length) {
      summaryRecommendations.push("add stronger financial-compliance keywords");
    }
    if (idvHeavyCount > 0) {
      summaryRecommendations.push("demote generic IDV articles from KYC");
    }
    if (weakOnlyKycEvidenceCount >= 3 || recommendedDemotions >= 2) {
      summaryRecommendations.push("raise the KYC threshold slightly for hybrid-only matches");
    }

    console.log("\n=== Recommended Threshold / Keyword Changes ===");
    console.table(formatRows(summaryRecommendations.map((recommendation) => ({ recommendation }))));

    const topRows = kycArticles
      .slice()
      .sort((left, right) => {
        const leftPriority = left.recommendedAction === "demote_from_kyc" ? 3 : left.recommendedAction === "require_stronger_kyc_evidence" ? 2 : left.recommendedAction === "ambiguous_keep_for_now" ? 1 : 0;
        const rightPriority = right.recommendedAction === "demote_from_kyc" ? 3 : right.recommendedAction === "require_stronger_kyc_evidence" ? 2 : right.recommendedAction === "ambiguous_keep_for_now" ? 1 : 0;
        if (rightPriority !== leftPriority) {
          return rightPriority - leftPriority;
        }
        if (right.idvEvidence.length !== left.idvEvidence.length) {
          return right.idvEvidence.length - left.idvEvidence.length;
        }
        return right.kycScore - left.kycScore;
      });

    console.log("\n=== KYC Articles ===");
    console.table(formatRows(topRows.map((row) => ({
      title: row.title,
      source: row.source,
      currentKycMatchType: row.currentKycMatchType,
      kycScore: row.kycScore,
      domainScore: row.domainScore,
      strongKycEvidence: row.strongKycEvidence,
      weakKycEvidence: row.weakKycEvidence,
      idvEvidence: row.idvEvidence,
      authenticationEvidence: row.authenticationEvidence,
      recommendedAction: row.recommendedAction,
      explanation: row.explanation,
    }))));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures.
    }
    console.error("Failed to run KYC focused diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
