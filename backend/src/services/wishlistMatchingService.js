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

const DOCUMENT_TERM_EQUIVALENTS = {
  "id card": ["id card", "identity card"],
  "identity card": ["identity card", "id card"],
};

const COUNTRY_TERM_EQUIVALENTS = {
  slovenia: ["slovenia", "slovenian"],
};

const IGNORED_WORDS = new Set([
  "all", "card", "document", "documents", "the",
]);

const NEW_DOCUMENT_FORMULATION = "new\\s+(?:[a-z]+\\s+)?(?:documents?|cards?|passports?|visas?|permits?)";
const POSITIVE_DOCUMENT_SIGNAL = new RegExp(`\\b(?:issu(?:e|ed|es|ing)|launch(?:ed|es|ing)?|introduc(?:e|ed|es|ing|tion)|unveil(?:ed|s|ing)?|present(?:ed|s|ing)?|contract\\s+signed|comes?\\s+into\\s+force|${NEW_DOCUMENT_FORMULATION}|design|redesign|personali[sz]ation|produc(?:ed|tion|ing)|security[ -]upgraded|security\\s+features?|specimen|rollout)\\b`, "i");
const STRONG_DOCUMENT_SIGNAL = new RegExp(`\\b(?:issu(?:e|ed|es|ing)|launch(?:ed|es|ing)?|contract\\s+signed|comes?\\s+into\\s+force|${NEW_DOCUMENT_FORMULATION}|design|redesign|personali[sz]ation|produc(?:ed|tion|ing)|security[ -]upgraded|security\\s+features?|specimen|rollout)\\b`, "i");
const GENERAL_CONTEXT = /\b(?:passport\s+(?:ranking|index)|visa[ -]free\s+travel|travel\s+advice|citizenship|naturalization|passport\s+(?:revoked|removed)|(?:migration|immigration)\s+(?:policy|reform)|(?:policy|general)\s+biometrics|visa\s+policy)\b/i;
const VISA_PAYMENT_CONTEXT = /\b(?:visa\s+(?:infinite|debit|credit|signature|platinum|electron|payment|card)|(?:payment|bank|credit|debit)\s+cards?|samsung\s+wallet|cardholder|contactless)\b/i;
const CALENDAR_MONTHS = new Map([
  ["january", 0], ["february", 1], ["march", 2], ["april", 3], ["may", 4], ["june", 5],
  ["july", 6], ["august", 7], ["september", 8], ["october", 9], ["november", 10], ["december", 11],
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
  const allQualifierTerms = normalizedTitle
    .slice(documentIndex + documentTerm.length)
    .split(" ")
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !IGNORED_WORDS.has(word));
  const years = normalizedTitle.match(/\b(?:19|20)\d{2}\b/g) || [];
  const calendarMonth = allQualifierTerms.map((term) => CALENDAR_MONTHS.get(term)).find(Number.isInteger);
  const qualifierTerms = allQualifierTerms.filter((term) => !CALENDAR_MONTHS.has(term));

  return { countryTerms, documentTerm, qualifierTerms, years, calendarMonth };
}

function containsPhrase(text, phrase) {
  const normalizedPhrase = normalizeWishlistText(phrase);
  return Boolean(normalizedPhrase && ` ${text} `.includes(` ${normalizedPhrase} `));
}

function containsWholeWord(text, word) {
  const escapedWord = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapedWord}\\b`, "i").test(text);
}

function getArticlePassages(article) {
  const fields = [article?.title, article?.summary, article?.summaryShort, article?.contentSnippet];
  return fields.flatMap((field) => String(field || "")
    .split(/[.!?]+|\n+/)
    .map(normalizeWishlistText)
    .filter(Boolean));
}

function containsAllNonYearTerms(passage, requirements) {
  return requirements.countryTerms.every((term) => containsCountryTerm(passage, term))
    && containsDocumentTerm(passage, requirements.documentTerm)
    && requirements.qualifierTerms.every((term) => containsWholeWord(passage, term));
}

function containsCountryTerm(passage, countryTerm) {
  const equivalents = COUNTRY_TERM_EQUIVALENTS[countryTerm] || [countryTerm];
  return equivalents.some((term) => containsWholeWord(passage, term));
}

function containsDocumentTerm(passage, documentTerm) {
  const equivalents = DOCUMENT_TERM_EQUIVALENTS[documentTerm] || [documentTerm];
  return equivalents.some((term) => containsPhrase(passage, term) || containsPhrase(passage, `${term}s`));
}

function hasNearbyYears(passages, passageIndex, years) {
  if (!years.length) return true;
  return years.every((year) => [passages[passageIndex - 1], passages[passageIndex], passages[passageIndex + 1]]
    .filter(Boolean)
    .some((passage) => containsWholeWord(passage, year)));
}

function hasMatchingPublicationMonth(article, requirements) {
  if (!Number.isInteger(requirements.calendarMonth)) return false;
  const publishedAt = new Date(article?.pubDate || article?.isoDate || "");
  return !Number.isNaN(publishedAt.getTime())
    && publishedAt.getUTCMonth() === requirements.calendarMonth
    && requirements.years.includes(String(publishedAt.getUTCFullYear()));
}

function hasDocumentEvidence(passage) {
  if (!POSITIVE_DOCUMENT_SIGNAL.test(passage)) return false;
  return !GENERAL_CONTEXT.test(passage) || STRONG_DOCUMENT_SIGNAL.test(passage);
}

function getImageCandidate(article) {
  const thumbnail = String(article?.thumbnail || "").trim();
  if (!/^https?:\/\//i.test(thumbnail) || /placeholder|placehold\.co|source-title-card/i.test(thumbnail)) {
    return null;
  }
  return thumbnail;
}

export function matchArticleAgainstWishlist(article, items = []) {
  const passages = getArticlePassages(article);
  if (!passages.length) return [];

  const qualifiedMatches = items.flatMap((item) => {
    if (item?.isActive === false || String(item?.workflowStatus || "").trim().toLowerCase() === "completed") {
      return [];
    }

    const requirements = getItemRequirements(item);
    if (!requirements || !requirements.countryTerms.length) return [];
    if (requirements.documentTerm === "visa" && passages.some((passage) => VISA_PAYMENT_CONTEXT.test(passage))) {
      return [];
    }
    const evidencePassageIndex = passages.findIndex((passage, index) =>
      containsAllNonYearTerms(passage, requirements)
      && (Number.isInteger(requirements.calendarMonth)
        ? hasMatchingPublicationMonth(article, requirements)
        : hasNearbyYears(passages, index, requirements.years))
      && hasDocumentEvidence(passage));
    if (evidencePassageIndex === -1) return [];

    const matchedTerms = Array.from(new Set([
      ...requirements.countryTerms,
      requirements.documentTerm,
      ...requirements.qualifierTerms,
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
