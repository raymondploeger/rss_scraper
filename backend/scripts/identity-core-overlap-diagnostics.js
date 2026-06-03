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

const FOCUS_GROUPS = {
  passports: {
    label: "Passports",
    strong: ["passport", "passports", "travel document"],
    weak: ["passport office"],
    focus: [
      "passport",
      "passport issuance",
      "passport design",
      "passport security",
      "passport modernization",
      "biometric passport",
      "e-passport",
      "epassport",
      "travel document",
      "passport personalization",
      "passport renewal",
      "secure passport",
    ],
    bridge: ["icao", "mrz", "doc 9303", "travel document security", "document authentication"],
  },
  id_cards: {
    label: "ID Cards",
    strong: ["id card", "identity card", "national id"],
    weak: ["id issuance"],
    focus: [
      "id card",
      "identity card",
      "national id",
      "citizen card",
      "national identity card",
      "citizen identity card",
      "electronic identity card",
      "identity card program",
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
      "residence document",
      "immigration permit",
      "residence status",
      "resident card",
      "biometric residence permit",
      "foreign resident card",
      "permit issuance",
      "permit personalization",
    ],
    bridge: ["immigration card", "stay permit", "resident permit", "permit renewal"],
  },
};

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

const INTENTS = {
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
      "resident permit",
      "immigration card",
      "stay permit",
      "biometric residence permit",
      "permit issuance",
      "permit personalization",
      "foreign resident card",
      "secure permit document",
      "residence document",
    ],
    weakPositive: ["immigration", "permit card"],
    hardNegative: [
      "tourism",
      "visa-free",
      "passport ranking",
      "travel ranking",
      "migration opinion",
      "expat blog",
      "relocation guide",
    ],
  },
};

const PROFILE_TERMS = {
  passports: {
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
    ],
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
      "foreign resident card",
      "secure permit document",
      "permit verification",
      "permit renewal system",
      "immigration card",
      "residence document",
    ],
    mediumPositive: [
      "immigration card system",
      "resident permit",
      "stay permit",
      "permit card security",
      "secure issuance",
      "permit renewal",
      "document authentication",
    ],
    weakPositive: ["residence permit", "permit card", "immigration card"],
    strongNegative: [
      "expat blog",
      "relocation guide",
      "generic asylum news",
      "migration opinion",
      "generic immigration news",
      "travel story",
    ],
  },
};

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

