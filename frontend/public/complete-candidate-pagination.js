import { splitProfileHistoryDateRange } from "./profile-history-scope.js";
import { getCanonicalCandidateKey } from "./search-retrieval-pagination.js";

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

function mergeAdaptiveResponses(responses = []) {
  const items = [];
  const seen = new Set();
  for (const response of responses) {
    for (const item of getResponseItems(response)) {
      const key = getCanonicalCandidateKey(item);
      if (!key || key === "id:" || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return {
    items,
    articles: items,
    totalCount: items.length,
    pagination: {
      page: 1,
      limit: Math.max(1, items.length),
      total: items.length,
      totalPages: 1,
      loadedPages: 1,
    },
  };
}

export async function fetchAdaptiveCompleteCandidatePages(params, requestPage, options = {}) {
  const initialParams = new URLSearchParams(params);
  if (initialParams.get("completeCandidates") !== "true") {
    return fetchCompleteCandidatePages(initialParams, requestPage);
  }
  const attempt = async (attemptParams) => {
    try {
      return [await fetchCompleteCandidatePages(attemptParams, requestPage)];
    } catch (error) {
      if (!["CANDIDATE_SNAPSHOT_SOURCE_LIMIT", "CANDIDATE_SNAPSHOT_COMPOSITE_LIMIT"].includes(error?.code)) throw error;
      const ranges = splitProfileHistoryDateRange({
        from: attemptParams.get("from"),
        to: attemptParams.get("to"),
      }, options.now, options.minimumWindowDays);
      if (!ranges.length) throw error;
      const responses = [];
      for (const range of ranges) {
        const splitParams = new URLSearchParams(attemptParams);
        splitParams.set("from", range.from);
        if (range.to) splitParams.set("to", range.to);
        else splitParams.delete("to");
        splitParams.set("page", "1");
        splitParams.delete("candidateSnapshotId");
        responses.push(...await attempt(splitParams));
      }
      return responses;
    }
  };

  return mergeAdaptiveResponses(await attempt(new URLSearchParams(params)));
}
