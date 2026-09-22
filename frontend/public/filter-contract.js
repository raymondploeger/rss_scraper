export const FILTER_CONTRACT_VERSION = 1;

export const FILTER_EVALUATION_ORDER = Object.freeze([
  "source_scope",
  "profile_policy",
  "interest_refinement",
  "quality_noise",
  "ranking",
]);

function uniqueStrings(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
}

function freezeContract(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeContract);
  return Object.freeze(value);
}

function normalizeSourceScope(source = {}) {
  const feedId = String(source.feedId || "").trim();
  const resolvedFeedId = String(source.resolvedFeedId || "").trim();
  const group = String(source.group || "all").trim() || "all";
  const trackedSourcesAll = Boolean(source.trackedSourcesAll && group === "all" && !feedId);
  const kind = feedId
    ? "feed"
    : trackedSourcesAll
      ? "tracked_all"
      : group !== "all"
        ? "group"
        : "global";

  return {
    kind,
    feedId,
    resolvedFeedId,
    group,
    trackedSourcesAll,
    sourceOnly: Boolean(source.sourceOnly && feedId),
    rule: "HARD_SCOPE",
    mayBypassProfile: false,
  };
}

function normalizeProfilePolicy(profile = {}) {
  const id = String(profile.id || "").trim();
  const definition = profile.definition && typeof profile.definition === "object"
    ? profile.definition
    : null;
  return {
    active: Boolean(id),
    id,
    label: String(profile.label || "").trim(),
    version: Math.max(1, Number.parseInt(String(profile.version || 1), 10) || 1),
    mode: String(profile.mode || "balanced").trim() || "balanced",
    strictness: String(profile.strictness || "").trim(),
    rule: id ? "REQUIRED" : "INACTIVE",
    domains: uniqueStrings(definition?.domains),
    requiredEvidence: uniqueStrings(definition?.requiredEvidence),
    preferredEvidence: uniqueStrings(definition?.preferredEvidence),
    excludedEvidence: uniqueStrings(definition?.excludedEvidence),
  };
}

function normalizeInterestSelection(interests = {}) {
  const selected = uniqueStrings(interests.selected);
  const byGroup = {};
  Object.entries(interests.byGroup || {}).forEach(([groupId, interestIds]) => {
    const normalizedGroupId = String(groupId || "").trim();
    if (!normalizedGroupId) {
      return;
    }
    byGroup[normalizedGroupId] = uniqueStrings(interestIds);
  });

  return {
    selected,
    byGroup,
    semantics: {
      withinGroup: "OR",
      acrossGroups: "AND",
      refinementToBaseScope: "AND",
      profileRelationship: "REFINE",
    },
  };
}

export function createFilterContract(input = {}) {
  const contract = {
    version: FILTER_CONTRACT_VERSION,
    executionMode: String(input.executionMode || "shadow_contract").trim() || "shadow_contract",
    evaluationOrder: FILTER_EVALUATION_ORDER.slice(),
    sourceScope: normalizeSourceScope(input.sourceScope),
    profilePolicy: normalizeProfilePolicy(input.profilePolicy),
    interestSelection: normalizeInterestSelection(input.interestSelection),
    qualityPolicy: {
      enabled: input.qualityPolicy?.enabled !== false,
      rule: "FINAL_GATE",
    },
    advancedFilters: {
      search: String(input.advancedFilters?.search || "").trim(),
      topic: String(input.advancedFilters?.topic || "").trim(),
      tag: String(input.advancedFilters?.tag || "").trim(),
      signal: String(input.advancedFilters?.signal || "").trim(),
      date: String(input.advancedFilters?.date || "").trim(),
      includeKeywords: uniqueStrings(input.advancedFilters?.includeKeywords),
      excludeKeywords: uniqueStrings(input.advancedFilters?.excludeKeywords),
    },
  };
  return freezeContract(contract);
}

export function serializeFilterContract(contract) {
  if (!contract) {
    return "";
  }
  return JSON.stringify(contract);
}
