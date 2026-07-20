import { chromium } from "playwright";
import fs from "node:fs";

const DEFAULT_URL = "https://rssscraper-production.up.railway.app/";
const DEFAULT_INTERESTS = ["identity_verification", "biometric_verification"];
const DEFAULT_TIMEOUT_MS = 180000;
const CHROME_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function parseArgs(argv) {
  const options = {
    url: process.env.PERF_URL || DEFAULT_URL,
    interests: DEFAULT_INTERESTS,
    output: process.env.PERF_OUTPUT || "",
    headed: process.env.PERF_HEADED === "1",
    timeoutMs: Number(process.env.PERF_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };

  for (const arg of argv) {
    if (arg.startsWith("--url=")) {
      options.url = arg.slice("--url=".length);
    } else if (arg.startsWith("--interests=")) {
      options.interests = arg.slice("--interests=".length)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else if (arg === "--headed") {
      options.headed = true;
    }
  }

  return options;
}

function getChromeExecutablePath() {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function compactPerformanceRun(run) {
  if (!run) {
    return null;
  }

  return {
    runId: run.runId,
    renderReason: run.renderReason,
    candidateCount: run.candidateCount,
    backendRequestCount: run.backendRequestCount,
    backendResultNormalizationMs: run.backendResultNormalizationMs,
    candidatePreparationMs: run.candidatePreparationMs,
    personalDashboardMs: run.personalDashboardMs,
    digitalIdentityProfessionalGuardMs: run.digitalIdentityProfessionalGuardMs,
    diagnosticsMs: run.diagnosticsMs,
    sortingMs: run.sortingMs,
    groupingMs: run.groupingMs,
    totalPipelineMs: run.totalPipelineMs,
    totalUserVisibleMs: run.totalUserVisibleMs,
    articlesAfterPersonalDashboard: run.articlesAfterPersonalDashboard,
    articlesAfterDigitalIdentityGuard: run.articlesAfterDigitalIdentityGuard,
    groupedCount: run.groupedCount,
    renderedCount: run.renderedCount,
    slowestStage: run.slowestStage,
    evidenceBuilderPerformanceGuardSummary: run.evidenceBuilderPerformanceGuardSummary,
    functionTimingProfilerSummary: run.functionTimingProfilerSummary,
    articleContextRequestAttribution: run.articleContextRequestAttribution,
    professionalGuardRunLocalReuseSummary: run.professionalGuardRunLocalReuseSummary,
  };
}

async function waitForPipelineRun(page, timeoutMs) {
  const startedAt = Date.now();
  let latest = null;
  while (Date.now() - startedAt < timeoutMs) {
    latest = await page.evaluate(() => window.getLatestFilterPerformanceDiagnostics?.() || null);
    if (latest?.totalPipelineMs != null && Number(latest?.candidateCount || 0) > 0) {
      return latest;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Timed out waiting for performance diagnostics. Last run: ${JSON.stringify(latest)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({
    executablePath: getChromeExecutablePath(),
    headless: !options.headed,
  });

  try {
    const page = await browser.newPage();
    await page.addInitScript((interests) => {
      window.localStorage.setItem("debugFilterPerformance", "1");
      window.localStorage.setItem("debugFilterPipeline", "1");
      window.localStorage.removeItem("debugFilterPipelineLimit");
      window.localStorage.setItem("personalDashboardInterests", JSON.stringify(interests));
    }, options.interests);

    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: options.timeoutMs }).catch(() => {});
    await page.locator("#personal-dashboard").waitFor({ timeout: 30000 });

    const latestRun = await waitForPipelineRun(page, options.timeoutMs);
    await page.waitForTimeout(1500);
    const finalRun = await page.evaluate(() => window.getLatestFilterPerformanceDiagnostics?.() || null);
    const pipelineDiagnostics = await page.evaluate(() => window.exportLatestFilterPipelineDiagnostics?.() || null);
    const performanceExport = await page.evaluate(() => window.exportFilterPerformanceDiagnostics?.() || null);
    const timingsByInclusive = await page.evaluate(() => window.listFilterFunctionTimingsByInclusive?.(20) || []);
    const rejectionReasons = await page.evaluate(() => window.listRejectionReasons?.(20) || []);
    const survivingArticles = await page.evaluate(() => window.listSurvivingArticles?.(10) || []);

    const report = {
      url: options.url,
      selectedInterests: options.interests,
      capturedAt: new Date().toISOString(),
      latestRun: compactPerformanceRun(finalRun || latestRun),
      timingsByInclusive,
      rejectionReasons,
      survivingArticleExamples: survivingArticles,
      pipelineSummary: pipelineDiagnostics
        ? {
            candidateCount: pipelineDiagnostics.candidateCount,
            groupedCount: pipelineDiagnostics.groupedCount,
            renderedCount: pipelineDiagnostics.renderedCount,
            filterPipelineStages: pipelineDiagnostics.filterPipelineStages,
            filterDecisionTraceSummary: pipelineDiagnostics.filterDecisionTraceSummary,
            frontendPerformanceDiagnostics: pipelineDiagnostics.frontendPerformanceDiagnostics,
          }
        : null,
      performanceExport,
    };

    if (options.output) {
      fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    }

    console.log(JSON.stringify({
      url: report.url,
      selectedInterests: report.selectedInterests,
      latestRun: report.latestRun,
      topTimings: timingsByInclusive.slice(0, 10),
      topRejectionReasons: rejectionReasons.slice(0, 10),
      output: options.output || null,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
