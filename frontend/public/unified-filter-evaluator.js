function uniqueStrings(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
}

function normalizeStage(stage, defaultPassed = true) {
  if (typeof stage === "boolean") {
    return { passed: stage, reason: stage ? "passed" : "rejected" };
  }
  return {
    passed: stage?.passed === undefined ? defaultPassed : Boolean(stage.passed),
    reason: String(stage?.reason || "").trim(),
    ...stage,
  };
}

export function evaluateInterestRefinementGroups(groups = {}) {
  const results = Object.entries(groups || {}).map(([groupId, group]) => {
    const selected = uniqueStrings(group?.selected);
    const matched = uniqueStrings(group?.matched).filter((interestId) => selected.includes(interestId));
    return Object.freeze({
      groupId,
      selected: Object.freeze(selected),
      matched: Object.freeze(matched),
      passed: selected.length === 0 || matched.length > 0,
      rule: "OR",
    });
  });

  return Object.freeze({
    passed: results.every((group) => group.passed),
    ruleAcrossGroups: "AND",
    groups: Object.freeze(results),
    matchedInterestIds: Object.freeze(results.flatMap((group) => group.matched)),
  });
}

export function evaluateUnifiedFilterDecision(input = {}) {
  const sourceScope = normalizeStage(input.sourceScope);
  const profilePolicy = normalizeStage(input.profilePolicy);
  const interestRefinement = input.interestRefinement?.groups
    ? evaluateInterestRefinementGroups(input.interestRefinement.groups)
    : normalizeStage(input.interestRefinement);
  const qualityNoise = normalizeStage(input.qualityNoise);
  const stages = { sourceScope, profilePolicy, interestRefinement, qualityNoise };
  const failedStage = ["sourceScope", "profilePolicy", "interestRefinement", "qualityNoise"]
    .find((stageName) => !stages[stageName].passed) || "";

  return Object.freeze({
    passed: !failedStage,
    failedStage,
    stages: Object.freeze(stages),
  });
}
