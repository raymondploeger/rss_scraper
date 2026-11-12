import { listActiveWishlistItems, upsertArticleWishlistMatches } from "../database/wishlistRepository.js";

const DOCUMENT_TERMS = [
  "driving license",
  "license",
  "passport",
  "identity card",
  "id card",
  "residence permit",
  "residence card",
  "visa",
  "travel document",
  "laissez passer",
];

const IGNORED_WORDS = new Set([
  "all", "card", "document", "documents", "the",
]);

let cachedItems = [];
let cacheExpiresAt = 0;

export function normalizeWishlistText(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\blicence\b/g, "license")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findDocumentTerms(value) {
  const text = normalizeWishlistText(value);
  return DOCUMENT_TERMS.filter((term) => containsPhrase(text, term));
}

function getItemRequirements(item) {
  const normalizedTitle = normalizeWishlistText(item.title);
  const documentTerm = findDocumentTerms(normalizedTitle)[0];
  if (!documentTerm) return null;

  const documentIndex = normalizedTitle.indexOf(documentTerm);
  const countryTerms = normalizedTitle
    .slice(0, documentIndex)
    .split(" ")
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !IGNORED_WORDS.has(word));
  const qualifierTerms = normalizedTitle
    .slice(documentIndex + documentTerm.length)
    .split(" ")
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !IGNORED_WORDS.has(word));
  const years = normalizedTitle.match(/\b(?:19|20)\d{2}\b/g) || [];

  return { countryTerms, documentTerm, qualifierTerms, years };
}

function containsPhrase(text, phrase) {
  const normalizedPhrase = normalizeWishlistText(phrase);
  return Boolean(normalizedPhrase && ` ${text} `.includes(` ${normalizedPhrase} `));
}

function containsWholeWord(text, word) {
  const escapedWord = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapedWord}\\b`, "i").test(text);
}

function getImageCandidate(article) {
  const thumbnail = String(article?.thumbnail || "").trim();
  if (!/^https?:\/\//i.test(thumbnail) || /placeholder|placehold\.co|source-title-card/i.test(thumbnail)) {
    return null;
  }
  return thumbnail;
}

export function matchArticleAgainstWishlist(article, items = []) {
  const searchableText = normalizeWishlistText([
    article?.title,
    article?.summary,
    article?.summaryShort,
    article?.contentSnippet,
  ].filter(Boolean).join(" "));

  if (!searchableText) return [];

  const qualifiedMatches = items.flatMap((item) => {
    if (item?.isActive === false || String(item?.workflowStatus || "").trim().toLowerCase() === "completed") {
      return [];
    }

    const requirements = getItemRequirements(item);
    if (!requirements || !requirements.countryTerms.length) return [];
    const countryMatches = requirements.countryTerms.filter((term) => containsWholeWord(searchableText, term));
    const qualifierMatches = requirements.qualifierTerms.filter((term) => containsWholeWord(searchableText, term));
    const hasAllRequirements = countryMatches.length === requirements.countryTerms.length
      && containsPhrase(searchableText, requirements.documentTerm)
      && qualifierMatches.length === requirements.qualifierTerms.length
      && requirements.years.every((year) => containsWholeWord(searchableText, year));

    if (!hasAllRequirements) return [];

    const matchedTerms = Array.from(new Set([
      ...countryMatches,
      requirements.documentTerm,
      ...qualifierMatches,
      ...requirements.years,
    ]));

    return [{
      wishlistItemId: item.id,
      confidence: "strong",
      matchedTerms,
      imageCandidate: getImageCandidate(article),
    }];
  });

  if (qualifiedMatches.length !== 1) return [];
  return qualifiedMatches;
}

async function getActiveWishlistItems() {
  if (Date.now() < cacheExpiresAt) return cachedItems;
  cachedItems = await listActiveWishlistItems();
  cacheExpiresAt = Date.now() + 5 * 60 * 1000;
  return cachedItems;
}

export function clearWishlistItemCache() {
  cachedItems = [];
  cacheExpiresAt = 0;
}

export async function matchAndStoreArticleWishlistSignals(article) {
  if (!article?.id) return [];
  const items = await getActiveWishlistItems();
  const matches = matchArticleAgainstWishlist(article, items);
  await upsertArticleWishlistMatches(article.id, matches);
  return matches;
}
