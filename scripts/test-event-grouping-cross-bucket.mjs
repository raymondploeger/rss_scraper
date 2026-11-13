import assert from "node:assert/strict";
import fs from "node:fs";
import { decideCrossBucketNearMatch, getCrossBucketCandidateKeys } from "../frontend/public/cross-bucket-event-grouping.js";

const fixtureUrl = new URL("../tests/fixtures/event-grouping-cross-bucket.json", import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixtureUrl, "utf8"));
const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");

assert.equal(fixture.version, 1);
assert.ok(fixture.pairs.length >= 3, "The harness needs positive, negative and candidate-pool pairs");

for (const pair of fixture.pairs) {
  const sameInitialBucket = pair.left.identityEventKey === pair.right.identityEventKey;
  const decision = decideCrossBucketNearMatch(pair.left, pair.right);
  assert.equal(sameInitialBucket, pair.expected.sameInitialBucket, `${pair.id}: initial bucket keys`);
  assert.equal(decision.matched, pair.expected.fallback, `${pair.id}: fallback decision (${decision.reason})`);
  assert.equal(sameInitialBucket || decision.matched, pair.expected.grouped, `${pair.id}: final grouping outcome`);

  if (pair.kind === "cross_bucket_candidate_pool") {
    const leftCandidateKeys = getCrossBucketCandidateKeys(pair.left);
    const rightCandidateKeys = getCrossBucketCandidateKeys(pair.right);
    assert.ok(leftCandidateKeys.some((key) => rightCandidateKeys.includes(key)), `${pair.id}: shares a bounded candidate-pool key`);
  }
}

assert.match(
  appSource,
  /const maxCandidatesPerAnchor = 24;[\s\S]*?\.slice\(0, maxCandidatesPerAnchor\)[\s\S]*?decideCrossBucketNearMatch\(/,
  "groupArticlesByEvent must call the fallback only from a bounded candidate set"
);
assert.match(
  appSource,
  /const strictGroups = Object\.values\(grouped\)\.flatMap\(\(bucket\) => bucket\);[\s\S]*?crossBucketCandidateIndex/,
  "the existing strict identity-key grouping must run before cross-bucket fallback"
);

process.stdout.write(JSON.stringify({
  status: "passed",
  pairs: fixture.pairs.map(({ id, kind }) => ({ id, kind })),
}, null, 2) + "\n");
