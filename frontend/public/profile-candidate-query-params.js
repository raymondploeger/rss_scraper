export function appendProfileCandidateSearchTerms(params, searches = []) {
  const target = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const normalizedSearches = Array.from(new Set((Array.isArray(searches) ? searches : [])
    .map((term) => String(term || "").trim())
    .filter(Boolean)));
  target.delete("searchTerms");
  normalizedSearches.forEach((search) => target.append("searchTerms", search));
  return target;
}
