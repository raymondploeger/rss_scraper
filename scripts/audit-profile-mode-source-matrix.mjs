import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const modes = ["focused", "balanced", "broad"];
const selectedFeeds = ["IRCC Passport and Digital Identity News", "AAMVA News"];

async function clickDom(page, selector) {
  await page.locator(selector).evaluate((element) => element.click());
  await page.waitForTimeout(500);
}

async function waitForSettled(page) {
  await page.waitForFunction(() => {
    const value = document.querySelector("#results-count")?.textContent || "";
    return value && !/loading/i.test(value);
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
    mode: Array.from(document.querySelectorAll("#intelligence-feed-context .intelligence-context-chip"))
      .map((node) => node.textContent?.trim() || "")
      .find((label) => label.startsWith("Profile strictness:")) || "",
    titles: Array.from(document.querySelectorAll(".article-card h3"))
      .map((node) => node.textContent?.trim() || ""),
  }));
}

function checkModeSequence(scope, sourceOnly, byMode, failures) {
  for (const mode of modes) {
    const result = byMode[mode];
    if (!result || result.count > sourceOnly.count || !result.heading.includes("Identity Document Authority")) {
      failures.push({ scope, mode, failure: "Profile result exceeds source scope or has the wrong heading" });
    }
    const expectedLabel = mode === "broad" ? "Research mode" : mode[0].toUpperCase() + mode.slice(1);
    if (result?.mode !== `Profile strictness: ${expectedLabel}`) {
      failures.push({ scope, mode, failure: "Incorrect mode label", actual: result?.mode });
    }
  }
  for (let index = 0; index < modes.length - 1; index += 1) {
    const narrower = byMode[modes[index]];
    const broader = byMode[modes[index + 1]];
    if (narrower.count > broader.count) {
      failures.push({ scope, failure: `${modes[index]} has more results than ${modes[index + 1]}` });
    }
    if (narrower.count === narrower.titles.length && broader.count === broader.titles.length) {
      const missingTitles = narrower.titles.filter((title) => !broader.titles.includes(title));
      if (missingTitles.length) {
        failures.push({ scope, failure: "Broader mode omits articles from narrower mode", missingTitles });
      }
    }
  }
}

const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="passport_authority"]', { state: "attached", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-source-group]").length >= 5, null, { timeout: 30000 });
  await waitForSettled(page);
  const groups = await page.locator("[data-source-group]").evaluateAll((nodes) => nodes.map((node) => ({
    id: node.dataset.sourceGroup,
    label: node.textContent?.trim() || "",
  })));

  for (const group of groups) {
    await clickDom(page, "#personal-dashboard-clear");
    await waitForSettled(page);
    await clickDom(page, `[data-source-group="${group.id}"]`);
    await waitForSettled(page);
    const sourceOnly = await snapshot(page);
    await clickDom(page, '[data-profile-template="passport_authority"]');
    await waitForSettled(page);
    const byMode = {};
    for (const mode of modes) {
      await clickDom(page, `[data-identity-document-authority-strictness="${mode}"]`);
      await waitForSettled(page);
      byMode[mode] = await snapshot(page);
    }
    checkModeSequence(group.label, sourceOnly, byMode, failures);
    results.push({ scope: group.label, sourceOnly: sourceOnly.count, modes: Object.fromEntries(modes.map((mode) => [mode, byMode[mode].count])) });
    group.byMode = byMode;
  }

  const allGroup = groups.find((group) => group.id === "all");
  for (const group of groups.filter((entry) => entry.id !== "all")) {
    for (const mode of modes) {
      const allResult = allGroup?.byMode?.[mode];
      const scopedResult = group.byMode[mode];
      if (!allResult || allResult.count < scopedResult.count) {
        failures.push({ scope: group.label, mode, failure: "All has fewer results than this source group" });
      }
      if (allResult && allResult.count === allResult.titles.length && scopedResult.count === scopedResult.titles.length) {
        const missingTitles = scopedResult.titles.filter((title) => !allResult.titles.includes(title));
        if (missingTitles.length) failures.push({ scope: group.label, mode, failure: "All omits source-group articles", missingTitles });
      }
    }
  }
  await context.close();

  for (const feedName of selectedFeeds) {
    const feedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const feedPage = await feedContext.newPage();
    await feedPage.addInitScript(() => localStorage.clear());
    await feedPage.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await feedPage.waitForSelector('[data-profile-template="passport_authority"]', { state: "attached", timeout: 30000 });
    await clickDom(feedPage, "#feed-panel-toggle");
    await feedPage.locator("#feed-panel-search").fill(feedName);
    const feedItem = feedPage.locator(".feed-item").filter({ hasText: feedName }).first();
    await feedItem.waitFor({ state: "visible", timeout: 30000 });
    await feedItem.locator(".feed-view-button").evaluate((element) => element.click());
    await waitForSettled(feedPage);
    const sourceOnly = await snapshot(feedPage);
    await clickDom(feedPage, '[data-profile-template="passport_authority"]');
    await waitForSettled(feedPage);
    const byMode = {};
    for (const mode of modes) {
      await clickDom(feedPage, `[data-identity-document-authority-strictness="${mode}"]`);
      await waitForSettled(feedPage);
      byMode[mode] = await snapshot(feedPage);
    }
    checkModeSequence(feedName, sourceOnly, byMode, failures);
    results.push({ scope: feedName, sourceOnly: sourceOnly.count, modes: Object.fromEntries(modes.map((mode) => [mode, byMode[mode].count])) });
    await feedContext.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify({ appUrl, scopes: results.length, cases: results.length * modes.length, failures, results }, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
