import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("debugFilterPerformance", "1");
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="researcher"]', { state: "attached", timeout: 30000 });
  const previousRunId = await page.evaluate(() => window.getLatestFilterPerformanceDiagnostics?.()?.runId || "");
  await page.locator('[data-profile-template="researcher"]').evaluate((element) => element.click());
  await page.waitForFunction((oldRunId) => {
    const run = window.getLatestFilterPerformanceDiagnostics?.();
    return run?.runId !== oldRunId && run?.profilePolicyRouteSummary?.researcher?.assessed > 0 &&
      Number.parseInt(document.querySelector("#results-count")?.textContent || "0", 10) > 0;
  }, previousRunId, { timeout: 90000 });
  const snapshot = await page.evaluate(() => ({
    count: Number.parseInt(document.querySelector("#results-count")?.textContent || "0", 10) || 0,
    heading: document.querySelector("#intelligence-feed-title")?.textContent?.trim() || "",
    routes: window.getLatestFilterPerformanceDiagnostics?.()?.profilePolicyRouteSummary?.researcher || null,
  }));
  if (!snapshot.heading.includes("Industry Research") || !snapshot.routes ||
      snapshot.routes.sharedSecurityRefinementPolicyPass === 0 ||
      snapshot.routes.fallbackPass !== 0 || snapshot.routes.fallbackReject !== 0 ||
      snapshot.routes.identityDocumentQualityPolicyReject === 0) {
    throw new Error(`Researcher policy route audit failed: ${JSON.stringify(snapshot)}`);
  }
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} finally {
  await browser.close();
}
