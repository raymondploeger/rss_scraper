export function evaluateSharedSecurityRefinementDecision({
  hardRefinementActive = false,
  bridgeDecision = null,
  isBanknotesOnlySelection = false,
  techniqueMatched = true,
} = {}) {
  if (hardRefinementActive && bridgeDecision?.applies && !isBanknotesOnlySelection) {
    return {
      passed: Boolean(bridgeDecision.passed),
      reason: bridgeDecision.passed ? "shared_security_bridge_passed" : "shared_security_bridge_rejected",
    };
  }

  return {
    passed: Boolean(techniqueMatched),
    reason: techniqueMatched ? "shared_security_technique_passed" : "shared_security_technique_rejected",
  };
}
