import assert from "node:assert/strict";
import { createArchiveService } from "../backend/src/services/archiveService.js";

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

const first = await service.read({ scope: "30", limit: "2" });
assert.equal(first.total, 3, "archive reports a true complete total");
assert.deepEqual(first.items.map(({ id }) => id), ["c", "b"], "archive is stable by pubDate then id descending");
assert.deepEqual(Object.keys(first.items[0]).sort(), ["feedId", "id", "link", "pubDate", "source", "sourceName", "title", "topic"], "archive returns only the compact fields needed by the normal card renderer");
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
await assert.rejects(() => service.read({ scope: "7" }), /scope must be one of 30, 90, or 180/);

console.log("Archive service checks passed.");
