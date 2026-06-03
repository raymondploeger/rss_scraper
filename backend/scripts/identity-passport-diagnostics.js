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

const DOMAIN_CONTEXT = {
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
};

const SPECIALIST_SOURCES = ["icao", "keesing", "biometric update", "regula", "thales", "veridos", "idemia"];

const PASSPORT_STRONG = [
  "passport",
  "passports",
  "e-passport",
  "epassport",
  "passport issuance",
  "passport renewal",
  "passport office",
  "passport security",
  "passport fraud",
  "passport design",
  "passport personalization",
];

const PASSPORT_MEDIUM = [
  "biometric passport",
  "travel document",
  "machine readable passport",
  "mrtd",
  "emrtd",
];

const PASSPORT_WEAK = [
  "passport verification",
  "document authentication",
  "travel credential",
  "secure credential",
  "identity document",
  "chip verification",
  "credential verification",
];

const PASSPORT_INTENT = {
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
    "passport modernization",
    "passport design",
    "secure passport",
  ],
  weakPositive: ["passport", "travel document", "mrz", "icao"],
  hardNegative: [
    "visa-free",
    "tourism",
    "passport ranking",
    "travel tips",
    "vacation",
    "passport paradise",
    "most powerful passport",
    "passport project",
    "pbs passport",
  ],
};

const PASSPORT_PROFILE = {
  strongPositive: [
    "biometric passport",
    "e-passport",
    "epassport",
    "passport issuance",
    "passport renewal",
    "passport personalization",
    "passport procurement",
    "passport verification",
    "passport rollout",
    "passport redesign",
    "passport fraud",
    "passport production",
    "document inspection",
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
  ],
  weakPositive: ["passport", "travel document", "passport office"],
  strongNegative: [
    "passport adventure",
    "passport paradise",
    "passport program",
    "travel rankings",
    "strongest passports",
    "travel tips",
    "holiday travel",
    "sports passport",
    "passport to flavor",
    "passport to summer",
    "pbs passport",
  ],
};

const ID_CARD_MARKERS = [
  "id card",
  "identity card",
  "national id",
  "citizen card",
  "national identity card",
  "electronic identity card",
  "identity card program",
];

const RESIDENCE_MARKERS = [
  "residence permit",
  "residence permit card",
  "residence card",
  "residence document",
  "immigration permit",
  "residence status",
  "resident card",
  "biometric residence permit",
  "foreign resident card",
];

const BORDER_MARKERS = [
  "border control",
  "passport control",
  "immigration control",
  "automated border control",
  "e-gate",
  "egate",
  "e-gates",
  "document inspection",
  "cbp",
  "frontex",
  "eu-lisa",
  "ees",
  "etias",
];

const IDENTITY_VERIFICATION_MARKERS = [
  "identity verification",
  "document verification",
  "id verification",
  "identity proofing",
  "remote identity proofing",
  "secure credential",
  "credential verification",
  "chip verification",
  "travel credential",
];

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

