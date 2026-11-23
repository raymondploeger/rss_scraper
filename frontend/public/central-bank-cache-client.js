export function shouldUseCentralBankCacheResponse(response = {}) {
  return ["ready", "stale", "building", "error"].includes(response.state);
}

export function shouldFallbackToLiveCentralBankArticles(response = {}) {
  return response.state === "never-built";
}
