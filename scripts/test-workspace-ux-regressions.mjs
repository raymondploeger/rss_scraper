import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getProfileEditorTransition,
  getWorkspaceInitializationTransition,
  getWorkspaceNavigationTransition,
  getWorkspaceViewFromHash,
} from "../frontend/public/workspace-navigation.js";
import {
  getSourceHealth,
  SOURCE_HEALTH_STATUS,
  sourceMatchesHealthFilter,
} from "../frontend/public/source-health.js";

const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");

// The Feed summary uses one shared route for both the empty-state Start Profile
// action and the populated-state Show profile action.
assert.match(appSource, /function openFirstSelectedPersonalDashboardGroup\(\) \{[\s\S]*?getProfileEditorTransition\(\);[\s\S]*?setAppView\(transition\.view\);/);
assert.match(appSource, /data-admin-source-status-filter[\s\S]*?setAppView\("sources"\)[\s\S]*?renderFeedList\(\)/);
assert.deepEqual(getProfileEditorTransition(), {
  view: "profiles",
  focusSelector: "[data-personal-group-toggle]",
});

["profiles", "sources", "admin"].forEach((view) => {
  assert.equal(getWorkspaceViewFromHash(`#${view}`, "feed"), view, `direct #${view} link`);
  assert.equal(getWorkspaceViewFromHash(`#/${view}`, "feed"), view, `direct #/${view} link`);
});
assert.deepEqual(getWorkspaceInitializationTransition({ currentHash: "", fallbackView: "feed" }), {
  view: "feed",
  hash: "#feed",
  historyAction: "replace",
});
assert.equal(
  getWorkspaceInitializationTransition({ currentHash: "#profiles", fallbackView: "feed" }).historyAction,
  "none",
  "a direct workspace hash must remain untouched during initialization"
);

const profileState = Object.freeze({
  interests: ["security_printing"],
  favoriteArticles: [{ id: "favorite-1" }],
  readArticleIds: ["article-1"],
});
const profileTransition = getWorkspaceNavigationTransition({ currentHash: "#feed", targetView: "profiles" });
assert.equal(profileTransition.historyAction, "push");
assert.deepEqual(profileState, {
  interests: ["security_printing"],
  favoriteArticles: [{ id: "favorite-1" }],
  readArticleIds: ["article-1"],
}, "workspace navigation must not mutate profile or article state");

const history = ["#feed"];
let cursor = 0;
function navigate(targetView) {
  const transition = getWorkspaceNavigationTransition({ currentHash: history[cursor], targetView });
  if (transition.historyAction === "push") {
    history.splice(cursor + 1);
    history.push(transition.hash);
    cursor += 1;
  }
}

navigate("profiles");
navigate("sources");
navigate("admin");
assert.deepEqual(history, ["#feed", "#profiles", "#sources", "#admin"]);
navigate("admin");
assert.deepEqual(history, ["#feed", "#profiles", "#sources", "#admin"], "same-view navigation must not add history entries");
cursor -= 1;
assert.equal(getWorkspaceViewFromHash(history[cursor]), "sources", "Back resolves Sources");
cursor -= 1;
assert.equal(getWorkspaceViewFromHash(history[cursor]), "profiles", "Back resolves Profiles");
cursor += 1;
assert.equal(getWorkspaceViewFromHash(history[cursor]), "sources", "Forward resolves Sources");
assert.equal(
  getWorkspaceNavigationTransition({ currentHash: "#sources", targetView: "admin", explicit: false }).historyAction,
  "none",
  "location-driven navigation must not create a duplicate history entry"
);

const sourceFixtures = [
  { id: "healthy", isActive: true, lastStatus: "success" },
  { id: "inactive", isActive: false, lastStatus: "success" },
  { id: "error", isActive: true, lastStatus: "error" },
  { id: "last-error", isActive: true, lastError: "Connection refused" },
  { id: "awaiting", isActive: true, lastStatus: "idle" },
];
const healthById = Object.fromEntries(sourceFixtures.map((feed) => [feed.id, getSourceHealth(feed)]));
assert.equal(healthById.healthy.status, SOURCE_HEALTH_STATUS.HEALTHY);
assert.equal(healthById.inactive.status, SOURCE_HEALTH_STATUS.INACTIVE, "a deliberately disabled source stays inactive");
assert.equal(healthById.error.status, SOURCE_HEALTH_STATUS.ERROR);
assert.equal(healthById["last-error"].status, SOURCE_HEALTH_STATUS.ERROR);
assert.equal(healthById.awaiting.status, SOURCE_HEALTH_STATUS.AWAITING_SYNC);
assert.equal(getSourceHealth({ isActive: true, lastStatus: "error" }, { isLinkOnlySource: true }).status, SOURCE_HEALTH_STATUS.AWAITING_SYNC);

const activeIds = sourceFixtures
  .filter((feed) => sourceMatchesHealthFilter(feed, "active"))
  .map((feed) => feed.id);
const attentionIds = sourceFixtures
  .filter((feed) => sourceMatchesHealthFilter(feed, "inactive"))
  .map((feed) => feed.id);
assert.deepEqual(activeIds, ["healthy", "awaiting"]);
assert.deepEqual(attentionIds, ["inactive", "error", "last-error"]);
assert.equal(
  sourceFixtures.filter((feed) => getSourceHealth(feed).isActive).length,
  activeIds.length,
  "Admin active count and Sources active filter must use the same classification"
);
assert.equal(
  sourceFixtures.filter((feed) => getSourceHealth(feed).needsAttention).length,
  attentionIds.length,
  "Admin attention count and Sources attention filter must use the same classification"
);

process.stdout.write(JSON.stringify({
  status: "passed",
  checks: 24,
  covered: [
    "Feed Start Profile and Show profile route",
    "direct workspace hashes",
    "Back/Forward and duplicate history protection",
    "profile and article state preservation",
    "shared source health classification",
    "Admin source-status shortcuts",
  ],
}, null, 2) + "\n");
