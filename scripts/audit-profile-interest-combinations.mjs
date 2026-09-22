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

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="security_printer"]', { state: "attached", timeout: 30000 });
  await waitForSettled(page);
  const afterReload = await snapshot(page);

  const failures = [];
  if (profileOnly.count <= 0) failures.push("Security Printer + Vendors profile returned no baseline articles");
  if (combined.count <= 0) failures.push("Holography refinement returned no articles");
  if (combined.count >= profileOnly.count) failures.push("Holography did not narrow the profile result");
  if (combined.activeProfile !== "security_printer") failures.push("Adding an interest cleared the Start Profile");
  if (!combined.holographyChecked) failures.push("Holography was not retained as selected");
  if (combined.storedTemplate !== "security_printer") failures.push("Start Profile was not persisted with the refinement");
  if (afterReload.activeProfile !== "security_printer" || !afterReload.holographyChecked) {
    failures.push("Profile + interest combination did not survive reload");
  }
  if (afterReload.count !== combined.count) failures.push("Reload changed the combined result count");

  process.stdout.write(`${JSON.stringify({ appUrl, failures, profileOnly, combined, afterReload }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
