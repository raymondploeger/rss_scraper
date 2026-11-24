import assert from "node:assert/strict";
import { createProfileCachePaginationControl } from "../frontend/public/profile-cache-pagination-ui.js";

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

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 4 })}\n`);
