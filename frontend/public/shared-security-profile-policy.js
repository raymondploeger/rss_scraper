export function evaluateSharedSecurityProfileDecision({
  techniqueMatched = false,
  professionalGuard = null,
} = {}) {
  if (!techniqueMatched) {
    return { passed: false, reason: "shared_security_only_rejected" };
  }
  if (professionalGuard?.applies && !professionalGuard.passed) {
    return {
      passed: false,
      reason: professionalGuard.rejectionReason || "security_printer_profile_guard_rejected",
    };
  }
  return { passed: true, reason: "shared_security_only_passed" };
}
