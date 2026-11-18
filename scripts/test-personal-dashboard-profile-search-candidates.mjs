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
    completeCandidates: true,
    retainAllDedupedCandidates: true,
  },
  "A profile-only view must fetch every candidate page and retain the complete deduped pool before applying profile policy."
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
  "A non-profile search keeps the existing progressive route."
);

assert.deepEqual(
  getBackendCandidateRetentionStrategy({
    hasActivePersonalProfile: true,
    explicitSearch: "ghana banknotes",
    selectedFeed: true,
  }),
  {
    completeCandidates: true,
    retainAllDedupedCandidates: true,
  },
  "A selected-feed profile view must fetch every candidate page and retain the complete deduped pool before applying profile policy."
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 4 })}\n`);
