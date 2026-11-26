import assert from "node:assert/strict";
import { getSourceRelevanceAssessment } from "../backend/src/services/sourceRelevanceService.js";

const feed = {
  name: "Canadian Bank Note News",
  rssUrl: "https://www.cbnco.com/news/",
};

for (const link of [
  "https://www.cbnco.com/",
  "https://www.cbnco.com/home/",
  "https://www.cbnco.com/#media-center",
  "https://www.cbnco.com/news/",
  "https://www.cbnco.com//news/",
  "https://www.cbnco.com/%6eews/",
  "https://www.cbnco.com/meet-the-team/",
  "https://www.cbnco.com//meet-the-team/",
  "https://www.cbnco.com/%6d%65%65%74-%74%68%65-%74%65%61%6d/",
  "https://www.cbnco.com/cbn-dlr-identity-group/",
]) {
  const assessment = getSourceRelevanceAssessment(feed, {
    title: "Secure identity document solutions",
    contentSnippet: "Our passport and identity card security technology supports governments.",
    link,
  });
  assert.equal(assessment.accepted, false, link);
}

for (const article of [
  {
    title: "CBN and DLR Group partner on British passport manufacturing",
    contentSnippet: "The partnership supports secure British passport manufacturing.",
    link: "https://www.cbnco.com/wp-content/uploads/2026/05/CBN-DLR-Press-Release.pdf",
  },
  {
    title: "South Carolina selects CBN for a new identity card",
    contentSnippet: "The award covers secure identity card production for South Carolina.",
    link: "https://www.cbnco.com/wp-content/uploads/2026/05/ICMA-News-Release-May-5.pdf",
  },
  {
    title: "Secure document technology",
    contentSnippet: "Our document security products protect government credentials.",
    link: "https://www.cbnco.com/document-security/",
  },
]) {
  assert.equal(getSourceRelevanceAssessment(feed, article).accepted, true, article.link);
}

for (const otherFeed of [
  { name: "Canadian Bank Note News", rssUrl: "https://example.com/news/" },
  { name: "Another feed", rssUrl: "https://www.cbnco.com/news/" },
  { name: " Canadian Bank Note News", rssUrl: "https://www.cbnco.com/news/" },
  { name: "Canadian Bank Note News ", rssUrl: "https://www.cbnco.com/news/" },
  { name: "canadian bank note news", rssUrl: "https://www.cbnco.com/news/" },
  { name: "Canadian Bank Note News", rssUrl: " https://www.cbnco.com/news/" },
  { name: "Canadian Bank Note News", rssUrl: "https://www.cbnco.com/news/ " },
  { name: "Canadian Bank Note News", rssUrl: "https://www.cbnco.com/NEWS/" },
]) {
  const assessment = getSourceRelevanceAssessment(otherFeed, {
    title: "Unrelated article",
    contentSnippet: "No source-specific inclusion terms are present.",
    link: "https://www.cbnco.com/meet-the-team/",
  });
  assert.equal(assessment.accepted, true, `${otherFeed.name} ${otherFeed.rssUrl}`);
  assert.equal(assessment.rule, null);
}

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 21 })}\n`);