function countMatches(text, keywords = []) {
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

function contextMatchesSpecialistSource(context) {
  return SPECIALIST_SOURCES.some((value) => context.sourceText.includes(value) || context.domainText.includes(value));
}

function getDomainScore(context) {
  const strongTitleHits = countMatches(context.titleText, DOMAIN_CONTEXT.strong);
  const strongTagHits = countMatches(context.tagText, DOMAIN_CONTEXT.strong);
  const strongMetaHits = countMatches(context.metadataText, DOMAIN_CONTEXT.strong);
  const strongBodyHits = countMatches(context.bodyText, DOMAIN_CONTEXT.strong);
  const weakTitleHits = countMatches(context.titleText, DOMAIN_CONTEXT.weak);
  const weakTagHits = countMatches(context.tagText, DOMAIN_CONTEXT.weak);
  const weakMetaHits = countMatches(context.metadataText, DOMAIN_CONTEXT.weak);
  const weakBodyHits = countMatches(context.bodyText, DOMAIN_CONTEXT.weak);
  const excludedHits =
    countMatches(context.titleText, DOMAIN_CONTEXT.excluded) +
    countMatches(context.tagText, DOMAIN_CONTEXT.excluded) +
    countMatches(context.metadataText, DOMAIN_CONTEXT.excluded);

  let score =
    (strongTitleHits * 5) +
    (strongTagHits * 4) +
    (strongMetaHits * 3.5) +
    (strongBodyHits * 1.25) +
    (weakTitleHits * 2) +
    (weakTagHits * 1.5) +
    (weakMetaHits * 1.25) +
    (weakBodyHits * 0.35);

  if (context.topic === "identity documents") {
    score += 10;
  }

  return { score, excludedHits };
}

function isIdentityCandidate(article) {
  const context = buildContext(article);
  const score = getDomainScore(context).score + (contextMatchesSpecialistSource(context) ? 14 : 0);
  return score >= 8;
}

function weightedHits(context, terms = []) {
  return (countMatches(context.titleText, terms) * 5) +
    (countMatches(context.tagText, terms) * 2.5) +
    (countMatches(context.metadataText, terms) * 2.5) +
    countMatches(context.bodyText, terms);
}

function calculateIntentScore(articleText, intentProfile) {
  const normalizedText = String(articleText || "").toLowerCase();
  const matchedStrong = (intentProfile?.strongPositive || []).filter((term) => textMatchesKeyword(normalizedText, term));
  const matchedWeak = (intentProfile?.weakPositive || []).filter((term) => textMatchesKeyword(normalizedText, term));
  const matchedNegative = (intentProfile?.hardNegative || []).filter((term) => textMatchesKeyword(normalizedText, term));
  let score = (matchedStrong.length * 15) + (matchedWeak.length * 4) - (matchedNegative.length * 20);
  if (matchedNegative.length >= 2) {
    score -= 500;
  }
  return { score, matchedStrong, matchedWeak, matchedNegative };
}

function calculateProfileScore(context) {
  const measure = (terms = [], weights) => {
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
    return {
      matched,
      score:
        (titleHits * weights.title) +
        (tagHits * weights.tag) +
        (metaHits * weights.meta) +
        (bodyHits * weights.body),
    };
  };

  const strong = measure(PASSPORT_PROFILE.strongPositive, { title: 16, tag: 9, meta: 8, body: 6 });
  const medium = measure(PASSPORT_PROFILE.mediumPositive, { title: 10, tag: 6, meta: 5, body: 3 });
  const weak = measure(PASSPORT_PROFILE.weakPositive, { title: 4, tag: 2, meta: 2, body: 1 });
  const negative = measure(PASSPORT_PROFILE.strongNegative, { title: 18, tag: 10, meta: 8, body: 6 });

  return {
    score: strong.score + medium.score + weak.score - negative.score,
    matchedStrong: strong.matched,
    matchedMedium: medium.matched,
    matchedWeak: weak.matched,
    matchedNegative: negative.matched,
  };
}

function getRecencyBoost(article) {
  const publishedAt = article.pubDate ? new Date(article.pubDate).getTime() : NaN;
  if (!Number.isFinite(publishedAt)) {
    return -45;
  }
  const ageDays = Math.max(0, (Date.now() - publishedAt) / (24 * 60 * 60 * 1000));
  if (ageDays <= 30) return 125;
  if (ageDays <= 90) return 70;
  if (ageDays <= 180) return 30;
  if (ageDays > 365 * 5) return -260;
  if (ageDays > 365 * 3) return -180;
  if (ageDays > 365) return -90;
  return 0;
}

function computeCompetingEvidence(context) {
  return {
    idCardHits: matchedKeywords(`${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`, ID_CARD_MARKERS),
    residenceHits: matchedKeywords(`${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`, RESIDENCE_MARKERS),
    borderHits: matchedKeywords(`${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`, BORDER_MARKERS),
    idvHits: matchedKeywords(`${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`, IDENTITY_VERIFICATION_MARKERS),
  };
}

function classifyPassportArticle(record) {
  const strongCount = record.strongEvidence.length;
  const mediumCount = record.mediumEvidence.length;
  const weakCount = record.weakEvidence.length;
  const idCardCount = record.competing.idCardHits.length;
  const residenceCount = record.competing.residenceHits.length;
  const borderCount = record.competing.borderHits.length;
  const idvCount = record.competing.idvHits.length;

  if (strongCount >= 2 && idCardCount === 0 && residenceCount === 0 && borderCount === 0 && idvCount === 0) {
    return "Genuine Passport Article";
  }
  if (strongCount >= 1 && (idCardCount > 0 || residenceCount > 0 || borderCount > 0)) {
    return "Passport-heavy but multi-category";
  }
  if (residenceCount >= 2 && strongCount === 0) {
    return "Generic Identity Document Article";
  }
  if (idvCount >= 2 && strongCount === 0 && mediumCount === 0) {
    return "Identity Verification Article";
  }
  if (borderCount >= 2 && strongCount === 0) {
    return "Border Control Article";
  }
  if (strongCount === 0 && mediumCount === 0 && weakCount > 0) {
    return "Likely Passport False Positive";
  }
  if (strongCount === 0 && (idCardCount > 0 || residenceCount > 0)) {
    return "Generic Identity Document Article";
  }
  return "Passport-heavy but multi-category";
}

function shouldRemoveFromPassports(record) {
  return [
    "Likely Passport False Positive",
    "Identity Verification Article",
    "Generic Identity Document Article",
  ].includes(record.classification);
}

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
    application_name: "identity-passport-diagnostics",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadArticles(client);
    const candidateArticles = articles.filter((article) => isIdentityCandidate(article));
    const rows = [];

    candidateArticles.forEach((article) => {
      const context = buildContext(article);
      const domainScore = getDomainScore(context).score;
      const specialistBoost = contextMatchesSpecialistSource(context) ? 10 : 0;
      const recencyBoost = getRecencyBoost(article);
      const intentText = `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`;
      const intent = calculateIntentScore(intentText, PASSPORT_INTENT);
      const profile = calculateProfileScore(context);
      const strongEvidence = matchedKeywords(intentText, PASSPORT_STRONG);
      const mediumEvidence = matchedKeywords(intentText, PASSPORT_MEDIUM);
      const weakEvidence = matchedKeywords(intentText, PASSPORT_WEAK);
      const signals = {
        passportHits: weightedHits(context, [
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
          "secure passport",
        ]),
        issuanceHits: weightedHits(context, ["document issuance", "passport issuance", "secure issuance", "enrollment", "personalization"]),
        noisyHits: weightedHits(context, ["travel tips", "vacation", "travel blog", "passport ranking", "passport paradise", "pbs passport"]),
      };

      let passportScore = (domainScore * 0.65) + specialistBoost + recencyBoost;
      passportScore += (countMatches(context.titleText, ["passport", "passports", "travel document"]) * 5.5) +
        (countMatches(context.tagText, ["passport", "passports", "travel document"]) * 4.5) +
        (countMatches(context.metadataText, ["passport", "passports", "travel document"]) * 3.5) +
        (countMatches(context.bodyText, ["passport", "passports", "travel document"]) * 1.5);
      passportScore += Math.min(80, Math.round(signals.passportHits * 0.9));
      passportScore += Math.min(90, Math.round((signals.passportHits * 0.7) + (intent.score * 1.1)));
      passportScore += Math.max(-120, Math.round((signals.passportHits * 0.7) + (signals.issuanceHits * 0.45) - (signals.noisyHits * 0.9) + (intent.score || 0) + (profile.score * 1.1)));
      passportScore -= Math.min(90, Math.round(signals.noisyHits * 0.8));
      passportScore = Math.max(0, Math.round(passportScore));

      const directMatch =
        strongEvidence.length > 0 ||
        intent.matchedStrong.length > 0 ||
        profile.matchedStrong.length > 0;
      const hybridMatch =
        !directMatch &&
        passportScore >= 18 &&
        domainScore >= 7 &&
        (mediumEvidence.length > 0 || weakEvidence.length > 0 || intent.matchedWeak.length > 0 || profile.matchedMedium.length > 0);

      if (!(passportScore >= 18 && (directMatch || hybridMatch))) {
        return;
      }

      const competing = computeCompetingEvidence(context);
      const classification = classifyPassportArticle({
        strongEvidence,
        mediumEvidence,
        weakEvidence,
        competing,
      });

      rows.push({
        id: article.id,
        title: article.title || "",
        source: article.source || article.feedName || "",
        link: article.link || "",
        passportScore,
        matchType: directMatch ? "direct" : "hybrid",
        strongEvidence,
        mediumEvidence,
        weakEvidence,
        intent,
        profile,
        competing,
        classification,
      });
    });

    await client.query("COMMIT");

    console.log("\n=== Passport Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      identity_candidate_pool: candidateArticles.length,
      passports_included: rows.length,
    }]));

    console.log("\n=== Per-article passport report ===");
    console.table(formatRows(
      rows
        .slice()
        .sort((left, right) => right.passportScore - left.passportScore)
        .slice(0, 150)
        .map((row) => ({
          title: row.title,
          source: row.source,
          passport_score: row.passportScore,
          match_type: row.matchType,
          classification: row.classification,
          trigger_keywords: [...row.strongEvidence, ...row.mediumEvidence, ...row.weakEvidence].slice(0, 8),
          strong_passport_evidence: row.strongEvidence,
          medium_passport_evidence: row.mediumEvidence,
          weak_passport_evidence: row.weakEvidence,
          competing_id_card_evidence: row.competing.idCardHits,
          competing_residence_evidence: row.competing.residenceHits,
          competing_idv_evidence: row.competing.idvHits,
          competing_border_evidence: row.competing.borderHits,
        }))
    ));

    const keywordCounts = new Map();
    const strongSignalCounts = new Map();
    const weakSignalCounts = new Map();
    const removalRows = [];
    const keepRows = [];

    rows.forEach((row) => {
      [...row.strongEvidence, ...row.mediumEvidence, ...row.weakEvidence].forEach((keyword) => {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      });
      row.strongEvidence.forEach((keyword) => {
        strongSignalCounts.set(keyword, (strongSignalCounts.get(keyword) || 0) + 1);
      });
      row.weakEvidence.forEach((keyword) => {
        weakSignalCounts.set(keyword, (weakSignalCounts.get(keyword) || 0) + 1);
      });

      const compact = {
        title: row.title,
        source: row.source,
        passport_score: row.passportScore,
        classification: row.classification,
        triggers: [...row.strongEvidence, ...row.mediumEvidence, ...row.weakEvidence].slice(0, 8),
      };
      if (shouldRemoveFromPassports(row)) {
        removalRows.push(compact);
      } else if (["Genuine Passport Article", "Passport-heavy but multi-category"].includes(row.classification)) {
        keepRows.push(compact);
      }
    });

    console.log("\n=== Summary ===");
    console.table(formatRows([{
      genuine_passport_articles: rows.filter((row) => row.classification === "Genuine Passport Article").length,
      passport_heavy_multi_category: rows.filter((row) => row.classification === "Passport-heavy but multi-category").length,
      generic_identity_document_articles: rows.filter((row) => row.classification === "Generic Identity Document Article").length,
      identity_verification_articles: rows.filter((row) => row.classification === "Identity Verification Article").length,
      border_control_articles: rows.filter((row) => row.classification === "Border Control Article").length,
      likely_false_positives: rows.filter((row) => row.classification === "Likely Passport False Positive").length,
    }]));

    console.log("\n=== Top passport trigger keywords ===");
    console.table(formatRows(
      Array.from(keywordCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 20)
        .map(([keyword, count]) => ({ keyword, count }))
    ));

    console.log("\n=== Strongest passport signals ===");
    console.table(formatRows(
      Array.from(strongSignalCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 20)
        .map(([keyword, count]) => ({ keyword, count }))
    ));

    console.log("\n=== Weakest passport signals ===");
    console.table(formatRows(
      Array.from(weakSignalCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 20)
        .map(([keyword, count]) => ({ keyword, count }))
    ));

    console.log("\n=== Articles that should probably be removed from Passports ===");
    console.table(formatRows(removalRows.slice(0, 40)));

    console.log("\n=== Articles that should remain in Passports ===");
    console.table(formatRows(keepRows.slice(0, 40)));

    const weakFalsePositiveCounts = new Map();
    rows
      .filter((row) => shouldRemoveFromPassports(row))
      .forEach((row) => {
        row.weakEvidence.forEach((keyword) => {
          weakFalsePositiveCounts.set(keyword, (weakFalsePositiveCounts.get(keyword) || 0) + 1);
        });
      });

    const recommendation =
      removalRows.length > 0 && Array.from(weakFalsePositiveCounts.values()).reduce((sum, value) => sum + value, 0) > 0
        ? "B) reduce weight of weak passport signals"
        : rows.filter((row) => row.matchType === "hybrid").length > rows.filter((row) => row.matchType === "direct").length * 0.5
          ? "C) require stronger passport evidence"
          : "D) leave current behavior unchanged";

    console.log("\n=== Recommendation ===");
    console.table(formatRows([{
      recommendation,
      why: recommendation === "B) reduce weight of weak passport signals"
        ? "weak passport evidence appears on removable records and is the clearest shared false-positive driver"
        : recommendation === "C) require stronger passport evidence"
          ? "hybrid passport matches are contributing a large share of leakage"
          : "passport leakage is not dominated by weak-signal-only matches in this sample",
      weak_signals_responsible_for_false_positives: Array.from(weakFalsePositiveCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10)
        .map(([keyword, count]) => `${keyword} (${count})`),
    }]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors during diagnostics.
    }
    console.error("Failed to run passport diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
