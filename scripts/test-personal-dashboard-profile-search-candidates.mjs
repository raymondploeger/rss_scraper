import assert from "node:assert/strict";
import { getBackendCandidateRetentionStrategy } from "../frontend/public/backend-candidate-retention-strategy.js";

assert.deepEqual(
  getBackendCandidateRetentionStrategy({
    hasActivePersonalProfile: true,
    explicitSearch: "ghana banknotes",
  }),
  {
    completeCandidates: true,
    retainAllDedupedCandidates: true,
  },
  "An explicit personal-profile search must fetch every candidate page and retain the complete deduped pool for classification."
);

assert.deepEqual(
  getBackendCandidateRetentionStrategy({
    hasActivePersonalProfile: true,
    explicitSearch: "",
  }),
  {
    completeCandidates: false,
    retainAllDedupedCandidates: false,
  },
  "A profile without an explicit search keeps the existing bounded route."
);

assert.deepEqual(
  getBackendCandidateRetentionStrategy({
    hasActivePersonalProfile: false,
    explicitSearch: "ghana banknotes",
  }),
  {
    completeCandidates: false,
    retainAllDedupedCandidates: false,
  },
  "A non-profile search keeps the existing bounded route."
);

assert.deepEqual(
  getBackendCandidateRetentionStrategy({
    hasActivePersonalProfile: true,
    explicitSearch: "ghana banknotes",
    selectedFeed: true,
  }),
  {
    completeCandidates: false,
    retainAllDedupedCandidates: false,
  },
  "A selected-feed profile search keeps the existing bounded route."
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 4 })}\n`);
