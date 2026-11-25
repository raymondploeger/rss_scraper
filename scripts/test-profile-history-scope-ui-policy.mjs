import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getAvailableArticleHistoryScopes,
  normalizeArticleHistoryScopeForUi,
} from "../frontend/public/profile-history-scope.js";

assert.deepEqual(
  getAvailableArticleHistoryScopes({ hasActiveProfile: false }),
  ["7", "30"],
  "An unprofiled feed must offer only the short generic history scopes."
);
assert.equal(normalizeArticleHistoryScopeForUi("recent", { hasActiveProfile: false }), "30");
assert.equal(normalizeArticleHistoryScopeForUi("extended", { hasActiveProfile: false }), "30");
assert.equal(normalizeArticleHistoryScopeForUi("", { hasActiveProfile: false }), "30");
assert.equal(normalizeArticleHistoryScopeForUi("7", { hasActiveProfile: false }), "7");
assert.equal(normalizeArticleHistoryScopeForUi("30", { hasActiveProfile: false }), "30");

assert.deepEqual(
  getAvailableArticleHistoryScopes({ hasActiveProfile: true }),
  ["7", "30", "recent", "extended"],
  "An active profile must retain its complete history-scope menu."
);
assert.equal(normalizeArticleHistoryScopeForUi("recent", { hasActiveProfile: true }), "recent");
assert.equal(normalizeArticleHistoryScopeForUi("extended", { hasActiveProfile: true }), "extended");

const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");
assert.match(appSource, /periodScope: "30"/, "The unprofiled state must default to 30 days.");
assert.match(
  appSource,
  /option\.hidden = !availableScopes\.has\(option\.value\)/,
  "The rendered selector must hide scopes unavailable without a profile."
);
assert.match(
  appSource,
  /getProfileHistoryDateRanges\(normalizeArticleHistoryScopeForUi\(state\.filters\.periodScope\)\)/,
  "Generic 7/30 selections must still produce the existing from-query date range."
);

process.stdout.write("profile history scope UI policy: passed\n");
