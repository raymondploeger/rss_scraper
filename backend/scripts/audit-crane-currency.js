import { auditCraneCurrencyNewsroom } from "../src/services/rssService.js";

async function getImageStatus(url) {
  if (!url) {
    return "";
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": "RSS Monitor Dashboard/2.0",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    return `${response.status} ${response.headers.get("content-type") || ""}`.trim();
  } catch (error) {
    return error?.message || "image-status-error";
  }
}

function formatList(values = []) {
  return values.length ? values.join(", ") : "-";
}

async function main() {
  console.log("Crane Currency News & Insights dry-run audit");
  console.log("No data will be inserted, updated, or deleted.");

  const audit = await auditCraneCurrencyNewsroom();
  const accepted = audit.results.filter((entry) => entry.accepted);
  const rejected = audit.results.filter((entry) => !entry.accepted);

  console.log("");
  console.log(`Archive pages scanned: ${audit.archivePagesScanned}`);
  audit.archivePages.forEach((page) => {
    console.log(`  page=${page.page} candidates=${page.candidates} url=${page.url}`);
  });
  console.log(`Sitemap URL: ${audit.sitemapUrl}`);
  console.log(`Sitemap URLs scanned: ${audit.sitemapUrlsScanned}`);
  console.log(`Candidate URLs found: ${audit.candidateUrlsFound}`);
  console.log(`Duplicates removed: ${audit.duplicatesRemoved}`);
  console.log(`Validation/source relevance accepted: ${accepted.length}`);
  console.log(`Validation/source relevance rejected: ${rejected.length}`);
  console.log("");

  for (const entry of audit.results) {
    const imageStatus = await getImageStatus(entry.thumbnail);
    console.log(`Decision: ${entry.decision}`);
    console.log(`Title: ${entry.title}`);
    console.log(`URL: ${entry.url}`);
    console.log(`Date: ${entry.date || "-"}`);
    console.log(`Thumbnail: ${entry.thumbnail || "-"}`);
    console.log(`Thumbnail source: ${entry.thumbnailSource || "-"}`);
    console.log(`Thumbnail status: ${imageStatus || entry.thumbnailStatus || "-"}`);
    console.log(`Reason: ${entry.reason}`);
    console.log(`Source relevance: ${entry.sourceRelevanceReason || "-"}`);
    console.log(`Included terms: ${formatList(entry.sourceRelevanceIncludedTerms)}`);
    console.log(`Excluded terms: ${formatList(entry.sourceRelevanceExcludedTerms)}`);
    console.log("");
  }

  console.log("Summary");
  console.log(`Accepted: ${accepted.length}`);
  console.log(`Rejected: ${rejected.length}`);
}

main().catch((error) => {
  console.error("Crane Currency audit failed:", error?.stack || error);
  process.exitCode = 1;
});
