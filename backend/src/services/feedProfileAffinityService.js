const TOPIC_AFFINITIES = Object.freeze({
  "banknotes": ["central_bank"],
  "identity documents": ["passport_authority"],
  "digital identity & biometrics": ["identity_verification"],
  "shared security printing": ["security_printer"],
});

export function resolveFeedProfileAffinities(feed = {}) {
  const explicit = Array.isArray(feed.profileAffinities) ? feed.profileAffinities : [];
  const topic = String(feed.topic || "").trim().toLowerCase();
  const inferred = TOPIC_AFFINITIES[topic] || [];
  const vendorAffinity = String(feed.sourceGroup || "").trim() === "Vendors" ? ["vendors"] : [];
  return Array.from(new Set([...explicit, ...inferred, ...vendorAffinity]));
}
