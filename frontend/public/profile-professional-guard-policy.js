export function evaluateProfileProfessionalGuardDecision({
  multiDigitalIdentityProfileSelection = false,
  assessDigitalIdentity = () => null,
  assessAuthentication = () => null,
} = {}) {
  if (multiDigitalIdentityProfileSelection) {
    return { passed: true, reason: "professional_guard_not_applicable" };
  }

  const digitalIdentityAssessment = assessDigitalIdentity();
  if (digitalIdentityAssessment && !digitalIdentityAssessment.passed) {
    return { passed: false, reason: "digital_identity_professional_guard" };
  }

  const authenticationAssessment = assessAuthentication();
  if (authenticationAssessment && !authenticationAssessment.passed) {
    return { passed: false, reason: "authentication_professional_guard" };
  }

  return { passed: true, reason: "professional_guard_passed" };
}
