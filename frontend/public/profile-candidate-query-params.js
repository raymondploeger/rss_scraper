export function appendProfileCandidateSearchTerms(params, searches = []) {
  const normalized = Array.from(new Set((Array.isArray(searches) ? searches : [])
    .map((term) => String(term || "").trim())
    .filter(Boolean)));
  params.delete("searchTerms");
  normalized.forEach((term) => params.append("searchTerms", term));
  return params;
}
