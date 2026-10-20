export const WORKSPACE_VIEWS = Object.freeze(["feed", "profiles", "sources", "admin"]);

const WORKSPACE_VIEW_SET = new Set(WORKSPACE_VIEWS);

export function normalizeWorkspaceView(value) {
  const view = String(value || "").trim().toLowerCase();
  return WORKSPACE_VIEW_SET.has(view) ? view : "feed";
}

export function getWorkspaceViewFromHash(hash, fallbackView = "feed") {
  const hashView = String(hash || "").replace(/^#\/?/, "").trim().toLowerCase();
  return WORKSPACE_VIEW_SET.has(hashView) ? hashView : normalizeWorkspaceView(fallbackView);
}

export function getWorkspaceHash(view) {
  return `#${normalizeWorkspaceView(view)}`;
}

export function getWorkspaceNavigationTransition({
  currentHash = "",
  targetView,
  explicit = true,
} = {}) {
  const view = normalizeWorkspaceView(targetView);
  const hash = getWorkspaceHash(view);
  return {
    view,
    hash,
    historyAction: explicit && String(currentHash || "") !== hash ? "push" : "none",
  };
}

export function getWorkspaceInitializationTransition({ currentHash = "", fallbackView = "feed" } = {}) {
  const view = getWorkspaceViewFromHash(currentHash, fallbackView);
  const hash = getWorkspaceHash(view);
  return {
    view,
    hash,
    historyAction: String(currentHash || "") === hash ? "none" : "replace",
  };
}

export function getProfileEditorTransition() {
  return {
    view: "profiles",
    focusSelector: "[data-personal-group-toggle]",
  };
}
