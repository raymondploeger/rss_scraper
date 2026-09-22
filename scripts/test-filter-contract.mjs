import assert from "node:assert/strict";
import fs from "node:fs";
import { createFilterContract, FILTER_CONTRACT_VERSION } from "../frontend/public/filter-contract.js";

const corpusUrl = new URL("../tests/fixtures/filter-behavior-corpus.json", import.meta.url);
const corpus = JSON.parse(fs.readFileSync(corpusUrl, "utf8"));
const cases = Array.isArray(corpus.cases) ? corpus.cases : [];

assert.equal(corpus.version, FILTER_CONTRACT_VERSION);
assert.ok(cases.length >= 12, "The behavior corpus must contain representative positive and negative cases");
assert.equal(new Set(cases.map((entry) => entry.id)).size, cases.length, "Behavior case ids must be unique");

const coveredProfiles = new Set(cases.map((entry) => entry.selection?.profileId).filter(Boolean));
[
  "central_bank",
  "passport_authority",
  "border_control",
  "security_printer",
  "vendors",
  "identity_verification",
  "researcher",
].forEach((profileId) => assert.ok(coveredProfiles.has(profileId), `Missing corpus coverage for ${profileId}`));

cases.forEach((entry) => {
  const sourceGroup = entry.selection?.sourceGroup || "all";
  const contract = createFilterContract({
    sourceScope: {
      group: sourceGroup === "All" ? "all" : sourceGroup,
      trackedSourcesAll: sourceGroup === "All",
    },
    profilePolicy: {
      id: entry.selection?.profileId,
      mode: "balanced",
      version: 1,
    },
    interestSelection: {
      selected: entry.selection?.interests || [],
      byGroup: {},
    },
  });

  assert.equal(contract.version, FILTER_CONTRACT_VERSION);
  assert.equal(contract.profilePolicy.id, entry.selection?.profileId);
  assert.equal(contract.sourceScope.mayBypassProfile, false);
  assert.deepEqual(contract.evaluationOrder, [
    "source_scope",
    "profile_policy",
    "interest_refinement",
    "quality_noise",
    "ranking",
  ]);
  assert.equal(contract.interestSelection.semantics.withinGroup, "OR");
  assert.equal(contract.interestSelection.semantics.acrossGroups, "AND");
  assert.equal(
    entry.expected?.final,
    Boolean(
      entry.expected?.sourceScope &&
      entry.expected?.profilePolicy &&
      entry.expected?.interestRefinement &&
      entry.expected?.qualityNoise
    ),
    `${entry.id} has an inconsistent expected final decision`
  );
});

process.stdout.write(`${JSON.stringify({
  contractVersion: FILTER_CONTRACT_VERSION,
  cases: cases.length,
  profiles: Array.from(coveredProfiles).sort(),
  status: "passed",
}, null, 2)}\n`);
