import { chromium } from "../node_modules/playwright/index.mjs";

const appUrl = String(process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const requiredVisibleFeeds = new Set([
  "IRCC Passport and Digital Identity News",
  "AAMVA News",
  "European Commission Digital Identity News",
  "OpenID Foundation News",
  "Bank of Canada News",
  "Reserve Bank of Australia Media Releases",
]);
const profiles = [
  {
    id: "passport_authority",
    label: "Identity Document Authority",
    feeds: [
      "IRCC Passport and Digital Identity News",
      "AAMVA News",
      "GOV.UK News and Communications",
      "Dutch IND Residence Updates",
      "Swedish Migration Agency News",
      "UKVI BRP and BRC Guidance",
      "UKVI Biometric Residence Permits",
    ],
  },
  {
    id: "identity_verification",
    label: "Identity Verification",
    feeds: [
      "AAMVA News",
      "European Commission Digital Identity News",
      "OpenID Foundation News",
    ],
  },
  {
    id: "central_bank",
    label: "Central Bank",
    feeds: [
      "Bank of Canada News",
      "Reserve Bank of Australia Media Releases",
      "BanknoteNews",
      "news.notafilia.pl",
      "MRIGuide",
    ],
  },
  {
    id: "border_control",
    label: "Border Control",
    feeds: [
      "IRCC Passport and Digital Identity News",
      "Frontex Newsroom",
      "CBP Newsroom",
      "CBP Mobile Passport Control",
      "eu-LISA Updates",
      "ICAO Newsroom",
      "ICAO TRIP",
      "ICAO Doc 9303",
      "ICAO Traveller Identification Programme",
      "ICAO Digital Travel Credential",
      "ICAO PKD",
      "Bing Mirror - ICAO Digital Travel Credential",
      "Bing Mirror - ICAO PKD",
      "GOV.UK News and Communications",
      "Dutch IND Residence Updates",
      "Swedish Migration Agency News",
    ],
  },
];

const browser = await chromium.launch({ headless: true });
const auditResults = [];

try {
  for (const profile of profiles) {
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.clear());
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    const profileSelector = `[data-profile-template="${profile.id}"]`;
    await page.waitForSelector(profileSelector, { state: "attached", timeout: 30000 });
    await page.locator(profileSelector).evaluate((element) => element.click());
    await page.waitForTimeout(2000);
    await page.waitForFunction(() => {
      const value = document.querySelector("#results-count")?.textContent || "";
      return value && !value.includes("Loading");
    }, null, { timeout: 90000 });

    const renderedTitles = [];
    let currentPage = 1;
    let totalPages = 1;
    do {
      renderedTitles.push(...await page.locator(".article-card h3").allTextContents());
      const status = await page.locator(".pagination-status").innerText().catch(() => "Page 1 of 1");
      const match = status.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
      currentPage = Number(match?.[1] || 1);
      totalPages = Number(match?.[2] || 1);
      if (currentPage < totalPages) {
        await page.locator('[data-pagination-action="next"]').click();
        await page.waitForFunction(
          (nextPage) => document.querySelector(".pagination-status")?.textContent?.includes(`Page ${nextPage} of`),
          currentPage + 1,
          { timeout: 10000 }
        );
      }
    } while (currentPage < totalPages);

    const feedChecks = await page.evaluate(async ({ feedNames, titles, requiredFeedNames }) => {
      const feeds = await fetch("/api/feeds").then((response) => response.json());
      const rendered = new Set(titles.map((title) => String(title || "").trim().toLowerCase()));
      return Promise.all(feedNames.map(async (feedName) => {
        const feed = feeds.find((candidate) => candidate.name === feedName);
        if (!feed) {
          return {
            feedName,
            requiredVisible: requiredFeedNames.includes(feedName),
            status: "feed_missing",
            articleCount: 0,
            visibleCount: 0,
          };
        }
        const params = new URLSearchParams({
          includePagination: "true",
          limit: "300",
          page: "1",
          feedId: feed.id,
        });
        const payload = await fetch(`/api/articles?${params}`).then((response) => response.json());
        const articles = payload.items || payload.articles || [];
        const visibleTitles = articles
          .filter((article) => rendered.has(String(article.title || "").trim().toLowerCase()))
          .map((article) => article.title);
        return {
          feedName,
          requiredVisible: requiredFeedNames.includes(feedName),
          status: articles.length === 0 ? "no_articles" : visibleTitles.length ? "visible" : "missing_from_profile",
          articleCount: articles.length,
          visibleCount: visibleTitles.length,
        };
      }));
    }, {
      feedNames: profile.feeds,
      titles: renderedTitles,
      requiredFeedNames: Array.from(requiredVisibleFeeds),
    });

    auditResults.push({
      profile: profile.label,
      resultCount: await page.locator("#results-count").innerText(),
      totalPages,
      feedChecks,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const failures = auditResults.flatMap((profile) => profile.feedChecks
  .filter((feed) => feed.requiredVisible && (feed.status === "feed_missing" || feed.status === "missing_from_profile"))
  .map((feed) => ({ profile: profile.profile, ...feed })));
const observations = auditResults.flatMap((profile) => profile.feedChecks
  .filter((feed) => !feed.requiredVisible && feed.status === "missing_from_profile")
  .map((feed) => ({ profile: profile.profile, ...feed })));

process.stdout.write(`${JSON.stringify({ appUrl, profiles: auditResults, failures, observations }, null, 2)}\n`);
if (failures.length) {
  process.exitCode = 1;
}
