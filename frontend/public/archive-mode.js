export const ARCHIVE_SCOPES = [30, 90, 180];

export function normalizeArchiveScope(scope) {
  const value = Number(scope);
  return ARCHIVE_SCOPES.includes(value) ? value : 30;
}

export function getArchiveModeState({ requested, hasProfile, favoritesOnly = false, scope, cursor = null } = {}) {
  return {
    active: Boolean(requested) && !Boolean(hasProfile) && !Boolean(favoritesOnly),
    scope: normalizeArchiveScope(scope),
    cursor: cursor || null,
  };
}

export function getNextArchivePageState(current, nextCursor) {
  return { ...current, cursor: nextCursor || null };
}

export function shouldApplyArchiveResponse({ requestId, activeRequestId, requested, hasProfile, favoritesOnly, requestScope, requestCursor, scope, cursor } = {}) {
  const mode = getArchiveModeState({ requested, hasProfile, favoritesOnly, scope, cursor });
  return requestId === activeRequestId && mode.active &&
    normalizeArchiveScope(requestScope) === mode.scope &&
    (requestCursor || null) === mode.cursor;
}
