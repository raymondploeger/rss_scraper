export const BUILT_IN_PROFILE_CACHE_IDS = Object.freeze([
  "central_bank", "passport_authority", "border_control", "security_printer", "vendors", "identity_verification", "researcher",
]);

export function getPersistentProfileCacheSelection({ profileId, exactProfile = true, filters = {} } = {}) {
  const exactBuiltIn = BUILT_IN_PROFILE_CACHE_IDS.includes(profileId);
  const hasFilter = Boolean(
    filters.feedId || filters.sourceGroup && filters.sourceGroup !== "all" || filters.topic || filters.tag ||
    filters.signalCategory || filters.search || filters.date || filters.favoritesOnly || filters.trackedSourcesAll !== true
  );
  return { profileId, eligible: exactBuiltIn && exactProfile && !hasFilter };
}

export function shouldUseProfileCacheResponse(response = {}) {
  return ["ready", "stale", "building", "error"].includes(response.state);
}

export function shouldFallbackToLiveProfileArticles(response = {}) {
  return response.state === "never-built";
}
