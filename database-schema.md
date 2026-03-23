# Database Schema

## Database

MongoDB

## Collections

### `feeds`

Stores the configured RSS feeds.

```json
{
  "_id": "ObjectId",
  "name": "Brand Mentions",
  "topic": "Marketing",
  "rssUrl": "https://www.google.com/alerts/feeds/...",
  "isActive": true,
  "lastFetchedAt": "2026-03-16T11:20:00.000Z",
  "lastStatus": "success",
  "lastError": null,
  "createdAt": "2026-03-16T09:00:00.000Z",
  "updatedAt": "2026-03-16T11:20:00.000Z"
}
```

Indexes:
- unique `rssUrl`
- `topic`
- `isActive`
- compound `topic + isActive`

### `articles`

Stores normalized article entries from all feeds.

```json
{
  "_id": "ObjectId",
  "feedId": "ObjectId",
  "feedName": "Brand Mentions",
  "topic": "Marketing",
  "title": "Example article title",
  "link": "https://example.com/article",
  "source": "example.com",
  "publishedAt": "2026-03-16T11:18:00.000Z",
  "thumbnailUrl": "https://cdn.example.com/article-image.jpg",
  "thumbnailStatus": "complete",
  "summary": "Article summary text",
  "articleHash": "sha256(feedId:link)",
  "createdAt": "2026-03-16T11:20:03.000Z",
  "updatedAt": "2026-03-16T11:20:05.000Z"
}
```

Indexes:
- unique `articleHash`
- `publishedAt` descending
- compound `topic + publishedAt`
- compound `feedId + publishedAt`

### `poll_logs`

Stores refresh history for observability and troubleshooting.

```json
{
  "_id": "ObjectId",
  "feedId": "ObjectId",
  "startedAt": "2026-03-16T11:20:00.000Z",
  "finishedAt": "2026-03-16T11:20:06.000Z",
  "status": "success",
  "newArticles": 4,
  "errorMessage": null
}
```

Indexes:
- compound `feedId + startedAt`

## Deduplication Strategy

Duplicates are prevented by generating a deterministic SHA-256 hash:

```text
articleHash = sha256(feedId + ":" + articleLink)
```

Each new article is checked against this unique key before insert.
