import { getSearchRetrievalStrategy } from "./search-retrieval-pagination.js";

export function getBackendCandidateRetentionStrategy(options = {}) {
  const strategy = getSearchRetrievalStrategy(options);
  return Object.freeze({
    completeCandidates: strategy.completeCandidates,
    retainAllDedupedCandidates: strategy.retainAllDedupedCandidates,
  });
}
