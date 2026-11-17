import assert from "node:assert/strict";
import {
  articleMatchesSearchQuery,
  reconcileGroupedSourcesForSearch,
} from "../frontend/public/search-presentation.js";

const ghanaBanknotesArticle = {
  id: "ghana-banknotes",
  title: "Ghana: central bank unveils Heritage Series cedi banknotes",
};

assert.equal(
  articleMatchesSearchQuery(ghanaBanknotesArticle, "ghana banknotes", (article) => article.title),
  true,
  "whitespace-separated search terms must be ANDed independently rather than treated as one exact phrase"
);

const capeVerdePrimary = {
  id: "cape-verde",
  title: "Cape Verde President Neves wins second term - Reuters",
};
const ghanaRelated = {
  id: "ghana-related",
  title: "Bank of Ghana announces cedi banknotes update",
};
const searchPresentation = reconcileGroupedSourcesForSearch({
  ...capeVerdePrimary,
  sources: [capeVerdePrimary, ghanaRelated],
}, "ghana", (article) => article.title);

assert.equal(
  searchPresentation.primary.id,
  "ghana-related",
  "a grouped search result must promote a matching member instead of an unrelated primary"
);
assert.deepEqual(
  searchPresentation.sources.map((article) => article.id),
  ["ghana-related"],
  "a grouped search result must retain only matching sources"
);

assert.equal(
  articleMatchesSearchQuery(ghanaBanknotesArticle, "ghana", (article) => article.title),
  true,
  "single-term search behavior must remain supported"
);

const noSearchPresentation = reconcileGroupedSourcesForSearch({
  ...capeVerdePrimary,
  sources: [capeVerdePrimary, ghanaRelated],
}, "", (article) => article.title);
assert.equal(
  noSearchPresentation.primary.id,
  "cape-verde",
  "blank search must preserve the existing grouped representative"
);
assert.deepEqual(
  noSearchPresentation.sources.map((article) => article.id),
  ["cape-verde", "ghana-related"],
  "blank search must preserve all grouped sources"
);

assert.equal(
  articleMatchesSearchQuery(
    { title: "Ghana: central bank unveils Heritage Series cedi banknotes" },
    "ghana banknotes",
    (article) => article.title
  ),
  true,
  "token search must retain relevant Heritage Series banknote entries when terms are non-adjacent"
);

assert.equal(
  searchPresentation.primary.id === "cape-verde",
  false,
  "an unrelated group member must never become the visible representative for an active search"
);

console.log("Search grouping presentation checks passed.");
