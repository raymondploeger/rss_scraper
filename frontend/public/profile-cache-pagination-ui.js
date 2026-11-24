function formatCount(value) {
  return Math.max(0, Number(value) || 0).toLocaleString();
}

export function createProfileCachePaginationControl({ response = {}, fetchNextPage } = {}) {
  const visibleCount = Array.isArray(response.items) ? response.items.length : 0;
  const total = Math.max(0, Number(response.total) || 0);
  const nextCursor = response.nextCursor || null;
  const canFetchNextPage = Boolean(nextCursor && typeof fetchNextPage === "function");

  return {
    visibleCountLabel: `${formatCount(visibleCount)} of ${formatCount(total)}`,
    nextLabel: "Load more results",
    canFetchNextPage,
    fetchNextPage: () => canFetchNextPage ? fetchNextPage(nextCursor) : Promise.resolve(null),
  };
}

export function shouldPreserveProfileCachePagination({ profileCache = false } = {}) {
  return Boolean(profileCache);
}
