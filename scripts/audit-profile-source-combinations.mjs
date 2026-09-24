import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");

async function clickDom(page, selector) {
  await page.locator(selector).evaluate((element) => element.click());
  await page.waitForTimeout(650);
}

async function waitForSettled(page) {
  await page.waitForFunction(() => {
    const value = document.querySelector("#results-count")?.textContent || "";
    return value && !/loading/i.test(value);
  }, null, { timeout: 90000 });

  let previous = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await page.evaluate(() => JSON.stringify({
      count: document.querySelector("#results-count")?.textContent || "",
      heading: document.querySelector("#intelligence-feed-title")?.textContent || "",
      titles: Array.from(document.querySelectorAll(".article-card h3"))
        .map((node) => node.textContent?.trim()),
    }));
    if (current === previous) {
      return;
    }
    previous = current;
    await page.waitForTimeout(200);
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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
const unscopedProfileCounts = new Map();

try {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="central_bank"]', {
    state: "attached",
    timeout: 30000,
  });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-source-group]").length >= 5,
    null,
    { timeout: 30000 }
  );
  await waitForSettled(page);

  const profiles = await page.locator("[data-profile-template]").evaluateAll((nodes) => nodes.map((node) => ({
    id: node.dataset.profileTemplate,
    label: node.querySelector(".personal-dashboard-template-option-copy > span")?.textContent?.trim()
      || node.textContent?.trim(),
  })));
  const groups = await page.locator("[data-source-group]").evaluateAll((nodes) => nodes.map((node) => ({
    id: node.dataset.sourceGroup,
    label: node.textContent?.trim(),
  })));
  for (const group of groups) {
    await clickDom(page, "#personal-dashboard-clear");
    await waitForSettled(page);
    await clickDom(page, `[data-source-group="${group.id}"]`);
    await waitForSettled(page);
    const sourceOnly = await snapshot(page);

    for (const profile of profiles) {
      await clickDom(page, `[data-profile-template="${profile.id}"]`);
      await waitForSettled(page);
      const combined = await snapshot(page);
      results.push({
        profile: profile.label,
        groupId: group.id,
        group: group.label,
        sourceOnlyCount: sourceOnly.count,
        combinedCount: combined.count,
        sameFirstPageTitles: JSON.stringify(sourceOnly.titles) === JSON.stringify(combined.titles),
        titles: combined.titles,
        heading: combined.heading,
        summary: combined.summary,
      });
      if (group.id === "all") {
        await clickDom(page, '[data-source-group="USA"]');
        await waitForSettled(page);
        await clickDom(page, '[data-source-group="all"]');
        await waitForSettled(page);
        unscopedProfileCounts.set(profile.label, (await snapshot(page)).count);
      }
      await clickDom(page, "#personal-dashboard-clear");
      await waitForSettled(page);
    }
  }
} finally {
  await browser.close();
}

const failures = results.filter((row) => (
  (row.groupId !== "all" && row.combinedCount > row.sourceOnlyCount) ||
  !row.heading.includes(row.profile) ||
  (row.groupId !== "all" && !row.heading.includes(row.group)) ||
  !row.summary.includes(row.groupId === "all"
    ? "matched your profile across all sources"
    : "matched your profile within selected sources")
));
const centralBankVendors = results.find((row) => (
  row.profile === "Central Bank" && row.group === "Vendors"
));
for (const profile of new Set(results.map((row) => row.profile))) {
  const allSources = results.find((row) => row.profile === profile && row.groupId === "all");
  if (allSources && allSources.combinedCount !== unscopedProfileCounts.get(profile)) {
    failures.push({ profile, failure: "Returning to All sources changed the profile count", returnedAll: unscopedProfileCounts.get(profile), all: allSources.combinedCount });
  }
  for (const scoped of results.filter((row) => row.profile === profile && row.groupId !== "all")) {
    if (!allSources || allSources.combinedCount < scoped.combinedCount) {
      failures.push({ profile, group: scoped.group, failure: "All has fewer profile results than a source group" });
    }
    if (allSources && allSources.combinedCount === allSources.titles?.length && scoped.combinedCount === scoped.titles?.length) {
      const missingTitles = scoped.titles.filter((title) => !allSources.titles.includes(title));
      if (missingTitles.length) {
        failures.push({ profile, group: scoped.group, failure: "All omits source-group articles", missingTitles });
      }
    }
  }
}
if (
  !centralBankVendors ||
  centralBankVendors.combinedCount >= centralBankVendors.sourceOnlyCount ||
  centralBankVendors.sameFirstPageTitles
) {
  failures.push({
    ...(centralBankVendors || {}),
    failure: "Central Bank + Vendors did not narrow the Vendors source feed",
  });
}

process.stdout.write(`${JSON.stringify({
  appUrl,
  combinations: results.length,
  failures,
  centralBankVendors: centralBankVendors ? (({ titles, ...row }) => row)(centralBankVendors) : null,
  unscopedProfileCounts: Object.fromEntries(unscopedProfileCounts),
  results: results.map(({ titles, ...row }) => row),
}, null, 2)}\n`);

if (failures.length) {
  process.exitCode = 1;
}
