import assert from "node:assert/strict";
import fs from "node:fs";

const indexHtml = fs.readFileSync(new URL("../frontend/public/index.html", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../frontend/public/app.js", import.meta.url), "utf8");

assert.match(indexHtml, /Optional: why is this not useful\?/);
assert.match(indexHtml, /<option value="wrong_topic">Not relevant to me<\/option>/);
assert.match(indexHtml, /<option value="stale_or_duplicate">Duplicate or outdated<\/option>/);
assert.match(indexHtml, /<option value="noisy_source">Poor-quality page or source<\/option>/);
assert.match(indexHtml, /<option value="wrong_word_meaning">Wrong word meaning<\/option>/);
assert.match(indexHtml, /id="noise-feedback-cancel"[^>]*>Skip<\/button>/);
assert.match(appSource, /function openNoiseFeedbackDialog\(article\) \{[\s\S]*?hideNoiseArticle\(article\);[\s\S]*?scheduleRenderArticles\("noise-feedback-hide", \{ mode: "frame" \}\);/);
assert.match(appSource, /noiseFeedbackCancel\?\.addEventListener\("click", async \(\) => \{[\s\S]*?submitNoiseFeedback\(article, "wrong_topic"\)/);

console.log(JSON.stringify({ status: "passed", checks: 8 }));
