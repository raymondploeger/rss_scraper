import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function clickAndSettle(selector) {
  const previousRunId = await page.evaluate(() => window.getLatestFilterPerformanceDiagnostics?.()?.runId || "");
  await page.locator(selector).evaluate((element) => element.click());
  await page.waitForFunction((oldRunId) => {
    const count = document.querySelector("#results-count")?.textContent || "";
    const run = window.getLatestFilterPerformanceDiagnostics?.();
    return Number.parseInt(count, 10) > 0 && run?.runId && run.runId !== oldRunId &&
      run?.profilePolicyRouteSummary?.central_bank?.assessed > 0;
  }, previousRunId, { timeout: 90000 });
  await page.waitForTimeout(800);
}

function snapshot() {
  return page.evaluate(() => ({
    count: Number.parseInt(document.querySelector("#results-count")?.textContent || "0", 10),
    heading: document.querySelector("#intelligence-feed-title")?.textContent?.trim(),
    summary: document.querySelector("#intelligence-feed-summary")?.textContent?.trim(),
    allPressed: document.querySelector('[data-source-group="all"]')?.getAttribute("aria-pressed"),
    resetButtons: document.querySelectorAll("[data-source-scope-reset]").length,
    routes: window.getLatestFilterPerformanceDiagnostics?.()?.profilePolicyRouteSummary?.central_bank || null,
  }));
}

try {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("debugFilterPerformance", "1");
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="central_bank"]', { state: "attached", timeout: 30000 });
  await page.waitForFunction(() => {
    const run = window.getLatestFilterPerformanceDiagnostics?.();
    return run?.candidateCount > 0 && !run?.loading;
  }, null, { timeout: 90000 });
  await clickAndSettle('[data-profile-template="central_bank"]');
  const initial = await snapshot();
  await clickAndSettle('[data-source-group="Vendors"]');
  const vendors = await snapshot();
  await clickAndSettle('[data-source-group="all"]');
  const returned = await snapshot();

  if (initial.resetButtons !== 0 || initial.allPressed !== "true" ||
      initial.count !== returned.count || returned.allPressed !== "true" ||
      !returned.summary.includes("across all sources") ||
      vendors.count > returned.count ||
      returned.routes?.fallbackPass !== 0 || returned.routes?.fallbackReject !== 0) {
    throw new Error(`All-source UX mismatch: ${JSON.stringify({ initial, vendors, returned })}`);
  }
  console.log(JSON.stringify({ initial, vendors, returned }, null, 2));
} finally {
  await browser.close();
}
