export function evaluateIdentityDocumentQualityGateDecision({ assessment = null } = {}) {
  if (!assessment || assessment.passed !== false) {
    return { passed: true, reason: "identity_document_quality_passed" };
  }
  return {
    passed: false,
    reason: assessment.rejectionReason || "identity_document_bundle_quality_noise",
  };
}
