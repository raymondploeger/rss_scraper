const DISCOVERY_FEED_NAMES = new Set(["ovd", "security features", "banknotes", "passports"]);

function normalizedText(article) {
  return [article?.title, article?.contentSnippet, article?.summary].map((value) => String(value || "").toLowerCase()).join(" ");
}
function normalizedTitle(article) { return String(article?.title || "").toLowerCase(); }
function has(text, pattern) { return pattern.test(text); }
function isGoogleAlertFeed(feed) {
  try {
    const url = new URL(String(feed?.rssUrl || ""));
    return url.hostname === "www.google.com" && url.pathname.startsWith("/alerts/feeds/");
  } catch { return false; }
}
function hasBanknoteEventContext(text, title) {
  const hasBanknote = has(text, /\bbank\s?notes?\b|\bcurrency notes?\b|\bcedi notes?\b/);
  const hasTitleBanknoteEvidence = has(title, /\bbank\s?notes?\b|\bcurrency notes?\b|\bcedi notes?\b/);
  const hasTitleIssuer = has(title, /\b(?:bank of|central bank of|reserve bank of)\s+[a-z][a-z\s-]{2,50}\b/);
  const hasConcreteEvent = has(text, /\b(?:central bank|reserve bank|\becb\b|\bbsp\b|issued?|issuance|circulat(?:e|es|ed|ing|ion)|unveils?|introduces?|launches?|rollout|new bank\s?note|design|redesign|security (?:feature|features|ink|thread)|hologram|counterfeit|anti-counterfeit|security printing|printed?|printing|production|future|series|denomination|polymer|substrate|commemorative)\b/);
  return hasBanknote && hasConcreteEvent && (hasTitleBanknoteEvidence || hasTitleIssuer);
}
function hasDocumentSecurityContext(text) {
  return has(text, /\b(?:passport|travel document|identity document|bank\s?note|currency note|cedi note|document security|anti-counterfeit|holographic?|optical variable device|security printing)\b/);
}

/** Pure browser/Node policy; historical classifier labels are intentionally ignored. */
export function assessDiscoveryFeedQuality(feed, article) {
  const name = String(feed?.name || "").trim().toLowerCase();
  if (!isGoogleAlertFeed(feed) || !DISCOVERY_FEED_NAMES.has(name)) return { accepted: true, reason: "discovery_feed_quality_not_applicable" };
  const text = normalizedText(article);
  const title = normalizedTitle(article);
  if (name === "ovd") {
    const hasOvd = has(text, /\bovd\b|\boptical variable devices?\b/);
    return hasOvd && hasDocumentSecurityContext(text) ? { accepted: true, reason: "ovd_document_security_context" } : { accepted: false, reason: "ovd_missing_document_security_context" };
  }
  if (name === "security features") {
    return hasBanknoteEventContext(text, title) || hasDocumentSecurityContext(text) ? { accepted: true, reason: "security_features_document_security_context" } : { accepted: false, reason: "security_features_missing_document_security_context" };
  }
  if (name === "banknotes") {
    return hasBanknoteEventContext(text, title) ? { accepted: true, reason: "banknotes_concrete_context" } : { accepted: false, reason: "banknotes_missing_concrete_context" };
  }
  const hasPassport = has(text, /\bpassports?\b|\btravel documents?\b/);
  const hasConcreteContext = has(text, /\b(?:issue(?:d|s|r|ance)?|renew(?:al|ed|s|ing)?|application|biometric|e-?passport|ai passport|passport project|forg(?:ed|ery)|fake|counterfeit|fraud|false use|border|immigration|document security|travel document|passport control)\b/);
  return hasPassport && hasConcreteContext ? { accepted: true, reason: "passports_concrete_context" } : { accepted: false, reason: "passports_missing_concrete_context" };
}
export function shouldApplyDiscoveryFeedQualityGate({ hasProfile = false, hasExplicitFeedOrSource = false } = {}) {
  return !hasProfile && !hasExplicitFeedOrSource;
}
