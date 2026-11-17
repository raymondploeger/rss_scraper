export function getSearchTokens(query = "") {
  return String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function articleMatchesSearchQuery(article, query, getSearchText) {
  const tokens = getSearchTokens(query);
  if (!tokens.length) {
    return true;
  }

  const searchText = String(getSearchText(article) || "").toLowerCase();
  return tokens.every((token) => searchText.includes(token));
}

export function reconcileGroupedSourcesForSearch(article, query, getSearchText) {
  const sources = Array.isArray(article?.sources) && article.sources.length
    ? article.sources
    : [article].filter(Boolean);
  const matchingSources = getSearchTokens(query).length
    ? sources.filter((source) => articleMatchesSearchQuery(source, query, getSearchText))
    : sources;

  return {
    primary: matchingSources[0] || null,
    sources: matchingSources,
  };
}
