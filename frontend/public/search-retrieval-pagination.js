function getResponseItems(response) {
  return Array.isArray(response?.items)
    ? response.items
    : Array.isArray(response?.articles) ? response.articles : [];
}

function getItemKey(item) {
  return String(item?.id || item?.canonicalLink || item?.link || "").trim().toLowerCase();
}

export function getSearchRetrievalStrategy(options = {}) {
  const hasActivePersonalProfile = Boolean(options.hasActivePersonalProfile);
  const explicitSearch = String(options.explicitSearch || "").trim();
  const selectedFeed = Boolean(options.selectedFeed);
  const complete = hasActivePersonalProfile && Boolean(explicitSearch) && !selectedFeed;
  const progressive = Boolean(explicitSearch) && !complete;

  return Object.freeze({
    mode: complete ? "complete" : progressive ? "progressive" : "bounded",
    completeCandidates: complete,
    retainAllDedupedCandidates: complete,
    progressive,
  });
}

export function appendProgressiveCandidatePage(previous, response) {
  const previousItems = getResponseItems(previous);
  const items = previousItems.slice();
  const seen = new Set(items.map(getItemKey).filter(Boolean));
  getResponseItems(response).forEach((item) => {
    const key = getItemKey(item);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push(item);
  });

  const previousPagination = previous?.pagination || {};
  const pagination = response?.pagination || {};
  const page = Math.max(1, Number(pagination.page || previousPagination.page) || 1);
  const limit = Math.max(1, Number(pagination.limit || previousPagination.limit) || 1);
  const total = Math.max(0, Number(pagination.total ?? previousPagination.total) || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages) || Math.ceil(total / limit) || 1);
  const loadedPages = Math.max(Number(previousPagination.loadedPages) || 0, page);

  return {
    ...response,
    items,
    articles: items,
    pagination: {
      ...pagination,
      page,
      limit,
      total,
      totalPages,
      loadedPages,
      hasMorePages: loadedPages < totalPages,
    },
  };
}
