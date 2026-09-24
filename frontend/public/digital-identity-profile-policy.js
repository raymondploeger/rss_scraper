export function evaluateDigitalIdentityProfileDecision({
  selectedInterestCount = 0,
  matchedInterestIds = [],
  sharedSecurityTechniqueMatched = true,
} = {}) {
  const matchedDigitalInterests = Array.isArray(matchedInterestIds) ? matchedInterestIds : [];
  const digitalScopeMatched = selectedInterestCount === 0 || matchedDigitalInterests.length > 0;
  const passed = digitalScopeMatched && Boolean(sharedSecurityTechniqueMatched);
  return {
    passed,
    reason: passed ? "digital_identity_passed" : "digital_identity_rejected",
    matchedInterestIds: matchedDigitalInterests,
  };
}
