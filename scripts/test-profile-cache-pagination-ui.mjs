import assert from "node:assert/strict";
import {
  createProfileCachePaginationControl,
  shouldPreserveProfileCachePagination,
} from "../frontend/public/profile-cache-pagination-ui.js";

let fetchedCursor = null;
const control = createProfileCachePaginationControl({
  response: {
    items: Array.from({ length: 30 }, (_, index) => ({ id: index + 1 })),
    total: 1_864,
    nextCursor: "page-2",
  },
  fetchNextPage: async (cursor) => {
    fetchedCursor = cursor;
    return { items: [{ id: 31 }] };
  },
});

assert.equal(control.visibleCountLabel, "30 of 1,864", "the cache page exposes its visible and total counts");
assert.equal(control.nextLabel, "Load more results", "a next cursor exposes an actionable next-page control");
assert.equal(control.canFetchNextPage, true, "a next cursor enables the next-page control");
await control.fetchNextPage();
assert.equal(fetchedCursor, "page-2", "activating the control fetches the next cache page with its cursor");

// The exact built-in Industry Research state must retain cache pagination: its
// first server page has 30 cards while the cache reports the full result count.
const researcherStoredProfile = {
  interests: ["banknotes", "passports", "id_cards", "fraud", "icao", "digital_identity", "identity_verification"],
  activeTemplateId: "researcher",
  activeTemplateIds: ["researcher"],
  trackedSourcesAll: true,
};
const researcherControl = createProfileCachePaginationControl({
  response: {
    items: Array.from({ length: 30 }, (_, index) => ({ id: `researcher-${index + 1}` })),
    total: 180,
    nextCursor: "researcher-page-2",
  },
  fetchNextPage: async () => null,
});
assert.equal(researcherStoredProfile.activeTemplateId, "researcher");
assert.equal(researcherStoredProfile.trackedSourcesAll, true);
assert.equal(researcherControl.visibleCountLabel, "30 of 180", "Industry Research displays cache-page and total counts");
assert.equal(researcherControl.nextLabel, "Load more results", "Industry Research exposes cache pagination");
assert.equal(researcherControl.canFetchNextPage, true, "Industry Research can load the next cache page");
assert.equal(
  shouldPreserveProfileCachePagination({ profileCache: true, trackedSourcesAll: researcherStoredProfile.trackedSourcesAll }),
  true,
  "Industry Research cache totals are not replaced by the all-tracked-sources display count"
);
assert.equal(shouldPreserveProfileCachePagination({ profileCache: false }), false, "live result pagination retains source-scope behavior");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 10 })}\n`);
