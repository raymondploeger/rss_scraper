export function isHondaPassportVehicleNoise(value = "") {
  const text = String(value || "").toLowerCase();
  if (!text.includes("honda") || !text.includes("passport")) {
    return false;
  }
  return ["honda passport", "trailsport", "suv", "automotive", "vehicle", "awd", "mpg"].some((term) => text.includes(term));
}

export function evaluateIdentityDocumentQualityGateDecision({ assessment = null, hondaPassportNoise = false } = {}) {
  if (hondaPassportNoise) {
    return { passed: false, reason: "identity_document_honda_passport_vehicle_noise" };
  }
  if (!assessment || assessment.passed !== false) {
    return { passed: true, reason: "identity_document_quality_passed" };
  }
  return {
    passed: false,
    reason: assessment.rejectionReason || "identity_document_bundle_quality_noise",
  };
}
