import assert from "node:assert/strict";
import { createArchiveService } from "../backend/src/services/archiveService.js";
import { buildArticleWhere } from "../backend/src/database/articleRepository.js";

const records = [
  { id: "c", pubDate: "2026-11-24T10:00:00.000Z", title: "Third", source: "Gamma", link: "https://example.test/c", feedName: "Feed C", feedId: "feed-c", topic: "Security", isDuplicate: false },
  { id: "b", pubDate: "2026-11-24T10:00:00.000Z", title: "Second", source: "Beta", link: "https://example.test/b", feedName: "Feed B", feedId: "feed-b", topic: "Currency", isDuplicate: false },
  { id: "a", pubDate: "2026-11-23T10:00:00.000Z", title: "First", source: "Alpha", link: "https://example.test/a", feedName: "Feed A", feedId: "feed-a", topic: "Identity", isDuplicate: false },
];

const service = createArchiveService({
  now: () => new Date("2026-11-25T12:00:00.000Z"),
  repository: {
    listArchivePage: async ({ cursor, limit }) => {
      const eligible = records.filter((record) => !cursor || record.pubDate < cursor.pubDate || (record.pubDate === cursor.pubDate && record.id < cursor.id));
      return eligible.slice(0, limit);
    },
    countArchiveArticles: async () => records.length,
  },
});

let archiveFilters;
const placeholderSafeService = createArchiveService({
  now: () => new Date("2026-11-25T12:00:00.000Z"),
  repository: {
    listArchivePage: async ({ filters, limit }) => {
      archiveFilters = filters;
      return records.slice(0, limit);
    },
    countArchiveArticles: async (filters) => {
      archiveFilters = filters;
      return records.length;
    },
  },
});
await placeholderSafeService.read({ scope: "30", limit: "2" });
assert.equal(archiveFilters.excludeArchiveLinkOnlyPlaceholders, true, "archive excludes only link-only DMV placeholder records, not DMV news generally");
assert.ok(
  buildArticleWhere({ excludeArchiveLinkOnlyPlaceholders: true }).AND?.some((condition) =>
    condition.NOT?.AND?.some((entry) => entry.title?.endsWith === "DMV official site") &&
    condition.NOT?.AND?.some((entry) => entry.feed?.rssUrl?.startsWith === "https://rssdmv-production.up.railway.app/feeds/")
  ),
  "repository excludes only the known DMV link-only official-site placeholders"
);

await placeholderSafeService.read({ scope: "30", q: "  Bank   Gamma  " });
assert.equal(archiveFilters.archiveSearch, "Bank Gamma", "archive search normalizes whitespace before passing its bounded query to the repository");
assert.deepEqual(
  buildArticleWhere({ archiveSearch: "bank gamma" }).AND?.filter((condition) => condition.OR),
  [
    { OR: [{ title: { contains: "bank", mode: "insensitive" } }, { source: { contains: "bank", mode: "insensitive" } }, { feedName: { contains: "bank", mode: "insensitive" } }] },
    { OR: [{ title: { contains: "gamma", mode: "insensitive" } }, { source: { contains: "gamma", mode: "insensitive" } }, { feedName: { contains: "gamma", mode: "insensitive" } }] },
  ],
  "archive search is a safe AND-token match limited to title and source fields"
);

const first = await service.read({ scope: "30", limit: "2" });
assert.equal(first.total, 3, "archive reports a true complete total");
assert.deepEqual(first.items.map(({ id }) => id), ["c", "b"], "archive is stable by pubDate then id descending");
assert.deepEqual(Object.keys(first.items[0]).sort(), ["feedId", "id", "link", "pubDate", "source", "sourceName", "thumbnail", "title", "topic"], "archive returns only the compact fields needed by the normal card renderer");
assert.deepEqual({ feedId: first.items[0].feedId, topic: first.items[0].topic }, { feedId: "feed-c", topic: "Security" }, "archive preserves the normal card's feed and topic labels");
assert.ok(first.nextCursor, "first compact page has an opaque cursor");

const second = await service.read({ scope: "30", limit: "2", cursor: first.nextCursor });
assert.deepEqual(second.items.map(({ id }) => id), ["a"], "cursor advances without accumulating or duplicating cards");
assert.equal(second.nextCursor, null, "final page has no cursor");
const exactPageService = createArchiveService({
  now: () => new Date("2026-11-25T12:00:00.000Z"),
  repository: {
    listArchivePage: async ({ limit }) => records.slice(0, limit).slice(0, 2),
    countArchiveArticles: async () => 2,
  },
});
assert.equal((await exactPageService.read({ scope: "30", limit: "2" })).nextCursor, null, "an exact final page does not advertise an empty next page");
await assert.rejects(
  () => service.read({ scope: "90", cursor: first.nextCursor }),
  /does not match the requested archive scope/,
  "cursor is scoped to its request parameters"
);
const searched = await service.read({ scope: "30", limit: "2", q: "Third" });
await assert.rejects(
  () => service.read({ scope: "30", q: "Second", cursor: searched.nextCursor }),
  /does not match the requested archive scope or search query/,
  "a cursor cannot be reused for a different archive search"
);
await assert.rejects(
  () => service.read({ scope: "30", q: "x".repeat(201) }),
  /search query must be 200 characters or fewer/,
  "archive search query size is bounded"
);
await assert.rejects(() => service.read({ scope: "7" }), /scope must be one of 30, 90, or 180/);

console.log("Archive service checks passed.");