function getSignals(article) {
  const context = buildContext(article);
  return {
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
    idCardHits: weightedHits(context, [
      "identity card",
      "id card",
      "national id",
      "electronic identity card",
      "polycarbonate id",
      "card issuance",
      "card design",
      "citizen card",
      "national identity card",
    ]),
    residencePermitHits: weightedHits(context, [
      "residence permit",
      "residence permits",
      "permit card",
      "immigration permit",
      "resident permit",
      "residence document",
      "biometric residence permit",
      "permit issuance",
      "permit personalization",
      "foreign resident card",
    ]),
    issuanceHits: weightedHits(context, [
      "document issuance",
      "passport issuance",
      "identity card issuance",
      "residence permit issuance",
      "secure issuance",
      "enrollment",
      "personalization",
    ]),
    noisyHits: weightedHits(context, [
      "travel tips",
      "vacation",
      "visa requirements",
      "travel blog",
      "tourism journalism",
      "destination content",
      "migration opinion",
      "expat blog",
      "relocation guide",
    ]),
  };
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

function calculateProfileScore(context, profileId) {
  const profile = PROFILE_TERMS[profileId];
  if (!profile) {
    return { score: 0, matchedStrong: [], matchedMedium: [], matchedWeak: [], matchedNegative: [] };
  }

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

  const strong = measure(profile.strongPositive, { title: 16, tag: 9, meta: 8, body: 6 });
  const medium = measure(profile.mediumPositive, { title: 10, tag: 6, meta: 5, body: 3 });
  const weak = measure(profile.weakPositive, { title: 4, tag: 2, meta: 2, body: 1 });
  const negative = measure(profile.strongNegative, { title: 18, tag: 10, meta: 8, body: 6 });

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

function computeAssessments(article) {
  const context = buildContext(article);
  const contextHaystack = `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`;
  const domainScore = getDomainScore(context).score;
  const signals = getSignals(article);
  const recencyBoost = getRecencyBoost(article);
  const specialistBoost = contextMatchesSpecialistSource(context) ? 10 : 0;
  const intentText = contextHaystack;
  const passportIntent = calculateIntentScore(intentText, INTENTS.passports);
  const residenceIntent = calculateIntentScore(intentText, INTENTS.residence_permits);
  const passportProfile = calculateProfileScore(context, "passports");
  const residenceProfile = calculateProfileScore(context, "residence_permits");

  const scoreByGroup = {
    passports:
      (signals.passportHits * 0.7) +
      (signals.issuanceHits * 0.45) -
      (signals.idCardHits * 0.2) -
      (signals.residencePermitHits * 0.25) -
      (signals.noisyHits * 0.9) +
      (passportIntent.score || 0) +
      (passportProfile.score * 1.1),
    id_cards:
      (signals.idCardHits * 1.55) +
      (signals.issuanceHits * 0.4) -
      (signals.passportHits * 0.45) -
      (signals.residencePermitHits * 0.35) -
      (signals.noisyHits * 0.4),
    residence_permits:
      (signals.residencePermitHits * 1.95) +
      (signals.issuanceHits * 0.45) +
      (signals.passportHits * -0.45) +
      (signals.idCardHits * -0.2) -
      (signals.noisyHits * 0.55) +
      (residenceIntent.score || 0) +
      (residenceProfile.score * 1.15),
  };

  return Object.entries(FOCUS_GROUPS).reduce((acc, [groupId, group]) => {
    const strongMatches = matchedKeywords(contextHaystack, group.strong);
    const weakMatches = matchedKeywords(contextHaystack, group.weak);
    const focusMatches = matchedKeywords(contextHaystack, group.focus);
    const bridgeMatches = matchedKeywords(contextHaystack, group.bridge);
    let score = (domainScore * 0.65) + specialistBoost + recencyBoost + Math.max(-120, Math.round(scoreByGroup[groupId] || 0));
    score += (countMatches(context.titleText, group.strong) * 5.5) +
      (countMatches(context.tagText, group.strong) * 4.5) +
      (countMatches(context.metadataText, group.strong) * 3.5) +
      (countMatches(context.bodyText, group.strong) * 1.5);
    score += (countMatches(context.titleText, group.weak) * 1.5) +
      (countMatches(context.tagText, group.weak) * 1.5) +
      (countMatches(context.metadataText, group.weak) * 1.0) +
      (countMatches(context.bodyText, group.weak) * 0.35);

    const intent = groupId === "passports"
      ? passportIntent
      : groupId === "residence_permits"
        ? residenceIntent
        : { score: 0, matchedStrong: [], matchedWeak: [], matchedNegative: [] };
    const profile = groupId === "passports"
      ? passportProfile
      : groupId === "residence_permits"
        ? residenceProfile
        : { score: 0, matchedStrong: [], matchedMedium: [], matchedWeak: [], matchedNegative: [] };

    if (groupId === "passports") {
      score += Math.min(90, Math.round((signals.passportHits * 0.7) + (intent.score * 1.1)));
      score -= Math.min(80, Math.round(signals.residencePermitHits * 0.25));
    } else if (groupId === "id_cards") {
      score += Math.min(90, Math.round(signals.idCardHits * 1.25));
    } else if (groupId === "residence_permits") {
      score += Math.min(110, Math.round((signals.residencePermitHits * 1.35) + (intent.score * 0.9)));
      score -= Math.min(45, Math.round(signals.passportHits * 0.3));
    }

    score = Math.max(0, Math.round(score));
    const directMatch =
      strongMatches.length > 0 ||
      intent.matchedStrong.length > 0 ||
      profile.matchedStrong.length > 0 ||
      (weakMatches.length > 0 && score >= 18);
    const hybridMatch =
      !directMatch &&
      score >= 18 &&
      domainScore >= 7 &&
      (weakMatches.length > 0 || focusMatches.length > 0 || bridgeMatches.length > 0 || intent.matchedWeak.length > 0 || profile.matchedMedium.length > 0);

    acc[groupId] = {
      groupId,
      label: group.label,
      score,
      included: score >= 18 && (directMatch || hybridMatch),
      matchType: directMatch ? "direct" : hybridMatch ? "hybrid" : "none",
      strongMatches,
      weakMatches,
      focusMatches,
      bridgeMatches,
      intent,
      profile,
    };
    return acc;
  }, {});
}

function classifyOverlap(assessments) {
  const included = Object.entries(assessments).filter(([, value]) => value.included);
  if (included.length <= 1) {
    return { classification: "", overlapReason: "" };
  }

  const ordered = included.slice().sort((left, right) => right[1].score - left[1].score);
  const [topId, top] = ordered[0];
  const [, second] = ordered[1];
  const topEvidence = [
    ...top.strongMatches,
    ...top.focusMatches,
    ...top.intent.matchedStrong,
    ...top.profile.matchedStrong,
  ];
  const combinedBridge = included.flatMap(([, value]) => value.bridgeMatches);

  if (top.score >= second.score + 80 && topEvidence.length >= 2) {
    if (topId === "passports") {
      return { classification: "Passport-heavy", overlapReason: topEvidence.slice(0, 6).join(", ") };
    }
    if (topId === "residence_permits") {
      return { classification: "Residence-heavy", overlapReason: topEvidence.slice(0, 6).join(", ") };
    }
    if (topId === "id_cards") {
      return { classification: "ID-card-heavy", overlapReason: topEvidence.slice(0, 6).join(", ") };
    }
  }

  if (combinedBridge.length > 0 || top.bridgeMatches.length > 0) {
    return {
      classification: "Legitimate overlap",
      overlapReason: Array.from(new Set([...combinedBridge, ...top.bridgeMatches])).slice(0, 6).join(", "),
    };
  }

  return {
    classification: "Ambiguous",
    overlapReason: Array.from(new Set(included.flatMap(([, value]) => value.focusMatches))).slice(0, 6).join(", "),
  };
}

function identifyRemovalCandidate(groupId, record) {
  const otherIncluded = Object.entries(record.assessments)
    .filter(([otherId, value]) => otherId !== groupId && value.included)
    .sort((left, right) => right[1].score - left[1].score);
  const own = record.assessments[groupId];
  const strongestOther = otherIncluded[0];

  if (!strongestOther) {
    return false;
  }

  const ownEvidence = own.strongMatches.length + own.focusMatches.length + own.intent.matchedStrong.length + own.profile.matchedStrong.length;
  const otherEvidence = strongestOther[1].strongMatches.length + strongestOther[1].focusMatches.length + strongestOther[1].intent.matchedStrong.length + strongestOther[1].profile.matchedStrong.length;

  return strongestOther[1].score >= own.score + 60 && otherEvidence >= ownEvidence + 1;
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
    application_name: "identity-core-overlap-diagnostics",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadArticles(client);
    const candidateArticles = articles.filter((article) => isIdentityCandidate(article));
    const records = [];

    candidateArticles.forEach((article) => {
      const assessments = computeAssessments(article);
      const includedGroups = Object.entries(assessments).filter(([, value]) => value.included);
      if (!includedGroups.length) {
        return;
      }

      const overlap = classifyOverlap(assessments);
      records.push({
        id: article.id,
        title: article.title || "",
        source: article.source || article.feedName || "",
        link: article.link || "",
        pubDate: article.pubDate,
        matchedSubgroups: includedGroups.map(([groupId]) => groupId),
        assessments,
        classification: overlap.classification,
        overlapReason: overlap.overlapReason,
      });
    });

    await client.query("COMMIT");

    console.log("\n=== Identity Core Overlap Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      identity_candidate_pool: candidateArticles.length,
      records_in_focus_groups: records.length,
      focus_groups: "Passports, ID Cards, Residence Permits",
    }]));

    const articleRows = records
      .slice()
      .sort((left, right) => {
        const overlapDiff = right.matchedSubgroups.length - left.matchedSubgroups.length;
        if (overlapDiff !== 0) {
          return overlapDiff;
        }
        const rightMax = Math.max(...Object.values(right.assessments).map((value) => value.score));
        const leftMax = Math.max(...Object.values(left.assessments).map((value) => value.score));
        return rightMax - leftMax;
      })
      .slice(0, 120)
      .map((record) => ({
        title: record.title,
        source: record.source,
        matched_subgroups: record.matchedSubgroups,
        match_type: record.matchedSubgroups.map((groupId) => `${groupId}:${record.assessments[groupId].matchType}`),
        passports_score: record.assessments.passports.score,
        id_cards_score: record.assessments.id_cards.score,
        residence_permits_score: record.assessments.residence_permits.score,
        overlap_classification: record.classification,
        overlap_reason: record.overlapReason,
        passport_triggers: [
          ...record.assessments.passports.strongMatches,
          ...record.assessments.passports.focusMatches,
          ...record.assessments.passports.intent.matchedStrong,
        ].slice(0, 6),
        id_card_triggers: [
          ...record.assessments.id_cards.strongMatches,
          ...record.assessments.id_cards.focusMatches,
        ].slice(0, 6),
        residence_triggers: [
          ...record.assessments.residence_permits.strongMatches,
          ...record.assessments.residence_permits.focusMatches,
          ...record.assessments.residence_permits.intent.matchedStrong,
        ].slice(0, 6),
      }));

    console.log("\n=== Per-article overlap report ===");
    console.table(formatRows(articleRows));

    const overlapKeywords = new Map();
    const overlapPatterns = new Map();
    const falsePositiveCauses = new Map();

    records.forEach((record) => {
      const pattern = record.matchedSubgroups.slice().sort().join("+");
      overlapPatterns.set(pattern, (overlapPatterns.get(pattern) || 0) + 1);

      record.matchedSubgroups.forEach((groupId) => {
        const assessment = record.assessments[groupId];
        [
          ...assessment.strongMatches,
          ...assessment.focusMatches,
          ...assessment.bridgeMatches,
          ...assessment.intent.matchedStrong,
          ...assessment.intent.matchedWeak,
        ].forEach((keyword) => {
          overlapKeywords.set(keyword, (overlapKeywords.get(keyword) || 0) + 1);
        });
      });

      record.matchedSubgroups.forEach((groupId) => {
        if (identifyRemovalCandidate(groupId, record)) {
          const strongestOther = Object.entries(record.assessments)
            .filter(([otherId, value]) => otherId !== groupId && value.included)
            .sort((left, right) => right[1].score - left[1].score)[0];
          const cause = strongestOther ? `${groupId}->${strongestOther[0]}` : `${groupId}->other`;
          falsePositiveCauses.set(cause, (falsePositiveCauses.get(cause) || 0) + 1);
        }
      });
    });

    const removalCandidates = Object.keys(FOCUS_GROUPS).reduce((acc, groupId) => {
      acc[groupId] = records
        .filter((record) => record.assessments[groupId].included && identifyRemovalCandidate(groupId, record))
        .sort((left, right) => {
          const rightBestOther = Math.max(...Object.entries(right.assessments).filter(([id]) => id !== groupId).map(([, value]) => value.score));
          const leftBestOther = Math.max(...Object.entries(left.assessments).filter(([id]) => id !== groupId).map(([, value]) => value.score));
          return (rightBestOther - right.assessments[groupId].score) - (leftBestOther - left.assessments[groupId].score);
        })
        .slice(0, 20)
        .map((record) => {
          const strongestOther = Object.entries(record.assessments)
            .filter(([otherId, value]) => otherId !== groupId && value.included)
            .sort((left, right) => right[1].score - left[1].score)[0];
          return {
            title: record.title,
            source: record.source,
            current_group: groupId,
            likely_better_group: strongestOther?.[0] || "",
            current_score: record.assessments[groupId].score,
            better_group_score: strongestOther?.[1]?.score || 0,
            reason: record.classification || record.overlapReason,
          };
        });
      return acc;
    }, {});

    console.log("\n=== Summary ===");
    console.table(formatRows([{
      total_passport_records: records.filter((record) => record.assessments.passports.included).length,
      total_id_card_records: records.filter((record) => record.assessments.id_cards.included).length,
      total_residence_records: records.filter((record) => record.assessments.residence_permits.included).length,
      records_with_overlap: records.filter((record) => record.matchedSubgroups.length > 1).length,
      legitimate_overlap: records.filter((record) => record.classification === "Legitimate overlap").length,
      passport_heavy: records.filter((record) => record.classification === "Passport-heavy").length,
      residence_heavy: records.filter((record) => record.classification === "Residence-heavy").length,
      id_card_heavy: records.filter((record) => record.classification === "ID-card-heavy").length,
      ambiguous: records.filter((record) => record.classification === "Ambiguous").length,
    }]));

    console.log("\n=== Top overlap keywords ===");
    console.table(formatRows(
      Array.from(overlapKeywords.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 20)
        .map(([keyword, count]) => ({ keyword, count }))
    ));

    console.log("\n=== Top overlap patterns ===");
    console.table(formatRows(
      Array.from(overlapPatterns.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 20)
        .map(([pattern, count]) => ({ pattern, count }))
    ));

    console.log("\n=== Most common false positive causes ===");
    console.table(formatRows(
      Array.from(falsePositiveCauses.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 20)
        .map(([cause, count]) => ({ cause, count }))
    ));

    console.log("\n=== Remove from ID Cards ===");
    console.table(formatRows(removalCandidates.id_cards));

    console.log("\n=== Remove from Residence Permits ===");
    console.table(formatRows(removalCandidates.residence_permits));

    console.log("\n=== Remove from Passports ===");
    console.table(formatRows(removalCandidates.passports));

    const removalCounts = {
      passports: removalCandidates.passports.length,
      id_cards: removalCandidates.id_cards.length,
      residence_permits: removalCandidates.residence_permits.length,
    };
    const recommendation = Object.entries(removalCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || "";
    const recommendationLabel =
      recommendation === "id_cards"
        ? "A) tighten ID Cards"
        : recommendation === "residence_permits"
          ? "B) tighten Residence Permits"
          : recommendation === "passports"
            ? "C) tighten Passports"
            : "D) leave current behavior unchanged";

    console.log("\n=== Recommendation ===");
    console.table(formatRows([{
      recommendation: recommendationLabel,
      why: recommendation
        ? `${recommendation} has the largest removal-candidate set in this focused overlap report`
        : "no dominant removal pattern found",
    }]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors during diagnostics.
    }
    console.error("Failed to run identity core overlap diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
