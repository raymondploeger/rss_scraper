import assert from "node:assert/strict";
import { createProfileCacheRefreshTrigger } from "../backend/src/services/rssService.js";

let rebuildCount = 0;
let beginFirstRebuild;
const firstRebuildStarted = new Promise((resolve) => { beginFirstRebuild = resolve; });
let releaseFirstRebuild;
const firstRebuildGate = new Promise((resolve) => { releaseFirstRebuild = resolve; });
let beginTrailingRebuild;
const trailingRebuildStarted = new Promise((resolve) => { beginTrailingRebuild = resolve; });
let releaseTrailingRebuild;
const trailingRebuildGate = new Promise((resolve) => { releaseTrailingRebuild = resolve; });
let beginFinalRebuild;
const finalRebuildStarted = new Promise((resolve) => { beginFinalRebuild = resolve; });
let releaseFinalRebuild;
const finalRebuildGate = new Promise((resolve) => { releaseFinalRebuild = resolve; });

const trigger = createProfileCacheRefreshTrigger({
  rebuildAll: async () => {
    rebuildCount += 1;
    if (rebuildCount === 1) {
      beginFirstRebuild();
      await firstRebuildGate;
      return;
    }
    if (rebuildCount === 2) {
      beginTrailingRebuild();
      await trailingRebuildGate;
      return;
    }
    if (rebuildCount === 3) {
      beginFinalRebuild();
      await finalRebuildGate;
    }
  },
  onError: (error) => { throw error; },
});

const firstSyncCompletion = trigger.request();
await firstRebuildStarted;

// This is the regression: a later feed finishes while the first cache build is
// in flight. It must cause a fresh build after the in-flight one completes.
const secondSyncCompletion = trigger.request();
releaseFirstRebuild();
await trailingRebuildStarted;
assert.equal(rebuildCount, 2, "a completion during an active rebuild schedules one trailing rebuild");

// A completion during the trailing pass is newer than that pass's input and
// therefore needs one final rebuild. Finite sync completions still terminate.
const thirdSyncCompletion = trigger.request();
releaseTrailingRebuild();
await finalRebuildStarted;
assert.equal(rebuildCount, 3, "a completion during a trailing rebuild schedules one final rebuild");
releaseFinalRebuild();
await Promise.all([firstSyncCompletion, secondSyncCompletion, thirdSyncCompletion]);
assert.equal(rebuildCount, 3, "the trigger stops after rebuilding the latest completed sync burst");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 3 })}\n`);
