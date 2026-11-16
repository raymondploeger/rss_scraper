function text(value) {
  return String(value || "").toLowerCase();
}

function articleText(article) {
  return [article?.title, article?.contentSnippet, article?.summary].map(text).join(" ");
}

function storedFamilyText(article) {
  return [article?.domains, article?.classifications]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .map(text)
    .join(" ");
}

function matches(value, pattern) {
  return pattern.test(value);
}

const IDENTITY_DOCUMENT_TERMS = /\b(?:passports?|e-?passports?|identity documents?|travel documents?|identity cards?|id cards?|national ids?|biometric passports?|electronic (?:identity )?documents?)\b/;
const BANKNOTE_TERMS = /\b(?:bank\s?notes?|currency notes?|cedi notes?|paper currency)\b/;
const DIGITAL_IDENTITY_TERMS = /\b(?:digital id(?:entity)?|e-?id|identity wallets?|(?:verifiable credentials?|\bvc\b)|m-?dl|mobile (?:driver'?s )?licen[cs]e|identity verification|document verification|biometric(?:s| identity| verification)?)\b/;
const STORED_IDENTITY_FAMILY = /\b(?:identity[_\s-]?(?:document|card|passport)|passports?|travel[_\s-]?document)\b/;
const STORED_BANKNOTE_FAMILY = /\b(?:bank[_\s-]?notes?|currency[_\s-]?notes?)\b/;
const STORED_DIGITAL_IDENTITY_FAMILY = /\b(?:digital[_\s-]?identity|identity[_\s-]?(?:verification|wallet)|e[_\s-]?id|verifiable[_\s-]?credential|m[_\s-]?dl)\b/;

const DOCUMENT_EVENT_CONTEXT = /\b(?:issu(?:e|es|ed|ing|ance)|renew(?:al|ed|ing|s)?|biometric|electronic document|e-?passport|regulation|regulatory|standard(?:s|isation|ization)?|roll-?out|deploy(?:ment|ed|ing)?|procure(?:ment|d|s|ing)?|contract|tender|document security|security feature|border system|border control|authority|issuer|issuing|counterfeit (?:programme|program|operation|ring|network|scheme)|fraud (?:programme|program|operation|ring|network|scheme))\b/;
const BANKNOTE_EVENT_CONTEXT = /\b(?:issu(?:e|es|ed|ing|ance)|redesign|new (?:bank\s?)?note|circulat(?:e|es|ed|ing|ion)|security (?:feature|features|ink|thread)|production|printing|printed|series|denomination|polymer|substrate|counterfeit (?:programme|program|operation|ring|network|scheme))\b/;
const DIGITAL_IDENTITY_EVENT_CONTEXT = /\b(?:roll-?out|deploy(?:ment|ed|ing)?|launch(?:es|ed|ing)?|release(?:s|d|ing)?|update(?:s|d|ing)?|standard(?:s|isation|ization)?|regulation|regulatory|partnership|contract|procure(?:ment|d|s|ing)?|tender|product|platform|system)\b/;

function candidateFamilies(article) {
  const content = articleText(article);
  const stored = storedFamilyText(article);
  return {
    identityDocuments: matches(content, IDENTITY_DOCUMENT_TERMS) || matches(stored, STORED_IDENTITY_FAMILY),
    banknotes: matches(content, BANKNOTE_TERMS) || matches(stored, STORED_BANKNOTE_FAMILY),
    digitalIdentity: matches(content, DIGITAL_IDENTITY_TERMS) || matches(stored, STORED_DIGITAL_IDENTITY_FAMILY),
  };
}

function isBorderBiometricSystemTitle(title) {
  return matches(title, /\b(?:border|entry|exit|airport|channel tunnel)\b/) && matches(title, /\bbiometric(?:s| identity| verification)?\b/);
}

/**
 * Client-only default-stream relevance policy. Stored classifications can nominate
 * a family for scrutiny, but acceptance always requires article title and context.
 */
export function assessDefaultFeedRelevance(article) {
  const title = text(article?.title);
  const content = articleText(article);
  const families = candidateFamilies(article);

  if (families.banknotes) {
    const accepted = matches(title, BANKNOTE_TERMS) && matches(content, BANKNOTE_EVENT_CONTEXT);
    return { accepted, family: "banknotes", reason: accepted ? "banknotes_title_subject_and_event" : "banknotes_missing_title_subject_or_event" };
  }

  if (families.digitalIdentity) {
    const accepted = matches(title, DIGITAL_IDENTITY_TERMS) && (
      matches(content, DIGITAL_IDENTITY_EVENT_CONTEXT) || isBorderBiometricSystemTitle(title)
    );
    return { accepted, family: "digital_identity", reason: accepted ? "digital_identity_title_subject_and_event" : "digital_identity_missing_title_subject_or_event" };
  }

  if (families.identityDocuments) {
    const accepted = matches(title, IDENTITY_DOCUMENT_TERMS) && matches(content, DOCUMENT_EVENT_CONTEXT);
    return { accepted, family: "identity_documents", reason: accepted ? "identity_documents_title_subject_and_event" : "identity_documents_missing_title_subject_or_event" };
  }

  return { accepted: true, family: "", reason: "family_neutral" };
}

export function shouldApplyDefaultFeedRelevanceGate({ hasProfile = false, hasExplicitFeedOrSource = false } = {}) {
  return !hasProfile && !hasExplicitFeedOrSource;
}
