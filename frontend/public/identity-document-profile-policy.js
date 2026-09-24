export function evaluateIdentityDocumentProfileDecision({
  scopeAssessment = null,
  sharedSecurityTechniqueMatched = true,
  borderControlProfileSelection = false,
  assessBorderGuidance = () => null,
  assessVisaServiceNoise = () => null,
} = {}) {
  const scopePassed = Boolean(scopeAssessment?.passed);
  if (scopePassed && borderControlProfileSelection) {
    const guidance = assessBorderGuidance() || {};
    const queueTerms = guidance.matchedQueueTravelTerms?.length || 0;
    const operationalTerms = guidance.matchedOperationalDetailTerms?.length || 0;
    if ((queueTerms && !operationalTerms) || queueTerms >= 2) {
      return { passed: false, reason: "border_control_travel_queue_noise", matchedInterestIds: [] };
    }
  }

  const visaServiceNoise = assessVisaServiceNoise() || {};
  if (scopePassed && visaServiceNoise.rejected) {
    return {
      passed: false,
      reason: visaServiceNoise.rejectionReason || "visa_residence_permit_service_noise",
      matchedInterestIds: [],
    };
  }

  const passed = scopePassed && Boolean(sharedSecurityTechniqueMatched);
  return {
    passed,
    reason: passed ? "identity_documents_passed" : "identity_documents_rejected",
    matchedInterestIds: [
      ...(scopeAssessment?.matchedObjectInterests || []),
      ...(scopeAssessment?.matchedIntelligenceInterests || []),
    ],
  };
}
