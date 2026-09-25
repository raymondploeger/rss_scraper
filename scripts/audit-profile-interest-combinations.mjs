import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");

async function clickDom(page, selector) {
  await page.locator(selector).evaluate((element) => element.click());
  await page.waitForTimeout(500);
}

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
      titles: Array.from(document.querySelectorAll(".article-card h3")).map((node) => node.textContent?.trim()),
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
    activeProfile: document.querySelector('[data-profile-template][data-selected="true"]')?.dataset.profileTemplate || "",
    holographyChecked: Boolean(document.querySelector('[data-personal-interest="holography"]')?.checked),
    storedTemplate: localStorage.getItem("personalDashboardActiveTemplate") || "",
    modeChip: Array.from(document.querySelectorAll("#intelligence-feed-context .intelligence-context-chip"))
      .map((node) => node.textContent?.trim() || "")
      .find((label) => label.startsWith("Mode:") || label.startsWith("Profile strictness:")) || "",
    firstArticleWhyProfile: document.querySelector(".article-card .article-why-profile")?.textContent?.trim() || "",
    firstArticleWhyReason: document.querySelector(".article-card .article-why-reason")?.textContent?.trim() || "",
    firstArticleWhySignals: Array.from(document.querySelector(".article-card")?.querySelectorAll(".article-why-signals li") || [])
      .map((node) => node.textContent?.trim() || ""),
    titles: Array.from(document.querySelectorAll(".article-card h3"))
      .map((node) => node.textContent?.trim() || ""),
  }));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="security_printer"]', { state: "attached", timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-source-group]").length >= 5, null, { timeout: 30000 });
  await waitForSettled(page);

  await clickDom(page, '[data-source-group="Vendors"]');
  await waitForSettled(page);
  await clickDom(page, '[data-profile-template="security_printer"]');
  await waitForSettled(page);
  const profileOnly = await snapshot(page);

  await clickDom(page, '[data-personal-group-toggle="security_printing"]');
  await page.locator('[data-personal-interest="holography"]').evaluate((element) => {
    element.checked = true;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitForSettled(page);
  const combined = await snapshot(page);

  await clickDom(page, '[data-source-group="all"]');
  await waitForSettled(page);
  const allTracked = await snapshot(page);
  await clickDom(page, '[data-source-group="Vendors"]');
  await waitForSettled(page);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="security_printer"]', { state: "attached", timeout: 30000 });
  await waitForSettled(page);
  const afterReload = await snapshot(page);

  const failures = [];
  if (profileOnly.count <= 0) failures.push("Security Printer + Vendors profile returned no baseline articles");
  if (combined.count <= 0) failures.push("Holography refinement returned no articles");
  if (combined.count >= profileOnly.count) failures.push("Holography did not narrow the profile result");
  if (allTracked.count < combined.count) failures.push("All tracked sources returned fewer results than Vendors");
  const missingVendorTitles = combined.titles.filter((title) => !allTracked.titles.includes(title));
  if (missingVendorTitles.length) failures.push(`All tracked sources omitted Vendor articles: ${missingVendorTitles.join("; ")}`);
  if (combined.activeProfile !== "security_printer") failures.push("Adding an interest cleared the Start Profile");
  if (!combined.holographyChecked) failures.push("Holography was not retained as selected");
  if (combined.storedTemplate !== "security_printer") failures.push("Start Profile was not persisted with the refinement");
  if (combined.modeChip) failures.push("Security Printer displays a mode that cannot be changed in the interface");
  if (combined.firstArticleWhyProfile.includes("Balanced")) {
    failures.push("Article explanation displays a mode that cannot be changed in the interface");
  }
  if (profileOnly.firstArticleWhyReason === "The article's content matched your Start Profile" &&
      !profileOnly.firstArticleWhySignals.some((signal) => signal.startsWith("Profile topic: "))) {
    failures.push("Article explanation omits the profile content evidence");
  }
  if (!combined.firstArticleWhySignals.some((signal) => signal.startsWith("Selected interest: Holography"))) {
    failures.push("Article explanation does not identify the selected Holography refinement");
  }
  if (!combined.firstArticleWhySignals.some((signal) => signal.startsWith("Article source: "))) {
    failures.push("Article explanation does not distinguish source context from matching evidence");
  }
  if (afterReload.activeProfile !== "security_printer" || !afterReload.holographyChecked) {
    failures.push("Profile + interest combination did not survive reload");
  }
  if (afterReload.count !== combined.count) failures.push("Reload changed the combined result count");

  await clickDom(page, '[data-profile-template="passport_authority"]');
  await waitForSettled(page);
  const strictMode = await snapshot(page);
  await clickDom(page, '[data-identity-document-authority-strictness="balanced"]');
  await waitForSettled(page);
  const standardMode = await snapshot(page);
  await clickDom(page, '[data-identity-document-authority-strictness="broad"]');
  await waitForSettled(page);
  const expandedMode = await snapshot(page);
  if (strictMode.modeChip !== "Profile strictness: Strict") failures.push("Identity Document Authority Strict label is incorrect");
  if (standardMode.modeChip !== "Profile strictness: Standard") failures.push("Identity Document Authority Standard label is incorrect");
  if (expandedMode.modeChip !== "Profile strictness: Expanded") failures.push("Identity Document Authority Expanded label is incorrect");
  if (!(strictMode.count <= standardMode.count && standardMode.count <= expandedMode.count)) {
    failures.push("Identity Document Authority strictness did not expand results from Strict to Expanded");
  }

  process.stdout.write(`${JSON.stringify({
    appUrl,
    failures,
    profileOnly,
    combined,
    allTracked,
    afterReload,
    identityAuthorityModes: [focusedMode, balancedMode, researchMode],
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
