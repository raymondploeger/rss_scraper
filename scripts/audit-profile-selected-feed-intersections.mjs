import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const cases = [
  { profileId: "central_bank", profileLabel: "Central Bank", feedName: "Bank of Canada News", expectMatch: true },
  { profileId: "passport_authority", profileLabel: "Identity Document Authority", feedName: "IRCC Passport and Digital Identity News", expectMatch: true },
  { profileId: "passport_authority", profileLabel: "Identity Document Authority", feedName: "AAMVA News", expectMatch: true, expectNarrowing: true },
  { profileId: "identity_verification", profileLabel: "Identity Verification", feedName: "OpenID Foundation News", expectMatch: true },
  { profileId: "border_control", profileLabel: "Border Control", feedName: "Frontex Newsroom", expectMatch: true, expectNarrowing: true },
];

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
      titles: Array.from(document.querySelectorAll(".article-card h3"))
        .map((node) => node.textContent?.trim()),
    }));
    if (current === previous) return;
    previous = current;
    await page.waitForTimeout(250);
  }
}

async function snapshot(page) {
  return page.evaluate(() => ({
    count: Number.parseInt(document.querySelector("#results-count")?.textContent || "0", 10) || 0,
    heading: document.querySelector("#intelligence-feed-title")?.textContent?.trim() || "",
    summary: document.querySelector("#intelligence-feed-summary")?.textContent?.trim() || "",
    titles: Array.from(document.querySelectorAll(".article-card h3"))
      .map((node) => node.textContent?.trim() || ""),
  }));
}

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const { profileId, profileLabel, feedName, expectMatch, expectNarrowing } of cases) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(`[data-profile-template="${profileId}"]`, {
      state: "attached",
      timeout: 30000,
    });
    await page.locator("#feed-panel-toggle").evaluate((element) => element.click());
    await page.locator("#feed-panel-search").waitFor({ state: "visible", timeout: 30000 });
    await page.locator("#feed-panel-search").fill(feedName);
    await page.waitForTimeout(250);

    const feedItem = page.locator(".feed-item").filter({ hasText: feedName }).first();
    await feedItem.waitFor({ state: "visible", timeout: 30000 });
    await feedItem.locator(".feed-view-button").evaluate((element) => element.click());
    await waitForSettled(page);
    const sourceOnly = await snapshot(page);

    await page.locator(`[data-profile-template="${profileId}"]`).evaluate((element) => element.click());
    await waitForSettled(page);
    const combined = await snapshot(page);
    results.push({ profileId, profileLabel, feedName, expectMatch, expectNarrowing, sourceOnly, combined });
    await context.close();
  }
} finally {
  await browser.close();
}

const failures = results.filter(({ profileLabel, feedName, expectMatch, expectNarrowing, sourceOnly, combined }) => (
  combined.count > sourceOnly.count
  || (expectMatch && combined.count === 0)
  || (expectNarrowing && combined.count >= sourceOnly.count)
  || !combined.heading.includes(profileLabel)
  || !combined.heading.includes(feedName)
  || !combined.summary.includes("matched your profile within selected sources")
));

process.stdout.write(`${JSON.stringify({
  appUrl,
  cases: results.length,
  failures,
  results,
}, null, 2)}\n`);

if (failures.length) process.exitCode = 1;
