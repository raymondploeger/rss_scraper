export const BUILT_IN_PROFILE_CACHE_IDS = Object.freeze([
  "central_bank", "passport_authority", "border_control", "security_printer", "vendors", "identity_verification", "researcher",
]);
export const PROFILE_CACHE_PAGE_SIZE = 30;

export function getProfileCachePageUrl(profileId, scope, cursor = "") {
  const params = new URLSearchParams({ scope: String(scope || "recent"), limit: String(PROFILE_CACHE_PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  return `/api/article-caches/${encodeURIComponent(profileId)}?${params.toString()}`;
}

export function createProfileCachePageState({ requestKey, response = {} } = {}) {
  return {
    requestKey: String(requestKey || ""),
    items: Array.isArray(response.items) ? response.items.slice(0, PROFILE_CACHE_PAGE_SIZE) : [],
    total: Math.max(0, Number(response.total) || 0),
    nextCursor: response.nextCursor || null,
  };
}

export function advanceProfileCachePage(current, { requestKey, response = {} } = {}) {
  if (!current || current.requestKey !== String(requestKey || "")) return null;
  return createProfileCachePageState({ requestKey, response });
}

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
