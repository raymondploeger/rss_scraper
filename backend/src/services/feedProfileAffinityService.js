const TOPIC_AFFINITIES = Object.freeze({
  "banknotes": ["central_bank"],
  "identity documents": ["passport_authority"],
  "digital identity & biometrics": ["identity_verification"],
  "shared security printing": ["security_printer"],
});

// These affinities describe what a source can credibly cover. They are not
// article-level matches: a matching article still needs content evidence in
// the classifier before it appears in a profile. Keeping the list here makes
// the policy reproducible for existing feeds as well as feeds restored from a
// database backup, instead of relying on a one-off database update.
const CURATED_SOURCE_AFFINITIES = Object.freeze({
  "aamva news": ["passport_authority", "identity_verification", "researcher"],
  "alpvision news": ["vendors", "security_printer", "identity_verification"],
  "austrian state printing office news": ["vendors", "passport_authority", "identity_verification"],
  "bank of canada news": ["central_bank", "researcher"],
  "banknotenews": ["central_bank", "researcher"],
  "biometric update": ["identity_verification", "researcher"],
  "cbp newsroom": ["border_control", "researcher"],
  "crane currency news & insights": ["vendors", "security_printer", "central_bank"],
  "dermalog news": ["vendors", "identity_verification", "border_control"],
  "european central bank press releases": ["central_bank", "researcher"],
  "european commission digital identity news": ["identity_verification", "researcher"],
  "eu-lisa updates": ["border_control", "identity_verification", "researcher"],
  "frontex newsroom": ["border_control", "researcher"],
  "g+d press releases": ["vendors", "security_printer", "passport_authority", "central_bank"],
  "hid press releases": ["vendors", "passport_authority", "identity_verification"],
  "hong kong immigration department news": ["passport_authority", "border_control", "researcher"],
  "icao newsroom": ["border_control", "passport_authority", "researcher"],
  "icao trip": ["border_control", "passport_authority", "researcher"],
  "idemia pressroom": ["vendors", "passport_authority", "identity_verification"],
  "identity week press releases": ["vendors", "passport_authority", "identity_verification"],
  "ircc passport and digital identity news": ["passport_authority", "border_control", "identity_verification", "researcher"],
  "joh. enschede": ["vendors", "security_printer", "central_bank"],
  "jura security printing": ["vendors", "security_printer"],
  "koenig & bauer banknote solutions": ["vendors", "security_printer", "central_bank"],
  "louisenthal press releases": ["vendors", "security_printer", "central_bank", "researcher"],
  "mri guide": ["central_bank", "researcher"],
  "mriguide": ["central_bank", "researcher"],
  "muehlbauer press": ["vendors", "passport_authority", "border_control", "security_printer"],
  "news.notafilia.pl": ["central_bank", "researcher"],
  "nist digital identity news": ["identity_verification", "researcher"],
  "ofs security printing insights": ["vendors", "security_printer", "central_bank", "passport_authority"],
  "openid foundation news": ["identity_verification", "researcher"],
  "ovd kinegram insights": ["vendors", "security_printer", "passport_authority"],
  "regula news": ["vendors", "passport_authority", "identity_verification"],
  "secunet press": ["vendors", "border_control", "identity_verification"],
  "signe security documents": ["vendors", "security_printer", "passport_authority"],
  "south african reserve bank news": ["central_bank", "researcher"],
  "thales digital identity newsroom": ["vendors", "passport_authority", "identity_verification"],
  "toppan security news": ["vendors", "passport_authority", "security_printer", "identity_verification"],
  "tsa press releases": ["border_control", "researcher"],
});

function normalizeSourceName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function getCuratedSourceProfileAffinities(feed = {}) {
  return CURATED_SOURCE_AFFINITIES[normalizeSourceName(feed.name)] || [];
}

export function resolveFeedProfileAffinities(feed = {}) {
  const explicit = Array.isArray(feed.profileAffinities) ? feed.profileAffinities : [];
  const topic = String(feed.topic || "").trim().toLowerCase();
  const inferred = TOPIC_AFFINITIES[topic] || [];
  const vendorAffinity = String(feed.sourceGroup || "").trim() === "Vendors" ? ["vendors"] : [];
  const curated = getCuratedSourceProfileAffinities(feed);
  return Array.from(new Set([...explicit, ...curated, ...inferred, ...vendorAffinity]));
}
