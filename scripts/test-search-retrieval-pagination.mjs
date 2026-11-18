import assert from "node:assert/strict";
import {
  appendProgressiveCandidatePage,
  getSearchRetrievalStrategy,
  mergeCanonicalCandidatePool,
} from "../frontend/public/search-retrieval-pagination.js";

assert.equal(getSearchRetrievalStrategy({
  hasActivePersonalProfile: true,
  explicitSearch: "passport",
  selectedFeed: false,
}).mode, "complete");
assert.equal(getSearchRetrievalStrategy({ explicitSearch: "a" }).mode, "progressive");
assert.equal(getSearchRetrievalStrategy({ explicitSearch: "banknotes", selectedFeed: true }).mode, "progressive");
assert.equal(getSearchRetrievalStrategy({ hasActivePersonalProfile: true }).mode, "complete");

const mergedProfileCandidates = mergeCanonicalCandidatePool([
  { id: "feed-a", canonicalLink: "https://example.test/shared", title: "Shared" },
  { id: "feed-b", canonicalLink: "https://example.test/shared", title: "Shared mirror" },
  { id: "same-title-a", canonicalLink: "https://example.test/a", title: "Same title" },
  { id: "same-title-b", canonicalLink: "https://example.test/b", title: "Same title" },
  { id: "no-canonical-a", canonicalLink: "", title: "Fallback title" },
  { id: "no-canonical-b", canonicalLink: "", title: "Fallback title" },
  { id: "whitespace-link-a", canonicalLink: "   ", link: "https://example.test/whitespace-link", title: "Whitespace canonical" },
  { id: "whitespace-link-b", canonicalLink: "", link: "https://example.test/whitespace-link", title: "Whitespace canonical mirror" },
]);
assert.deepEqual(
  mergedProfileCandidates.map((article) => article.id),
  ["feed-a", "same-title-a", "same-title-b", "no-canonical-a", "no-canonical-b", "whitespace-link-a"],
  "Profile candidate aggregation must collapse matching canonical URLs while preserving different canonical URLs and ID-only articles."
);

const firstPage = appendProgressiveCandidatePage(null, {
  items: [{ id: "a" }, { id: "shared" }],
  pagination: { page: 1, limit: 2, total: 5, totalPages: 3 },
});
assert.deepEqual(firstPage.items.map((item) => item.id), ["a", "shared"]);
assert.equal(firstPage.pagination.loadedPages, 1);
assert.equal(firstPage.pagination.hasMorePages, true);

const secondPage = appendProgressiveCandidatePage(firstPage, {
  items: [{ id: "shared" }, { id: "c" }],
  pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
});
assert.deepEqual(secondPage.items.map((item) => item.id), ["a", "shared", "c"]);
assert.equal(secondPage.pagination.loadedPages, 2);
assert.equal(secondPage.pagination.hasMorePages, true);

const exhausted = appendProgressiveCandidatePage(secondPage, {
  items: [{ id: "d" }],
  pagination: { page: 3, limit: 2, total: 5, totalPages: 3 },
});
assert.deepEqual(exhausted.items.map((item) => item.id), ["a", "shared", "c", "d"]);
assert.equal(exhausted.pagination.loadedPages, 3);
assert.equal(exhausted.pagination.hasMorePages, false);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 14 })}\n`);
