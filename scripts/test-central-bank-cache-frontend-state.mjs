import assert from "node:assert/strict";
import {
  shouldFallbackToLiveCentralBankArticles,
  shouldUseCentralBankCacheResponse,
} from "../frontend/public/central-bank-cache-client.js";

for (const state of ["ready", "stale", "building", "error"]) {
  assert.equal(shouldUseCentralBankCacheResponse({ state }), true, `${state} remains cache-owned`);
  assert.equal(shouldFallbackToLiveCentralBankArticles({ state }), false, `${state} must not fall back live`);
}
assert.equal(shouldUseCentralBankCacheResponse({ state: "never-built" }), false);
assert.equal(shouldFallbackToLiveCentralBankArticles({ state: "never-built" }), true);
process.stdout.write(`${JSON.stringify({ status: "passed", checks: 10 })}\n`);
