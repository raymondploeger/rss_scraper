import assert from "node:assert/strict";
import {
  CandidateSnapshotError,
  createCompleteCandidateSnapshotStore,
  serveCompleteCandidateSnapshotRequest,
} from "../backend/src/services/completeCandidateSnapshotService.js";

let now = 1_000;
let idCounter = 0;
const store = createCompleteCandidateSnapshotStore({
  ttlMs: 1_000,
  maxSnapshots: 2,
  maxItems: 3,
  now: () => now,
  createId: () => `test-snapshot-${++idCounter}`,
});

const snapshot = store.create({
  scopeKey: "profile-feed-a",
  items: [{ id: "a" }, { id: "b" }, { id: "c" }],
});
assert.equal(snapshot.id, "test-snapshot-1");
assert.notEqual(snapshot.id, "profile-feed-a", "snapshot IDs must not encode their scope");

const pageOne = store.readPage({ id: snapshot.id, scopeKey: "profile-feed-a", page: 1, limit: 2 });
assert.deepEqual(pageOne.items.map((item) => item.id), ["a", "b"]);
assert.deepEqual(pageOne.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });

const pageTwo = store.readPage({ id: snapshot.id, scopeKey: "profile-feed-a", page: 2, limit: 2 });
assert.deepEqual(pageTwo.items.map((item) => item.id), ["c"]);
assert.equal(store.size(), 1, "reading later pages must reuse the existing snapshot");

assert.throws(
  () => store.readPage({ id: snapshot.id, scopeKey: "different-scope", page: 1, limit: 2 }),
  (error) => error instanceof CandidateSnapshotError && error.code === "CANDIDATE_SNAPSHOT_SCOPE_MISMATCH"
);
assert.throws(
  () => store.create({ scopeKey: "too-many", items: [{}, {}, {}, {}] }),
  (error) => error instanceof CandidateSnapshotError && error.code === "CANDIDATE_SNAPSHOT_LIMIT"
);

let collisionAttempts = 0;
const collisionStore = createCompleteCandidateSnapshotStore({
  ttlMs: 1_000,
  maxSnapshots: 3,
  maxItems: 3,
  maxIdAttempts: 2,
  now: () => now,
  createId: () => {
    collisionAttempts += 1;
    if (collisionAttempts > 3) throw new Error("unexpected token retry");
    return "reused-token";
  },
});
collisionStore.create({ scopeKey: "first", items: [{ id: "first" }] });
assert.throws(
  () => collisionStore.create({ scopeKey: "second", items: [{ id: "second" }] }),
  (error) => error instanceof CandidateSnapshotError && error.code === "CANDIDATE_SNAPSHOT_TOKEN_GENERATION_FAILED"
);

const second = store.create({ scopeKey: "profile-feed-b", items: [{ id: "d" }] });
assert.equal(second.id, "test-snapshot-2");
assert.throws(
  () => store.create({ scopeKey: "profile-feed-c", items: [{ id: "e" }] }),
  (error) => error instanceof CandidateSnapshotError && error.code === "CANDIDATE_SNAPSHOT_CAPACITY"
);

now += 1_001;
assert.throws(
  () => store.readPage({ id: snapshot.id, scopeKey: "profile-feed-a", page: 1, limit: 2 }),
  (error) => error instanceof CandidateSnapshotError && error.code === "CANDIDATE_SNAPSHOT_UNAVAILABLE"
);
assert.equal(store.size(), 0, "expired snapshots must be purged before access");

const workflowStore = createCompleteCandidateSnapshotStore({
  ttlMs: 1_000,
  maxSnapshots: 2,
  maxItems: 10,
  now: () => now,
  createId: () => `workflow-snapshot-${++idCounter}`,
});
let buildCalls = 0;
const firstWorkflowPage = await serveCompleteCandidateSnapshotRequest({
  store: workflowStore,
  scopeKey: "profile-only",
  page: 1,
  limit: 2,
  buildItems: async () => {
    buildCalls += 1;
    return [{ id: "first" }, { id: "second" }, { id: "third" }];
  },
});
const laterWorkflowPage = await serveCompleteCandidateSnapshotRequest({
  store: workflowStore,
  scopeKey: "profile-only",
  candidateSnapshotId: firstWorkflowPage.candidateSnapshotId,
  page: 2,
  limit: 2,
  buildItems: async () => {
    buildCalls += 1;
    return [];
  },
});
assert.equal(buildCalls, 1, "later snapshot pages must not rebuild the database candidate set");
assert.deepEqual(laterWorkflowPage.items.map((item) => item.id), ["third"]);
assert.equal(laterWorkflowPage.candidateSnapshotId, "", "final snapshot page should release the snapshot");
assert.equal(workflowStore.size(), 0, "final snapshot page must free capacity");

const singlePageStore = createCompleteCandidateSnapshotStore({
  ttlMs: 1_000,
  maxSnapshots: 2,
  maxItems: 10,
  now: () => now,
  createId: () => `single-page-snapshot-${++idCounter}`,
});
const singleWorkflowPage = await serveCompleteCandidateSnapshotRequest({
  store: singlePageStore,
  scopeKey: "single-page",
  page: 1,
  limit: 2,
  buildItems: async () => [{ id: "only" }],
});
assert.equal(singleWorkflowPage.candidateSnapshotId, "", "single-page snapshots should be released immediately");
assert.equal(singlePageStore.size(), 0, "single-page snapshots must not consume capacity until TTL expiry");

const defaultCapacityStore = createCompleteCandidateSnapshotStore({
  createId: () => "default-capacity-snapshot",
});
const supportedProfileItems = Array.from({ length: 5_000 }, (_, index) => ({ id: `candidate-${index}` }));
assert.doesNotThrow(
  () => defaultCapacityStore.create({ scopeKey: "central-bank-90-days", items: supportedProfileItems }),
  "the default snapshot capacity must match the supported 5,000-candidate source bound"
);
assert.throws(
  () => defaultCapacityStore.create({
    scopeKey: "over-default-capacity",
    items: [...supportedProfileItems, { id: "candidate-overflow" }],
  }),
  (error) => error instanceof CandidateSnapshotError && error.code === "CANDIDATE_SNAPSHOT_LIMIT"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 18 })}\n`);
