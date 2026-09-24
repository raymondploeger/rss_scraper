export function evaluateBanknoteProfileDecision({
  isContaminated,
  assessConsumerNoise,
  isCentralBankProfileActive = () => false,
  assessCentralBankProfessional,
  resolveInterests,
  profileBundleSelection = false,
  matchesDomain,
  matchesInterest,
  matchesSharedSecurityTechnique,
} = {}) {
  if (isContaminated()) {
    return { passed: false, reason: "banknote_contaminated" };
  }
  const consumerNoise = assessConsumerNoise();
  if (consumerNoise.rejected) {
    return { passed: false, reason: consumerNoise.rejectionReason || "banknote_consumer_noise" };
  }
  if (isCentralBankProfileActive()) {
    const professional = assessCentralBankProfessional();
    if (!professional.passed) {
      return { passed: false, reason: professional.rejectionReason || "central_bank_profile_guard" };
    }
  }

  const resolution = resolveInterests();
  const interestIds = profileBundleSelection
    ? resolution.groupInterestIds
    : resolution.effectiveInterestIds;
  const parentActsAsDomainGate = !profileBundleSelection && resolution.parentActsAsDomainGate;

  if (!interestIds.length) {
    if (!matchesDomain()) {
      return { passed: false, reason: "banknote_domain_rejected" };
    }
    const passed = matchesSharedSecurityTechnique();
    return { passed, reason: passed ? "banknote_domain_passed" : "banknote_domain_rejected" };
  }

  const interestMatched = matchesInterest(interestIds);
  if (!interestMatched) {
    return {
      passed: false,
      reason: parentActsAsDomainGate ? "banknote_parent_gate_rejected" : "banknote_interest_rejected",
    };
  }
  const passed = matchesSharedSecurityTechnique();
  const reasonPrefix = parentActsAsDomainGate ? "banknote_parent_gate" : "banknote_interest";
  return { passed, reason: `${reasonPrefix}_${passed ? "passed" : "rejected"}` };
}
