import assert from "node:assert/strict";
import { shouldStartBackendQuery } from "../frontend/public/backend-query-loading-state.js";

assert.equal(
  shouldStartBackendQuery({ loading: false, loadingKey: "", queryKey: "profile:30" }),
  true,
  "an idle query runner starts the requested query"
);
assert.equal(
  shouldStartBackendQuery({ loading: true, loadingKey: "profile:90", queryKey: "profile:90" }),
  false,
  "the active query is not started twice"
);
assert.equal(
  shouldStartBackendQuery({ loading: true, loadingKey: "profile:90", queryKey: "profile:30" }),
  true,
  "a changed date scope replaces an obsolete in-flight query"
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 3 })}\n`);
