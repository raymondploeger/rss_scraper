import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../frontend/public/index.html", import.meta.url), "utf8");

assert.match(
  appSource,
  /eyebrow = "Recent overview";[\s\S]*?title = "Recent overview";[\s\S]*?fast, filtered overview of the selected \$\{profileLookbackDays\} days — not the full archive/,
  "an unprofiled 7/30-day feed must be labelled as a bounded Recent overview"
);
assert.match(
  indexSource,
  /id="intelligence-feed-eyebrow" class="eyebrow">Recent overview<\/p>[\s\S]*?id="intelligence-feed-title">Recent overview<\/h2>[\s\S]*?id="intelligence-feed-summary" class="intelligence-feed-summary">A fast, filtered overview of the selected 30 days — not the full archive<\/p>/,
  "the initial accessible header must communicate the bounded overview before the first render"
);
assert.match(
  appSource,
  /title = `\$\{profileDisplay\.label \|\| "Custom profile"\} · \$\{sourceLabel\}`;[\s\S]*?matched your profile within selected sources from \$\{profileTimeframeLabel\}/,
  "profile-and-source complete-cache messaging must remain unchanged"
);
assert.match(
  appSource,
  /title = profileDisplay\.label \|\| "Custom profile";[\s\S]*?matched your profile across all sources from \$\{profileTimeframeLabel\}/,
  "profile complete-cache messaging must remain unchanged"
);

process.stdout.write("unprofiled feed overview copy: passed\n");
