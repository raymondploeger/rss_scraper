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

function feedMetadataText(feed) {
  return [feed?.name, feed?.rssUrl, feed?.source, feed?.sourceName].map(text).join(" ");
}

function matches(value, pattern) {
  return pattern.test(value);
}

const IDENTITY_DOCUMENT_TERMS = /\b(?:passports?|e-?passports?|identity documents?|travel documents?|identity cards?|id cards?|national ids?|driver'?s? licen[cs]e|driving licen[cs]e|biometric passports?|electronic (?:identity )?documents?)\b/;
const BANKNOTE_TERMS = /\b(?:bank\s?notes?|currency notes?|cedi notes?|paper currency)\b/;
const DIGITAL_IDENTITY_TERMS = /\b(?:digital id(?:entity)?|e-?id|identity wallets?|(?:verifiable credentials?|\bvc\b)|m-?dl|mobile (?:driver'?s )?licen[cs]e|identity verification|document verification|biometric(?:s| identity| verification)?)\b/;
const STORED_IDENTITY_FAMILY = /\b(?:identity[_\s-]?(?:document|card|passport)|passports?|travel[_\s-]?document)\b/;
const STORED_BANKNOTE_FAMILY = /\b(?:bank[_\s-]?notes?|currency[_\s-]?notes?)\b/;
const STORED_DIGITAL_IDENTITY_FAMILY = /\b(?:digital[_\s-]?identity|identity[_\s-]?(?:verification|wallet)|e[_\s-]?id|verifiable[_\s-]?credential|m[_\s-]?dl)\b/;
const FEED_IDENTITY_DOCUMENT_FAMILY = /\b(?:identity documents?|passports?|travel documents?|driver'?s? licen[cs]e|driving licen[cs]e)\b/;
const FEED_BANKNOTE_FAMILY = /\b(?:bank\s?notes?|paper currency|currency notes?|cedi)\b/;
const FEED_DIGITAL_IDENTITY_FAMILY = /\b(?:entry exit system|e-?id|digital identity|identity verification|biometric(?:s| identity| verification)?)\b/;

const DOCUMENT_EVENT_CONTEXT = /\b(?:issu(?:e|es|ed|ing|ance)|renew(?:al|ed|ing|s)?|biometric|electronic document|e-?passport|regulation|regulatory|standard(?:s|isation|ization)?|roll-?out|deploy(?:ment|ed|ing)?|procure(?:ment|d|s|ing)?|contract|tender|document security|security feature|border system|border control|authority|issuer|issuing|counterfeit (?:programme|program|operation|ring|network|scheme)|fraud (?:programme|program|operation|ring|network|scheme))\b/;
const BANKNOTE_EVENT_CONTEXT = /\b(?:issu(?:e|es|ed|ing|ance)|redesign|new (?:bank\s?)?note|circulat(?:e|es|ed|ing|ion)|security (?:feature|features|ink|thread)|production|printing|printed|series|denomination|polymer|substrate|counterfeit (?:programme|program|operation|ring|network|scheme))\b/;
const DIGITAL_IDENTITY_EVENT_CONTEXT = /\b(?:roll-?out|deploy(?:ment|ed|ing)?|launch(?:es|ed|ing)?|release(?:s|d|ing)?|update(?:s|d|ing)?|standard(?:s|isation|ization)?|regulation|regulatory|partnership|contract|procure(?:ment|d|s|ing)?|tender|product|platform|system)\b/;
const INDIVIDUAL_COUNTERFEIT_CONTEXT = /\b(?:arrest(?:ed|s)?|police|seiz(?:e|ed|ure)|suspect|young man|individual)\b/;
const COLLECTOR_OR_SOCIAL_CONTEXT = /\b(?:collector|collecting|collection|guide|values?|auction|coin shows?|moneta kolekcjonerska|instagram|facebook|tiktok|social media|marketplace|shop)\b/;
const PERSONAL_OR_CONSUMER_DOCUMENT_CONTEXT = /\b(?:personal|political|ploy|celebrity|tennis star|must apply|how to apply|applicant guidance|consumer|travel (?:advice|fears?|warning)|holiday)\b/;
const EMERGENCY_DISPATCH_FEED_CONTEXT = /\b(?:ovd|alarmeringen|emergency dispatch)\b/;
const FIREFIGHTING_DISPATCH_CONTEXT = /\b(?:brandweer|fire brigade|firefighters?|emergency dispatch|alarmering|gaslek|gas leak|uitgerukt|ter plaatse)\b/;
const CBP_FEED_CONTEXT = /\b(?:cbp|customs and border protection)\b/;
const INDIVIDUAL_ENFORCEMENT_CONTEXT = /\b(?:arrest(?:s|ed)?|warrant|arrested individual|outstanding warrant|charged|fugitive)\b/;
const DOCUMENT_OR_BIOMETRIC_BORDER_SYSTEM_CONTEXT = /\b(?:passport|travel document|identity document|biometric(?:s| identity| verification)?)\b/;
const BORDER_SYSTEM_EVENT_CONTEXT = /\b(?:border|port of entry|entry exit)\b[\s\S]{0,120}\b(?:system|deploy(?:ment|ed|ing)?|roll-?out|pilot|platform|verification|processing)\b|\b(?:system|deploy(?:ment|ed|ing)?|roll-?out|pilot|platform|verification|processing)\b[\s\S]{0,120}\b(?:border|port of entry|entry exit)\b/;
const DMV_FEED_CONTEXT = /\b(?:dmv|department of motor vehicles)\b/;
const DMV_SUBJECT_CONTEXT = /\b(?:driver'?s? licen[cs]e|driving licen[cs]e|motor vehicle|vehicle registration|registration|driving test)\b/;
const PERSONAL_CRIMINAL_PASSPORT_CONTEXT = /\b(?:convicted (?:criminal|offender)|criminal offender|convict(?:ed|ion)?|offender|criminal case|court (?:case|ruling)|legal case)\b/;
const INDIVIDUAL_PASSPORT_REQUEST_CONTEXT = /\b(?:seeks?|seeking|requests?|request(?:ed|ing)?|appl(?:y|ies|ied|ication)|bid|appeals?)\b[\s\S]{0,100}\b(?:new )?(?:passports?|travel documents?|national identity cards?|nids?)\b|\b(?:passports?|travel documents?|national identity cards?|nids?)\b[\s\S]{0,100}\b(?:request(?:ed|ing)?|application|bid|appeal)\b/;
const PERSONAL_POLITICAL_PASSPORT_ELIGIBILITY_CONTEXT = /\b(?:extradition|execution|exil(?:e|ed)|ousted|former (?:prime minister|president)|ex-?pm|prime minister|in-laws|legal scope|under any circumstances|ineligible|return plan)\b/;
const INDIVIDUAL_PASSPORT_DECISION_CONTEXT = /\b(?:refus(?:e|es|ed|ing)|den(?:y|ies|ied|ying)|reject(?:s|ed|ing)?|issu(?:e|es|ed|ing)|grant(?:s|ed|ing)?)\b[\s\S]{0,40}\b(?:new )?passport\b\s+(?:to|for)\b/;
const PASSPORT_SYSTEM_OR_REGULATION_CONTEXT = /\b(?:passport (?:system|programme|program|policy|regulation|rules)|issuance (?:system|policy|regulation)|passport (?:roll-?out|reform)|national passport)\b/;
const CONSUMER_SMART_HOME_BIOMETRIC_CONTEXT = /\b(?:homeview|smart[- ]home|shared household|household (?:device|access|control)|face id|paired iphone)\b/;

function candidateFamilies(article, feed) {
  const content = articleText(article);
  const stored = storedFamilyText(article);
  const feedMetadata = feedMetadataText(feed);
  return {
    identityDocuments: matches(content, IDENTITY_DOCUMENT_TERMS) || matches(stored, STORED_IDENTITY_FAMILY) || matches(feedMetadata, FEED_IDENTITY_DOCUMENT_FAMILY),
    banknotes: matches(content, BANKNOTE_TERMS) || matches(stored, STORED_BANKNOTE_FAMILY) || matches(feedMetadata, FEED_BANKNOTE_FAMILY),
    digitalIdentity: matches(content, DIGITAL_IDENTITY_TERMS) || matches(stored, STORED_DIGITAL_IDENTITY_FAMILY) || matches(feedMetadata, FEED_DIGITAL_IDENTITY_FAMILY),
  };
}

function isBorderBiometricSystemTitle(title) {
  return matches(title, /\b(?:border|entry|exit|airport|channel tunnel)\b/) && matches(title, /\bbiometric(?:s| identity| verification)?\b/);
}

/**
 * Client-only default-stream relevance policy. Stored classifications can nominate
 * a family for scrutiny, but acceptance always requires article title and context.
 */
export function assessDefaultFeedRelevance(article, feed = {}) {
  const title = text(article?.title);
  const content = articleText(article);
  const feedMetadata = feedMetadataText(feed);
  const families = candidateFamilies(article, feed);

  if (matches(feedMetadata, EMERGENCY_DISPATCH_FEED_CONTEXT) && matches(content, FIREFIGHTING_DISPATCH_CONTEXT)) {
    return { accepted: false, family: "", reason: "emergency_dispatch_alert_context" };
  }

  if (matches(feedMetadata, CBP_FEED_CONTEXT) && matches(content, INDIVIDUAL_ENFORCEMENT_CONTEXT) &&
    !(matches(content, DOCUMENT_OR_BIOMETRIC_BORDER_SYSTEM_CONTEXT) && matches(content, BORDER_SYSTEM_EVENT_CONTEXT))) {
    return { accepted: false, family: "", reason: "cbp_individual_enforcement_without_document_or_biometric_system" };
  }

  if (matches(feedMetadata, DMV_FEED_CONTEXT) && !matches(content, DMV_SUBJECT_CONTEXT)) {
    return { accepted: false, family: "", reason: "dmv_feed_missing_motor_vehicle_or_licensing_subject" };
  }

  if (families.banknotes) {
    const accepted = matches(title, BANKNOTE_TERMS) &&
      matches(content, BANKNOTE_EVENT_CONTEXT) &&
      !matches(content, COLLECTOR_OR_SOCIAL_CONTEXT) &&
      !(matches(content, INDIVIDUAL_COUNTERFEIT_CONTEXT) && !matches(content, /\b(?:programme|program|operation|ring|network|scheme)\b/));
    return { accepted, family: "banknotes", reason: accepted ? "banknotes_title_subject_and_event" : "banknotes_missing_title_subject_or_event" };
  }

  if (families.digitalIdentity) {
    if (matches(content, CONSUMER_SMART_HOME_BIOMETRIC_CONTEXT) && matches(content, /\bbiometric(?:s| identity| verification)?\b/)) {
      return { accepted: false, family: "digital_identity", reason: "consumer_smart_home_biometric_context" };
    }
    const accepted = matches(title, DIGITAL_IDENTITY_TERMS) && (
      matches(content, DIGITAL_IDENTITY_EVENT_CONTEXT) || isBorderBiometricSystemTitle(title)
    );
    return { accepted, family: "digital_identity", reason: accepted ? "digital_identity_title_subject_and_event" : "digital_identity_missing_title_subject_or_event" };
  }

  if (families.identityDocuments) {
    if (matches(title, /\bpassports?\b/) && matches(content, PERSONAL_CRIMINAL_PASSPORT_CONTEXT) && !matches(content, PASSPORT_SYSTEM_OR_REGULATION_CONTEXT)) {
      return { accepted: false, family: "identity_documents", reason: "personal_criminal_passport_context" };
    }
    if (matches(title, /\b(?:passports?|national identity cards?|nids?)\b/) && matches(content, INDIVIDUAL_PASSPORT_REQUEST_CONTEXT) && !matches(content, PASSPORT_SYSTEM_OR_REGULATION_CONTEXT)) {
      return { accepted: false, family: "identity_documents", reason: "individual_passport_request_context" };
    }
    if (matches(title, /\b(?:passports?|travel documents?|national identity cards?|nids?)\b/) && matches(content, PERSONAL_POLITICAL_PASSPORT_ELIGIBILITY_CONTEXT) && !matches(content, PASSPORT_SYSTEM_OR_REGULATION_CONTEXT)) {
      return { accepted: false, family: "identity_documents", reason: "personal_political_passport_eligibility_context" };
    }
    if (matches(title, /\bpassports?\b/) && matches(content, INDIVIDUAL_PASSPORT_DECISION_CONTEXT) && !matches(content, PASSPORT_SYSTEM_OR_REGULATION_CONTEXT)) {
      return { accepted: false, family: "identity_documents", reason: "individual_passport_decision_context" };
    }
    const accepted = matches(title, IDENTITY_DOCUMENT_TERMS) &&
      matches(content, DOCUMENT_EVENT_CONTEXT) &&
      !matches(content, PERSONAL_OR_CONSUMER_DOCUMENT_CONTEXT) &&
      !matches(content, COLLECTOR_OR_SOCIAL_CONTEXT);
    return { accepted, family: "identity_documents", reason: accepted ? "identity_documents_title_subject_and_event" : "identity_documents_missing_title_subject_or_event" };
  }

  return { accepted: true, family: "", reason: "family_neutral" };
}

export function shouldApplyDefaultFeedRelevanceGate({ hasProfile = false, hasExplicitFeedOrSource = false } = {}) {
  return !hasProfile && !hasExplicitFeedOrSource;
}
