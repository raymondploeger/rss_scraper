export function evaluateProfileDomainScopeDecision({
  primaryDomain = "other",
  selectedMainDomains = [],
  identityTechniqueBridgeMatched = false,
  banknoteTechniqueBridgeMatched = false,
} = {}) {
  if (primaryDomain === "other" && !identityTechniqueBridgeMatched && !banknoteTechniqueBridgeMatched) {
    return { passed: false, reason: "primary_domain_other" };
  }

  const domains = Array.isArray(selectedMainDomains) ? selectedMainDomains : [];
  if (domains.length && !domains.includes(primaryDomain)) {
    const selectedIdentityBridgeMatched = identityTechniqueBridgeMatched && domains.includes("identity_documents");
    const selectedBanknoteBridgeMatched = banknoteTechniqueBridgeMatched && domains.includes("banknotes");
    if (!selectedIdentityBridgeMatched && !selectedBanknoteBridgeMatched) {
      return { passed: false, reason: "selected_main_domain_mismatch" };
    }
  }

  return { passed: true, reason: "domain_scope_passed" };
}
