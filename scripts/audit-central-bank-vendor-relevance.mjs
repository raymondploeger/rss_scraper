import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-profile-template="central_bank"]', { state: "attached", timeout: 30000 });
  await page.locator('[data-source-group="Vendors"]').evaluate((element) => element.click());
  await page.locator('[data-profile-template="central_bank"]').evaluate((element) => element.click());
  await page.waitForFunction(() => {
    const count = document.querySelector("#results-count")?.textContent || "";
    return count && !/loading/i.test(count) &&
      (document.querySelector("#intelligence-feed-title")?.textContent || "").includes("Central Bank");
  }, null, { timeout: 90000 });
  await page.waitForTimeout(1000);
  const snapshot = await page.evaluate(() => ({
    count: Number.parseInt(document.querySelector("#results-count")?.textContent || "0", 10) || 0,
    cards: Array.from(document.querySelectorAll(".article-card")).map((card) => ({
      title: card.querySelector("h3")?.textContent?.trim() || "",
      feed: card.querySelector(".article-feed")?.textContent?.trim() || "",
      reason: card.querySelector(".article-why-reason")?.textContent?.trim() || "",
      signals: Array.from(card.querySelectorAll(".article-why-signals li")).map((item) => item.textContent?.trim() || ""),
    })),
  }));
  const suspiciousTitle = (title) => /\b(?:moneta|monety|monetę|coin|coins)\b|media kit|application for permission|wniosek o zgod/i.test(title);
  const suspicious = snapshot.cards.filter(({ title }) => suspiciousTitle(title));
  const retainedExamples = snapshot.cards.filter(({ title }) => /20 dollar banknote|20-dollar note|new banknote/i.test(title));
  const failures = [];
  if (suspicious.length) failures.push("Collector coins or navigation pages remain in Central Bank + Vendors");
  if (!retainedExamples.length) failures.push("No representative banknote article survived the Central Bank filter");
  const targetedSearches = [];
  for (const term of ["moneta", "Media Kit"]) {
    await page.locator("#search-filter").fill(term);
    await page.waitForTimeout(800);
    await page.waitForFunction(() => !/loading/i.test(document.querySelector("#results-count")?.textContent || ""));
    const searchResult = await page.evaluate(() => ({
      count: Number.parseInt(document.querySelector("#results-count")?.textContent || "0", 10) || 0,
      titles: Array.from(document.querySelectorAll(".article-card h3")).map((node) => node.textContent?.trim() || ""),
    }));
    targetedSearches.push({ term, ...searchResult });
    if (searchResult.titles.some((title) => suspiciousTitle(title))) {
      failures.push(`Targeted search still shows a coin or navigation title for ${term}`);
    }
  }
  process.stdout.write(`${JSON.stringify({
    appUrl,
    count: snapshot.count,
    rendered: snapshot.cards.length,
    suspicious,
    retainedExamples,
    targetedSearches,
    failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
