const DISCOVERY_FEED_NAMES = new Set(["ovd", "security features", "banknotes", "passports"]);

function normalizedText(article) {
  return [article?.title, article?.contentSnippet, article?.summary]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function has(text, pattern) {
  return pattern.test(text);
}

function isGoogleAlertFeed(feed) {
  try {
    const url = new URL(String(feed?.rssUrl || ""));
    return url.hostname === "www.google.com" && url.pathname.startsWith("/alerts/feeds/");
  } catch {
    return false;
  }
}

function hasSecurityPrintingContext(article) {
  return Array.isArray(article?.domains) && article.domains.includes("security_printing");
}

export function assessDiscoveryFeedQuality(feed, article) {
  const name = String(feed?.name || "").trim().toLowerCase();
  if (!isGoogleAlertFeed(feed) || !DISCOVERY_FEED_NAMES.has(name)) {
    return { accepted: true, reason: "discovery_feed_quality_not_applicable" };
  }

  const text = normalizedText(article);
  if (name === "ovd") {
    return hasSecurityPrintingContext(article)
      ? { accepted: true, reason: "ovd_document_security_context" }
      : { accepted: false, reason: "ovd_missing_document_security_context" };
  }

  if (name === "security features") {
    return hasSecurityPrintingContext(article)
      ? { accepted: true, reason: "security_features_document_security_context" }
      : { accepted: false, reason: "security_features_missing_document_security_context" };
  }

  if (name === "banknotes") {
    const hasBanknote = has(text, /\bbank\s?notes?\b|\bcurrency notes?\b/);
    const hasConcreteContext = has(text, /\b(?:central bank|reserve bank|\becb\b|\bbsp\b|issued?|issuance|circulat(?:e|es|ed|ing|ion)|unveils?|introduces?|launches?|new bank\s?note|design|redesign|security (?:feature|features|ink|thread)|hologram|counterfeit|anti-counterfeit|security printing|printed?|printing|production|survey|future|series|denomination|polymer|substrate|commemorative)\b/);
    return hasBanknote && hasConcreteContext
      ? { accepted: true, reason: "banknotes_concrete_context" }
      : { accepted: false, reason: "banknotes_missing_concrete_context" };
  }

  const hasPassport = has(text, /\bpassports?\b|\btravel documents?\b/);
  const hasConcreteContext = has(text, /\b(?:issue(?:d|s|r|ance)?|renew(?:al|ed|s|ing)?|application|biometric|e-?passport|ai passport|passport project|forg(?:ed|ery)|fake|counterfeit|fraud|false use|border|immigration|document security|travel document|passport control)\b/);
  return hasPassport && hasConcreteContext
    ? { accepted: true, reason: "passports_concrete_context" }
    : { accepted: false, reason: "passports_missing_concrete_context" };
}
