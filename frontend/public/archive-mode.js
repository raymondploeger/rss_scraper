export const ARCHIVE_SCOPES = [30, 90, 180];

export function normalizeArchiveScope(scope) {
  const value = Number(scope);
  return ARCHIVE_SCOPES.includes(value) ? value : 30;
}

export function normalizeArchiveSearch(search) {
  return String(search || "").trim().replace(/\s+/g, " ");
}

export function getArchiveModeState({ requested, hasProfile, favoritesOnly = false, scope, cursor = null, search = "" } = {}) {
  return {
    active: Boolean(requested) && !Boolean(hasProfile) && !Boolean(favoritesOnly),
    scope: normalizeArchiveScope(scope),
    cursor: cursor || null,
    search: normalizeArchiveSearch(search),
  };
}

export function getNextArchivePageState(current, nextCursor) {
  return { ...current, cursor: nextCursor || null };
}

export function shouldApplyArchiveResponse({ requestId, activeRequestId, requested, hasProfile, favoritesOnly, requestScope, requestCursor, requestSearch, scope, cursor, search } = {}) {
  const mode = getArchiveModeState({ requested, hasProfile, favoritesOnly, scope, cursor, search });
  return requestId === activeRequestId && mode.active &&
    normalizeArchiveScope(requestScope) === mode.scope &&
    (requestCursor || null) === mode.cursor &&
    normalizeArchiveSearch(requestSearch) === mode.search;
}
