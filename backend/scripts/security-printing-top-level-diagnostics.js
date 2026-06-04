import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  getSecurityPrintingProductionLikeAssessment,
  SECURITY_PRINTING_DOMAIN_CONTEXT,
  SECURITY_PRINTING_TOP_LEVEL_MEDIUM_SIGNALS,
  SECURITY_PRINTING_TOP_LEVEL_STRONG_SIGNALS,
  textMatchesKeyword,
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
const articleLimit = Math.max(1000, Math.min(12000, Number(limitArg ? limitArg.split("=")[1] : 8000) || 8000));

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
    const candidatePoolBefore = [];
    const candidatePoolAfter = [];
    const newlyCaptured = [];
    const expectedOnlyPool = [];

    articles.forEach((article) => {
      const assessment = getSecurityPrintingProductionLikeAssessment(article);
      const expectedMatched = EXPECTED_TRIGGERS.filter((keyword) => {
        const haystack = [
          assessment.context.titleText,
          assessment.context.tagText,
          assessment.context.metadataText,
          assessment.context.bodyText,
        ]
          .filter(Boolean)
          .join(" ");
        return textMatchesKeyword(haystack, keyword);
      });

      assessment.currentMatched.forEach((keyword) => {
        currentTriggerCounts.set(keyword, (currentTriggerCounts.get(keyword) || 0) + 1);
      });
      expectedMatched.forEach((keyword) => {
        expectedTriggerCounts.set(keyword, (expectedTriggerCounts.get(keyword) || 0) + 1);
      });

      if (assessment.includedLegacy) {
        candidatePoolBefore.push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          link: article.link || "",
          score: assessment.legacyScore,
          currentMatched: assessment.currentMatched,
          expectedMatched,
        });
      }

      if (assessment.includedProduction) {
        candidatePoolAfter.push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          link: article.link || "",
          score: assessment.productionScore,
          currentMatched: assessment.productionMatched,
          expectedMatched,
        });
      }

      if (!assessment.includedLegacy && assessment.includedProduction) {
        newlyCaptured.push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          link: article.link || "",
          score_before: assessment.legacyScore,
          score_after: assessment.productionScore,
          current_triggers: assessment.currentMatched,
          new_signals: [
            ...assessment.adjustment.matchedStrongSignals,
            ...assessment.adjustment.matchedMediumSignals,
          ],
          support_terms: assessment.adjustment.matchedSupportTerms,
        });
      } else if (expectedMatched.length > 0 && !assessment.includedProduction) {
        expectedOnlyPool.push({
          id: article.id,
          title: article.title || "",
          source: article.source || article.feedName || "",
          link: article.link || "",
          score: assessment.legacyScore,
          currentMatched: assessment.currentMatched,
          expectedMatched,
        });
      }
    });

    await client.query("COMMIT");

    const expectedMissing = EXPECTED_TRIGGERS
      .filter((keyword) => !SECURITY_PRINTING_DOMAIN_CONTEXT.strong.includes(keyword) && !SECURITY_PRINTING_DOMAIN_CONTEXT.weak.includes(keyword))
      .map((keyword) => ({
        expected_trigger: keyword,
        article_count: expectedTriggerCounts.get(keyword) || 0,
        currently_contributing: false,
      }));

    console.log("\n=== Shared Security Printing Top-level Diagnostics ===");
    console.table(formatRows([{
      scanned_articles: articles.length,
      estimated_candidate_pool_before: candidatePoolBefore.length,
      estimated_candidate_pool_after: candidatePoolAfter.length,
      newly_captured_articles: newlyCaptured.length,
      expected_only_matches: expectedOnlyPool.length,
      current_threshold: "score >= 7",
    }]));

    console.log("\n=== Current top-level triggers ===");
    console.table(formatRows(
      [...new Set([...SECURITY_PRINTING_DOMAIN_CONTEXT.strong, ...SECURITY_PRINTING_DOMAIN_CONTEXT.weak])].map((keyword) => ({
        trigger: keyword,
        article_count: currentTriggerCounts.get(keyword) || 0,
        trigger_type: SECURITY_PRINTING_DOMAIN_CONTEXT.strong.includes(keyword) ? "strong" : "weak",
      }))
    ));

    console.log("\n=== Expected triggers not currently contributing ===");
    console.table(formatRows(
      expectedMissing
        .sort((left, right) => right.article_count - left.article_count)
    ));

    console.log("\n=== Current trigger coverage summary ===");
    console.table(formatRows([{
      current_strong_trigger_count: SECURITY_PRINTING_DOMAIN_CONTEXT.strong.length,
      current_weak_trigger_count: SECURITY_PRINTING_DOMAIN_CONTEXT.weak.length,
      production_top_level_strong_signals: SECURITY_PRINTING_TOP_LEVEL_STRONG_SIGNALS.length,
      production_top_level_medium_signals: SECURITY_PRINTING_TOP_LEVEL_MEDIUM_SIGNALS.length,
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

    console.log("\n=== Newly captured article examples ===");
    console.table(formatRows(
      newlyCaptured
        .slice()
        .sort((left, right) => right.score_after - left.score_after)
        .slice(0, 25)
        .map((row) => ({
          title: row.title,
          source: row.source,
          top_level_score_before: row.score_before,
          top_level_score_after: row.score_after,
          new_signals: row.new_signals,
          support_terms: row.support_terms,
          current_triggers: row.current_triggers,
          link: row.link,
        }))
    ));

    console.log("\n=== Candidate pool examples after change ===");
    console.table(formatRows(
      candidatePoolAfter
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
