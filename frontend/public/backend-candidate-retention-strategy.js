export function getBackendCandidateRetentionStrategy(options = {}) {
  const hasActivePersonalProfile = Boolean(options.hasActivePersonalProfile);
  const explicitSearch = String(options.explicitSearch || "").trim();
  const selectedFeed = Boolean(options.selectedFeed);
  const useCompleteProfileSearchCandidates = hasActivePersonalProfile && Boolean(explicitSearch) && !selectedFeed;

  return Object.freeze({
    completeCandidates: useCompleteProfileSearchCandidates,
    retainAllDedupedCandidates: useCompleteProfileSearchCandidates,
  });
}
