# Database Schema

PostgreSQL schema is defined in [backend/prisma/schema.prisma](/Users/r.ploeger/rss_scraper/backend/prisma/schema.prisma).

## `feeds`

Required fields:

- `id`
- `name`
- `rssUrl`
- `topic`
- `isActive`
- `createdAt`
- `updatedAt`

Operational fields retained for sync status:

- `sourceType`
- `lastFetchedAt`
- `lastStatus`
- `lastError`
- `lastInsertedCount`

Example row:

```json
{
  "id": "8b8c20f1-bb00-4fe2-928f-d89d18d8f5b0",
  "name": "Google Alerts - Acme",
  "rssUrl": "https://www.google.com/alerts/feeds/123/456",
  "topic": "Acme Corp",
  "isActive": true,
  "createdAt": "2026-03-24T08:00:00.000Z",
  "updatedAt": "2026-03-24T08:00:00.000Z"
}
```

## `articles`

Required fields:

- `id`
- `title`
- `link`
- `canonicalLink`
- `pubDate`
- `source`
- `topic`
- `feedId`
- `thumbnail`
- `contentSnippet`
- `createdAt`
- `updatedAt`
- `hash`
- `isDuplicate`
- `duplicateOf`

Additional fields retained for the current dashboard and ingestion pipeline:

- `feedName`
- `normalizedTitle`
- `summary`
- `summaryShort`
- `keywords`
- `author`
- `duplicateGroupId`
- `clusterId`
- `language`
- `fetchStatus`

Example row:

```json
{
  "id": "6abf09f36dbf2f70cfcfe0ab5914f6c5f4a6af46c9ab8b4770d4579c7729f6f9",
  "title": "Acme launches new monitoring platform",
  "link": "https://example.com/acme-launches-monitoring-platform",
  "canonicalLink": "https://example.com/acme-launches-monitoring-platform",
  "pubDate": "2026-03-24T08:05:00.000Z",
  "source": "Example News",
  "topic": "Acme Corp",
  "feedId": "8b8c20f1-bb00-4fe2-928f-d89d18d8f5b0",
  "thumbnail": "https://example.com/images/acme.jpg",
  "contentSnippet": "Acme introduced a new monitoring platform...",
  "createdAt": "2026-03-24T08:05:02.000Z",
  "updatedAt": "2026-03-24T08:05:05.000Z",
  "hash": "6abf09f36dbf2f70cfcfe0ab5914f6c5f4a6af46c9ab8b4770d4579c7729f6f9",
  "isDuplicate": false,
  "duplicateOf": null
}
```

## `poll_logs`

Used for observability and dashboard health.

Fields:

- `id`
- `feedId`
- `startedAt`
- `finishedAt`
- `status`
- `newArticles`
- `errorMessage`

## Deduplication

The ingestion service prevents duplicates using:

- deterministic article IDs derived from canonical URLs
- a unique `hash` column

This lets the app ignore repeated RSS entries across repeated sync runs.
