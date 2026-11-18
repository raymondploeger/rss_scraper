function getResponseItems(response) {
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  return Array.isArray(response?.articles) ? response.articles : [];
}

export async function fetchCompleteCandidatePages(params, requestPage) {
  const firstParams = new URLSearchParams(params);
  const firstResponse = await requestPage(firstParams);
  if (firstParams.get("completeCandidates") !== "true") {
    return firstResponse;
  }

  const pagination = firstResponse?.pagination || {};
  const candidateSnapshotId = String(firstResponse?.candidateSnapshotId || "").trim();
  const pageSize = Math.max(1, Number(pagination.limit || firstResponse?.limit) || 1);
  const totalCount = Math.max(0, Number(pagination.total || firstResponse?.totalCount) || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages) || Math.ceil(totalCount / pageSize));
  if (totalPages > 1 && !candidateSnapshotId) {
    throw new Error("Complete candidate pagination requires a candidateSnapshotId for multi-page results.");
  }
  const allItems = getResponseItems(firstResponse).slice();

  for (let page = 2; page <= totalPages; page += 1) {
    const pageParams = new URLSearchParams(firstParams);
    pageParams.set("page", String(page));
    if (candidateSnapshotId) pageParams.set("candidateSnapshotId", candidateSnapshotId);
    const pageResponse = await requestPage(pageParams);
    allItems.push(...getResponseItems(pageResponse));
  }

  return {
    ...firstResponse,
    items: allItems,
    articles: allItems,
    pagination: {
      ...pagination,
      total: totalCount,
      totalPages,
      loadedPages: totalPages,
    },
  };
}
