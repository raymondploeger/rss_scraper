import { listActiveWishlistItems, upsertArticleWishlistMatches } from "../database/wishlistRepository.js";

const DOCUMENT_TERMS = [
  "passport",
  "driving licence",
  "driving license",
  "licence",
  "license",
  "identity card",
  "id card",
  "residence permit",
  "residence card",
  "visa",
  "travel document",
  "laissez passer",
];

const IGNORED_WORDS = new Set([
  "all", "card", "document", "documents", "minor", "new", "old", "paper", "service", "specimen", "the",
]);

let cachedItems = [];
let cacheExpiresAt = 0;

export function normalizeWishlistText(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findDocumentTerms(value) {
  const text = normalizeWishlistText(value);
  return DOCUMENT_TERMS.filter((term) => text.includes(normalizeWishlistText(term)));
}

function getCountryTerms(item) {
  const normalizedTitle = normalizeWishlistText(item.title);
  const documentTerm = findDocumentTerms(normalizedTitle)[0];
  const countryPart = documentTerm
    ? normalizedTitle.slice(0, normalizedTitle.indexOf(normalizeWishlistText(documentTerm)))
    : normalizedTitle;

  return countryPart
    .split(" ")
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !IGNORED_WORDS.has(word));
}

function containsPhrase(text, phrase) {
  return text.includes(normalizeWishlistText(phrase));
}

function getImageCandidate(article) {
  const thumbnail = String(article?.thumbnail || "").trim();
  if (!/^https?:\/\//i.test(thumbnail) || /placeholder|source-title-card/i.test(thumbnail)) {
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
    article?.source,
  ].filter(Boolean).join(" "));

  if (!searchableText) return [];

  return items.flatMap((item) => {
    const countryTerms = getCountryTerms(item);
    const documentTerms = findDocumentTerms(item.title).filter((term) => containsPhrase(searchableText, term));
    const countryMatches = countryTerms.filter((term) => searchableText.includes(term));
    const titleWithoutYear = normalizeWishlistText(item.title).replace(/\b\d{4}\b/g, "").trim();
    const exactTitleFamily = titleWithoutYear.length >= 8 && searchableText.includes(titleWithoutYear);
    const hasCountry = countryTerms.length > 0 && countryMatches.length === countryTerms.length;
    const hasDocument = documentTerms.length > 0;

    if (!exactTitleFamily && !(hasCountry && hasDocument)) {
      return [];
    }

    const year = (String(item.title).match(/\b(19|20)\d{2}\b/) || [])[0];
    const hasYear = Boolean(year && searchableText.includes(year));
    const confidence = exactTitleFamily || (hasCountry && hasDocument && hasYear) ? "strong" : "candidate";
    const matchedTerms = Array.from(new Set([
      ...countryMatches,
      ...documentTerms.map((term) => normalizeWishlistText(term)),
      ...(hasYear ? [year] : []),
    ]));

    return [{
      wishlistItemId: item.id,
      confidence,
      matchedTerms,
      imageCandidate: getImageCandidate(article),
    }];
  });
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
  if (!matches.length) return [];
  await upsertArticleWishlistMatches(article.id, matches);
  return matches;
}
