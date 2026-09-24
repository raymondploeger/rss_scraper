import assert from "node:assert/strict";
import fs from "node:fs";
import { createFilterContract, FILTER_CONTRACT_VERSION } from "../frontend/public/filter-contract.js";
import {
  evaluateProfilePolicyEvidence,
  getProfilePolicyDefinition,
  PROFILE_POLICY_DEFINITIONS,
} from "../frontend/public/profile-policies.js";
import {
  evaluateInterestRefinementGroups,
  evaluateUnifiedFilterDecision,
} from "../frontend/public/unified-filter-evaluator.js";
import { getProfileModePolicy, GENERAL_PROFILE_MODES } from "../frontend/public/profile-mode-policy.js";
import { evaluateSharedSecurityProfileDecision } from "../frontend/public/shared-security-profile-policy.js";
import { evaluateDigitalIdentityProfileDecision } from "../frontend/public/digital-identity-profile-policy.js";

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
assert.deepEqual(
  ["focused", "balanced", "broad"].map((mode) =>
    getProfileModePolicy("passport_authority", "balanced", mode).label
  ),
  ["Focused", "Balanced", "Research mode"]
);
assert.equal(getProfileModePolicy("security_printer", "balanced", "focused").userSelectable, false);
assert.deepEqual(evaluateSharedSecurityProfileDecision({ techniqueMatched: false }), {
  passed: false,
  reason: "shared_security_only_rejected",
});
assert.deepEqual(evaluateSharedSecurityProfileDecision({
  techniqueMatched: true,
  professionalGuard: { applies: true, passed: false, rejectionReason: "off_domain_printing" },
}), { passed: false, reason: "off_domain_printing" });
assert.deepEqual(evaluateSharedSecurityProfileDecision({
  techniqueMatched: true,
  professionalGuard: { applies: true, passed: true },
}), { passed: true, reason: "shared_security_only_passed" });
assert.deepEqual(evaluateSharedSecurityProfileDecision({
  techniqueMatched: true,
  professionalGuard: { applies: false, passed: false },
}), { passed: true, reason: "shared_security_only_passed" });
assert.deepEqual(evaluateDigitalIdentityProfileDecision({
  selectedInterestCount: 2,
  matchedInterestIds: ["authentication"],
}), { passed: true, reason: "digital_identity_passed", matchedInterestIds: ["authentication"] });
assert.deepEqual(evaluateDigitalIdentityProfileDecision({
  selectedInterestCount: 2,
  matchedInterestIds: [],
}), { passed: false, reason: "digital_identity_rejected", matchedInterestIds: [] });
assert.equal(evaluateDigitalIdentityProfileDecision({
  selectedInterestCount: 0,
  sharedSecurityTechniqueMatched: false,
}).passed, false);
assert.ok(GENERAL_PROFILE_MODES.strict.domainThreshold > GENERAL_PROFILE_MODES.balanced.domainThreshold);
assert.ok(GENERAL_PROFILE_MODES.balanced.domainThreshold > GENERAL_PROFILE_MODES.broad.domainThreshold);

assert.equal(evaluateInterestRefinementGroups({
  identity_documents: { selected: ["passports", "id_cards"], matched: ["passports"] },
}).passed, true, "One match inside an interest group must satisfy OR");
assert.equal(evaluateInterestRefinementGroups({
  identity_documents: { selected: ["passports"], matched: ["passports"] },
  security_printing: { selected: ["holography"], matched: [] },
}).passed, false, "Every selected interest group must satisfy AND");
assert.equal(evaluateUnifiedFilterDecision({
  sourceScope: true,
  profilePolicy: true,
  interestRefinement: true,
  qualityNoise: { passed: false, reason: "legacy_false_positive_guard" },
}).failedStage, "qualityNoise", "Hard noise must reject after profile and interest matches");

const INTEREST_GROUPS = {
  passports: "identity_documents",
  holography: "security_printing",
  authentication: "digital_identity_biometrics",
};
const INTEREST_TERMS = {
  passports: ["passport"],
  holography: ["hologram", "holographic", "holography"],
  authentication: ["authentication", "openid"],
};

function getCorpusInterestGroups(entry) {
  const title = String(entry.article?.title || "").toLowerCase();
  return (entry.selection?.interests || []).reduce((groups, interestId) => {
    const groupId = INTEREST_GROUPS[interestId] || "other";
    groups[groupId] ||= { selected: [], matched: [] };
    groups[groupId].selected.push(interestId);
    if ((INTEREST_TERMS[interestId] || [interestId.replaceAll("_", " ")]).some((term) => title.includes(term))) {
      groups[groupId].matched.push(interestId);
    }
    return groups;
  }, {});
}

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
  const sourceScopePassed = String(entry.selection?.sourceGroup || "All") === "All"
    || String(entry.article?.sourceGroup || "") === String(entry.selection?.sourceGroup || "");
  const profileAssessment = evaluateProfilePolicyEvidence(entry.article, entry.selection?.profileId);
  const unifiedDecision = evaluateUnifiedFilterDecision({
    sourceScope: { passed: sourceScopePassed },
    profilePolicy: profileAssessment,
    interestRefinement: { groups: getCorpusInterestGroups(entry) },
    qualityNoise: { passed: entry.expected?.qualityNoise !== false },
  });
  assert.equal(sourceScopePassed, entry.expected?.sourceScope, `${entry.id} source-scope mismatch`);
  assert.equal(profileAssessment.passed, entry.expected?.profilePolicy, `${entry.id} profile-policy mismatch`);
  assert.equal(
    unifiedDecision.stages.interestRefinement.passed,
    entry.expected?.interestRefinement,
    `${entry.id} interest-refinement mismatch`
  );
  assert.equal(unifiedDecision.passed, entry.expected?.final, `${entry.id} unified final-decision mismatch`);
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
