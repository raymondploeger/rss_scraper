import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const groups = ["Vendors", "all"];
const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];

async function waitForSettled(page) {
  await page.waitForFunction(() => {
    const count = document.querySelector("#results-count")?.textContent || "";
    return count && !/loading/i.test(count);
  }, null, { timeout: 90000 });
  let previous = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await page.evaluate(() => JSON.stringify({
      count: document.querySelector("#results-count")?.textContent || "",
      heading: document.querySelector("#intelligence-feed-title")?.textContent || "",
      runId: window.getLatestFilterPerformanceDiagnostics?.()?.runId || "",
    }));
    if (current === previous) return;
    previous = current;
    await page.waitForTimeout(250);
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("debugFilterPerformance", "1");
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="central_bank"]', { state: "attached", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-source-group]").length >= 5, null, { timeout: 30000 });
  await waitForSettled(page);
  const profiles = await page.locator("[data-profile-template]").evaluateAll((nodes) => nodes.map((node) => ({
    id: node.dataset.profileTemplate,
    label: node.querySelector(".personal-dashboard-template-option-copy > span")?.textContent?.trim()
      || node.textContent?.trim() || "",
  })));

  for (const group of groups) {
    await page.locator(`[data-source-group="${group}"]`).evaluate((element) => element.click());
    await waitForSettled(page);
    for (const profile of profiles) {
      await page.locator("#personal-dashboard-clear").evaluate((element) => element.click());
      await waitForSettled(page);
      const previousRunId = await page.evaluate(() => window.getLatestFilterPerformanceDiagnostics?.()?.runId || "");
      await page.locator(`[data-profile-template="${profile.id}"]`).evaluate((element) => element.click());
      await page.waitForFunction((oldRunId) => {
        const run = window.getLatestFilterPerformanceDiagnostics?.();
        return run?.runId && run.runId !== oldRunId &&
          (document.querySelector("#intelligence-feed-title")?.textContent || "").includes("·");
      }, previousRunId, { timeout: 90000 });
      await waitForSettled(page);
      const snapshot = await page.evaluate(() => ({
        count: Number.parseInt(document.querySelector("#results-count")?.textContent || "0", 10) || 0,
        heading: document.querySelector("#intelligence-feed-title")?.textContent?.trim() || "",
        run: window.getLatestFilterPerformanceDiagnostics?.() || null,
      }));
      const routeSummary = snapshot.run?.profilePolicyRouteSummary?.[profile.id] || null;
      if (!routeSummary || routeSummary.assessed === 0) {
        failures.push({ profile: profile.id, group, failure: "No profile-route assessments recorded" });
      }
      if (!snapshot.heading.includes(profile.label)) {
        failures.push({ profile: profile.id, group, failure: "Wrong profile heading", heading: snapshot.heading });
      }
      results.push({
        profile: profile.id,
        group,
        visibleCount: snapshot.count,
        candidateCount: snapshot.run?.candidateCount || 0,
        routes: routeSummary,
      });
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify({ appUrl, cases: results.length, failures, results }, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
