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
const articleLimit = Math.max(1000, Math.min(12000, Number(limitArg ? limitArg.split("=")[1] : 8000) || 8000));

const CURRENT_TOP_LEVEL_STRONG = [
  "security printing",
  "security inks",
  "micro optics",
  "holography",
  "ovd",
  "intaglio",
  "anti-counterfeit",
  "secure documents",
  "personalization",
];

const CURRENT_TOP_LEVEL_WEAK = [
  "document security",
  "secure print",
  "specialty ink",
];

const CURRENT_TOP_LEVEL_EXCLUDED = [
  "wallet onboarding",
  "digital identity platform",
];

const EXPECTED_TRIGGERS = [
  "hologram",
  "holography",
  "ovd",
  "optically variable device",
  "micro optics",
  "microlens",
  "nano optics",
  "security feature",
  "security thread",
  "banknote security",
  "document security",
  "anti-counterfeit",
  "authentication feature",
  "security ink",
  "uv ink",
  "optically variable ink",
  "intaglio",
  "tactile printing",
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

function getTopLevelAssessment(article) {
  const context = buildContext(article);
  const strongTitleHits = countMatches(context.titleText, CURRENT_TOP_LEVEL_STRONG);
  const strongTagHits = countMatches(context.tagText, CURRENT_TOP_LEVEL_STRONG);
  const strongMetaHits = countMatches(context.metadataText, CURRENT_TOP_LEVEL_STRONG);
  const strongBodyHits = countMatches(context.bodyText, CURRENT_TOP_LEVEL_STRONG);
  const weakTitleHits = countMatches(context.titleText, CURRENT_TOP_LEVEL_WEAK);
  const weakTagHits = countMatches(context.tagText, CURRENT_TOP_LEVEL_WEAK);
  const weakMetaHits = countMatches(context.metadataText, CURRENT_TOP_LEVEL_WEAK);
  const weakBodyHits = countMatches(context.bodyText, CURRENT_TOP_LEVEL_WEAK);
  const excludedHits =
    countMatches(context.titleText, CURRENT_TOP_LEVEL_EXCLUDED) +
    countMatches(context.tagText, CURRENT_TOP_LEVEL_EXCLUDED) +
    countMatches(context.metadataText, CURRENT_TOP_LEVEL_EXCLUDED);

  let score =
    (strongTitleHits * 5) +
    (strongTagHits * 4) +
    (strongMetaHits * 3.5) +
    (strongBodyHits * 1.25) +
    (weakTitleHits * 2) +
    (weakTagHits * 1.5) +
    (weakMetaHits * 1.25) +
    (weakBodyHits * 0.35);

  if (context.topic === "banknotes" || context.topic === "identity documents") {
    score += 4;
  }
  score -= excludedHits * 10;

  const currentMatched = [
    ...matchedKeywords(context.titleText, CURRENT_TOP_LEVEL_STRONG),
    ...matchedKeywords(context.tagText, CURRENT_TOP_LEVEL_STRONG),
    ...matchedKeywords(context.metadataText, CURRENT_TOP_LEVEL_STRONG),
    ...matchedKeywords(context.bodyText, CURRENT_TOP_LEVEL_STRONG),
    ...matchedKeywords(context.titleText, CURRENT_TOP_LEVEL_WEAK),
    ...matchedKeywords(context.tagText, CURRENT_TOP_LEVEL_WEAK),
    ...matchedKeywords(context.metadataText, CURRENT_TOP_LEVEL_WEAK),
    ...matchedKeywords(context.bodyText, CURRENT_TOP_LEVEL_WEAK),
  ];

  const expectedMatched = matchedKeywords(
    `${context.titleText} ${context.tagText} ${context.metadataText} ${context.bodyText}`,
    EXPECTED_TRIGGERS
  );

  return {
    score: Math.round(score),
    currentMatched: Array.from(new Set(currentMatched)),
    expectedMatched,
    context,
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
    application_name: "security-printing-top-level-diagnostics",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");

    const articles = await loadArticles(client);
    const currentTriggerCounts = new Map();
    const expectedTriggerCounts = new Map();
    const candidatePool = [];
    const expectedOnlyPool = [];

    articles.forEach((article) => {
      const assessment = getTopLevelAssessment(article);

      assessment.currentMatched.forEach((keyword) => {
        currentTriggerCounts.set(keyword, (currentTriggerCounts.get(keyword) || 0) + 1);
      });
      assessment.expectedMatched.forEach((keyword) => {
        expectedTriggerCounts.set(keyword, (expectedTriggerCounts.get(keyword) || 0) + 1);
      });

      if (assessment.score >= 7) {
        candidatePool.push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          link: article.link || "",
          score: assessment.score,
          currentMatched: assessment.currentMatched,
          expectedMatched: assessment.expectedMatched,
        });
      } else if (assessment.expectedMatched.length > 0) {
        expectedOnlyPool.push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          link: article.link || "",
          score: assessment.score,
          currentMatched: assessment.currentMatched,
          expectedMatched: assessment.expectedMatched,
        });
      }
    });

    await client.query("COMMIT");

    const expectedMissing = EXPECTED_TRIGGERS
      .filter((keyword) => !CURRENT_TOP_LEVEL_STRONG.includes(keyword) && !CURRENT_TOP_LEVEL_WEAK.includes(keyword))
      .map((keyword) => ({
        expected_trigger: keyword,
        article_count: expectedTriggerCounts.get(keyword) || 0,
        currently_contributing: false,
      }));

    console.log("\n=== Shared Security Printing Top-level Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      security_candidate_pool: candidatePool.length,
      expected_only_matches: expectedOnlyPool.length,
      current_threshold: "score >= 7",
    }]));

    console.log("\n=== Current top-level triggers ===");
    console.table(formatRows(
      [...new Set([...CURRENT_TOP_LEVEL_STRONG, ...CURRENT_TOP_LEVEL_WEAK])].map((keyword) => ({
        trigger: keyword,
        article_count: currentTriggerCounts.get(keyword) || 0,
        trigger_type: CURRENT_TOP_LEVEL_STRONG.includes(keyword) ? "strong" : "weak",
      }))
    ));

    console.log("\n=== Expected triggers not currently contributing ===");
    console.table(formatRows(
      expectedMissing
        .sort((left, right) => right.article_count - left.article_count)
    ));

    console.log("\n=== Current trigger coverage summary ===");
    console.table(formatRows([{
      current_strong_trigger_count: CURRENT_TOP_LEVEL_STRONG.length,
      current_weak_trigger_count: CURRENT_TOP_LEVEL_WEAK.length,
      expected_trigger_count: EXPECTED_TRIGGERS.length,
      expected_not_in_current_count: expectedMissing.filter((row) => row.article_count > 0).length,
    }]));

    console.log("\n=== Missed article examples ===");
    console.table(formatRows(
      expectedOnlyPool
        .slice()
        .sort((left, right) => {
          if (right.expectedMatched.length !== left.expectedMatched.length) {
            return right.expectedMatched.length - left.expectedMatched.length;
          }
          return right.score - left.score;
        })
        .slice(0, 40)
        .map((row) => ({
          title: row.title,
          source: row.source,
          top_level_score: row.score,
          expected_triggers: row.expectedMatched,
          current_triggers: row.currentMatched,
          link: row.link,
        }))
    ));

    console.log("\n=== Candidate pool examples ===");
    console.table(formatRows(
      candidatePool
        .slice()
        .sort((left, right) => right.score - left.score)
        .slice(0, 20)
        .map((row) => ({
          title: row.title,
          source: row.source,
          top_level_score: row.score,
          current_triggers: row.currentMatched,
          expected_triggers: row.expectedMatched,
        }))
    ));

    const recommendation =
      expectedMissing.some((row) => row.article_count > 0) && expectedOnlyPool.length > 0
        ? "C) both"
        : expectedMissing.some((row) => row.article_count > 0)
          ? "B) fix missing keywords"
          : "A) broaden top-level detection";

    console.log("\n=== Recommendation ===");
    console.table(formatRows([{
      recommendation,
      why: recommendation === "C) both"
        ? "the top-level trigger set is both too narrow and missing several expected security-printing keywords that appear in the database"
        : recommendation === "B) fix missing keywords"
          ? "expected security-printing concepts appear in the database but are absent from the current top-level trigger set"
          : "current keywords exist, but the top-level gate is still too narrow to gather the intended pool",
    }]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors during diagnostics.
    }
    console.error("Failed to run Shared Security Printing top-level diagnostics.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
