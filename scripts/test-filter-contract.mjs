import assert from "node:assert/strict";
import fs from "node:fs";
import { createFilterContract, FILTER_CONTRACT_VERSION } from "../frontend/public/filter-contract.js";
import {
  evaluateProfilePolicyEvidence,
  getProfilePolicyDefinition,
  PROFILE_POLICY_DEFINITIONS,
} from "../frontend/public/profile-policies.js";

const corpusUrl = new URL("../tests/fixtures/filter-behavior-corpus.json", import.meta.url);
const corpus = JSON.parse(fs.readFileSync(corpusUrl, "utf8"));
const cases = Array.isArray(corpus.cases) ? corpus.cases : [];

assert.equal(corpus.version, FILTER_CONTRACT_VERSION);
assert.ok(cases.length >= 12, "The behavior corpus must contain representative positive and negative cases");
assert.equal(new Set(cases.map((entry) => entry.id)).size, cases.length, "Behavior case ids must be unique");
assert.equal(Object.keys(PROFILE_POLICY_DEFINITIONS).length, 7, "Every Start Profile needs one explicit policy");
assert.equal(evaluateProfilePolicyEvidence({ title: "Bank unveils new vertical $20 bank note" }, "central_bank").passed, true);
assert.equal(evaluateProfilePolicyEvidence({ title: "Canada expands online passport renewal" }, "passport_authority").passed, true);
assert.equal(evaluateProfilePolicyEvidence({ title: "Irregular border crossings decline after operation" }, "border_control").passed, true);
assert.equal(evaluateProfilePolicyEvidence({ title: "Post-Quantum OpenID Connect specification" }, "identity_verification").passed, true);
assert.equal(evaluateProfilePolicyEvidence({ title: "Quarterly interest-rate decision" }, "central_bank").passed, false);

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
      version: getProfilePolicyDefinition(entry.selection?.profileId)?.version || 1,
      definition: getProfilePolicyDefinition(entry.selection?.profileId),
    },
    interestSelection: {
      selected: entry.selection?.interests || [],
      byGroup: {},
    },
  });

  assert.equal(contract.version, FILTER_CONTRACT_VERSION);
  assert.equal(contract.profilePolicy.id, entry.selection?.profileId);
  assert.ok(contract.profilePolicy.domains.length > 0, `${entry.id} has no declared profile domain`);
  assert.ok(contract.profilePolicy.requiredEvidence.length > 0, `${entry.id} has no required profile evidence`);
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
