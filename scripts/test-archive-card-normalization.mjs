import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeArchiveCard } from "../frontend/public/archive-card.js";

const card = normalizeArchiveCard({
  id: "archive-17",
  title: "Stored archive article",
  link: "https://example.test/archive-17",
  pubDate: "2026-11-01T12:00:00.000Z",
  source: "Example publisher",
  sourceName: "Example Publisher",
  feedId: "feed-17",
  topic: "Identity",
  // Archive cards deliberately ignore heavyweight or unneeded payload fields.
  summary: "x".repeat(100_000),
  contentSnippet: "y".repeat(100_000),
  keywords: ["heavyweight"],
  thumbnail: "https://example.test/image.jpg",
});

assert.deepEqual(card, {
  id: "archive-17",
  title: "Stored archive article",
  link: "https://example.test/archive-17",
  canonicalLink: "https://example.test/archive-17",
  pubDate: "2026-11-01T12:00:00.000Z",
  source: "Example Publisher",
  sourceName: "Example Publisher",
  feedId: "feed-17",
  topic: "Identity",
  isArchiveCard: true,
}, "archive cards retain only the stable card/action identity and display fields");

const defaults = normalizeArchiveCard({});
assert.ok(defaults.id.startsWith("archive:"), "missing IDs receive a stable local card identity");
assert.equal(defaults.title, "Untitled article");
assert.equal(defaults.link, "");
assert.equal(defaults.pubDate, "");
assert.equal(defaults.source, "Unknown source");
assert.equal(defaults.feedId, "");
assert.equal(defaults.topic, "General");

const appSource = await readFile(new URL("../frontend/public/app.js", import.meta.url), "utf8");
const archiveRenderer = appSource.match(/async function renderArchiveMode\(\) \{([\s\S]*?)\n\}/);
assert.ok(archiveRenderer, "archive renderer is available for regression coverage");
assert.match(archiveRenderer[1], /\.map\(normalizeArchiveCard\)/, "archive rendering uses the dedicated lightweight card normalizer");
assert.doesNotMatch(archiveRenderer[1], /normalizeLoadedArticle|primeArticleIntelligence|ensureArticleIntelligenceForArticles/, "archive rendering never starts the full intelligence bootstrap");
assert.match(appSource, /if \(article\?\.isArchiveCard && !article\.thumbnail\) return PLACEHOLDER_IMAGE;/, "archive cards with no optional image skip per-card generated image fallbacks");
const articleCardRenderer = appSource.match(/function renderArticleCard\(article\) \{([\s\S]*?)\n\}\n\nfunction renderDmvPlaceholderCard/);
assert.ok(articleCardRenderer, "normal card renderer is available for archive regression coverage");
assert.match(articleCardRenderer[1], /article\?\.isArchiveCard \? article\.topic : getArticleCardTopic\(article\)/, "archive cards do not run topic intelligence while rendering");
assert.match(articleCardRenderer[1], /if \(article\?\.isArchiveCard\) \{[\s\S]{0,120}whyArticle\.hidden = true;/, "archive cards retain normal actions while skipping decision-receipt intelligence");

console.log("Archive card normalization checks passed.");
