const ARCHIVE_SCOPES = new Set([30, 90, 180]);
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

export class ArchiveRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "ArchiveRequestError";
    this.status = 400;
  }
}

function parseScope(value) {
  const scope = Number(value || 30);
  if (!ARCHIVE_SCOPES.has(scope)) {
    throw new ArchiveRequestError("Archive scope must be one of 30, 90, or 180 days.");
  }
  return scope;
}

function parseLimit(value) {
  const limit = Number(value || DEFAULT_PAGE_SIZE);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ArchiveRequestError("Archive limit must be a positive integer.");
  }
  return Math.min(MAX_PAGE_SIZE, limit);
}

function decodeCursor(value, scope) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (decoded?.v !== 1 || Number(decoded.scope) !== scope || !decoded.pubDate || !decoded.id) {
      throw new Error("invalid");
    }
    const pubDate = new Date(decoded.pubDate);
    if (Number.isNaN(pubDate.getTime())) throw new Error("invalid");
    return { pubDate: pubDate.toISOString(), id: String(decoded.id) };
  } catch {
    throw new ArchiveRequestError("Archive cursor is invalid or does not match the requested archive scope.");
  }
}

function encodeCursor({ scope, article }) {
  return Buffer.from(JSON.stringify({ v: 1, scope, pubDate: new Date(article.pubDate).toISOString(), id: String(article.id) })).toString("base64url");
}

function toCompactArchiveCard(article) {
  return {
    id: String(article.id),
    title: String(article.title || "Untitled article"),
    source: String(article.source || article.feedName || "Unknown source"),
    sourceName: String(article.feedName || article.source || "Unknown source"),
    feedId: String(article.feedId || ""),
    topic: String(article.topic || ""),
    link: String(article.canonicalLink || article.link || ""),
    pubDate: new Date(article.pubDate).toISOString(),
  };
}

export function createArchiveService({ repository, now = () => new Date() }) {
  return {
    async read(query = {}) {
      const scope = parseScope(query.scope);
      const limit = parseLimit(query.limit);
      const cursor = decodeCursor(query.cursor, scope);
      const cutoff = new Date(now().getTime() - scope * 24 * 60 * 60 * 1000);
      const filters = {
        since: cutoff,
        excludeDuplicates: true,
        excludeArchiveLinkOnlyPlaceholders: true,
      };
      const [items, total] = await Promise.all([
        repository.listArchivePage({ filters, cursor, limit: limit + 1 }),
        repository.countArchiveArticles(filters),
      ]);
      const pageItems = items.slice(0, limit);
      const cards = pageItems.map(toCompactArchiveCard);
      return {
        scope,
        limit,
        total: Number(total) || 0,
        items: cards,
        nextCursor: items.length > limit ? encodeCursor({ scope, article: pageItems[pageItems.length - 1] }) : null,
      };
    },
  };
}
