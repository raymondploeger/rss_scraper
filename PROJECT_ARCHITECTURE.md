# Google Alerts RSS Monitoring Dashboard Architecture

## Goal

Build a standalone web application that aggregates up to 50 Google Alerts RSS feeds, refreshes them every 5 minutes, stores articles in a database, extracts OpenGraph thumbnails, and displays everything in a modern monitoring dashboard with real-time updates.

## Recommended Stack

### Frontend
- HTML
- CSS
- Vanilla JavaScript
- Server-sent events (SSE) for live updates

### Backend
- Node.js
- Express
- `rss-parser` for RSS ingestion
- `cheerio` for OpenGraph extraction
- `node-cron` for scheduled polling

### Database
- MongoDB

MongoDB is the better fit here because:
- article and feed schemas are flexible
- indexing for topic/date filtering is straightforward
- deduplication with unique indexes is simple
- it works cleanly with an Express-only backend

Firestore is still viable, but MongoDB gives more control for a standalone Node/Express app.

## High-Level Architecture

```text
Browser Dashboard
  |
  | HTTP / SSE
  v
Express App
  |- Feed API
  |- Article API
  |- Realtime Stream
  |- Admin/Health API
  |
  v
Feed Polling Service (every 5 min)
  |- Fetch RSS feeds
  |- Parse entries
  |- Deduplicate articles
  |- Queue thumbnail enrichment
  |
  v
Thumbnail Enrichment Service
  |- Fetch article URL
  |- Read OpenGraph meta tags
  |- Save thumbnail/image URL
  |
  v
MongoDB
  |- feeds
  |- articles
  |- topics
  |- poll_logs
```

## Core Modules

### 1. Feed Management
- Store up to 50 Google Alerts RSS feed URLs
- Assign each feed to one topic
- Enable feed activation/deactivation
- Validate feed URLs before saving

### 2. Scheduler
- Run every 5 minutes
- Fetch all active feeds
- Process feeds with controlled concurrency to avoid timeouts
- Log poll results and failures

Recommended concurrency:
- 5 to 10 feeds at a time

### 3. RSS Ingestion
- Parse feed entries
- Normalize title, link, publication date, source, summary, topic
- Prevent duplicates using a unique key

Recommended unique article key:
- `hash(feedId + articleLink)`

### 4. Thumbnail Extraction
- For new articles, fetch the article page
- Extract `og:image`, then fall back to `twitter:image`
- Save thumbnail URL if found
- Run enrichment asynchronously so feed ingestion stays fast

### 5. Dashboard UI
- Monitoring-style card layout
- Topic filter
- Date filter
- Feed status widgets
- Real-time article insertion without manual refresh
- Clickable cards opening original article in a new tab

### 6. Realtime Updates
- Use SSE from Express
- Broadcast newly inserted or updated articles to connected clients

Why SSE here:
- simpler than WebSockets
- perfect for one-way server-to-dashboard updates
- works well for dashboards and live feeds

## Suggested Project Structure

```text
google-alerts-dashboard/
├── package.json
├── .env
├── server/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   ├── routes/
│   │   ├── feeds.routes.js
│   │   ├── articles.routes.js
│   │   ├── dashboard.routes.js
│   │   └── stream.routes.js
│   ├── controllers/
│   │   ├── feeds.controller.js
│   │   ├── articles.controller.js
│   │   └── stream.controller.js
│   ├── services/
│   │   ├── rssPoller.service.js
│   │   ├── rssParser.service.js
│   │   ├── articleNormalizer.service.js
│   │   ├── thumbnailExtractor.service.js
│   │   ├── realtime.service.js
│   │   └── scheduler.service.js
│   ├── models/
│   │   ├── Feed.js
│   │   ├── Article.js
│   │   └── PollLog.js
│   ├── utils/
│   │   ├── hash.js
│   │   ├── dates.js
│   │   └── logger.js
│   └── jobs/
│       └── refreshFeeds.job.js
├── public/
│   ├── index.html
│   ├── css/
│   │   └── dashboard.css
│   ├── js/
│   │   ├── api.js
│   │   ├── dashboard.js
│   │   ├── filters.js
│   │   ├── stream.js
│   │   └── renderers.js
│   └── assets/
└── docs/
    └── architecture.md
```

## Database Design

### `feeds` collection

```json
{
  "_id": "ObjectId",
  "name": "AI Startups Alert",
  "topic": "AI",
  "rssUrl": "https://www.google.com/alerts/feeds/...",
  "isActive": true,
  "lastFetchedAt": "2026-03-16T10:00:00.000Z",
  "lastStatus": "success",
  "lastError": null,
  "createdAt": "2026-03-16T08:00:00.000Z",
  "updatedAt": "2026-03-16T10:00:00.000Z"
}
```

### `articles` collection

```json
{
  "_id": "ObjectId",
  "feedId": "ObjectId",
  "topic": "AI",
  "title": "Example article title",
  "link": "https://example.com/article",
  "source": "TechCrunch",
  "summary": "Normalized RSS description",
  "publishedAt": "2026-03-16T09:42:00.000Z",
  "thumbnailUrl": "https://cdn.example.com/image.jpg",
  "thumbnailStatus": "complete",
  "articleHash": "sha256-value",
  "createdAt": "2026-03-16T10:00:00.000Z",
  "updatedAt": "2026-03-16T10:01:00.000Z"
}
```

### `poll_logs` collection

```json
{
  "_id": "ObjectId",
  "feedId": "ObjectId",
  "startedAt": "2026-03-16T10:00:00.000Z",
  "finishedAt": "2026-03-16T10:00:06.000Z",
  "status": "success",
  "newArticles": 4,
  "errorMessage": null
}
```

## Important Indexes

### `feeds`
- `{ isActive: 1 }`
- `{ topic: 1, isActive: 1 }`

### `articles`
- `{ articleHash: 1 }` unique
- `{ topic: 1, publishedAt: -1 }`
- `{ feedId: 1, publishedAt: -1 }`
- `{ publishedAt: -1 }`

### `poll_logs`
- `{ feedId: 1, startedAt: -1 }`

## API Design

### Feed APIs
- `GET /api/feeds`
- `POST /api/feeds`
- `PUT /api/feeds/:id`
- `DELETE /api/feeds/:id`
- `POST /api/feeds/:id/refresh`

### Article APIs
- `GET /api/articles`
  - query params:
    - `topic`
    - `feedId`
    - `startDate`
    - `endDate`
    - `page`
    - `limit`
- `GET /api/articles/:id`

### Dashboard APIs
- `GET /api/dashboard/summary`
  - total feeds
  - active feeds
  - articles today
  - latest poll time
  - failed feeds

### Realtime API
- `GET /api/stream`
  - SSE endpoint for live article updates

## Main Data Flows

### 1. Feed Refresh Flow
1. Scheduler triggers every 5 minutes.
2. Active feeds are loaded from MongoDB.
3. Each RSS feed is fetched and parsed.
4. Each entry is normalized and deduplicated.
5. New articles are inserted.
6. New article events are broadcast through SSE.
7. Thumbnail extraction jobs run for inserted articles.
8. Updated thumbnails are saved and broadcast again.

### 2. Dashboard Load Flow
1. Browser requests `index.html`.
2. Frontend loads summary widgets and article list via REST APIs.
3. User applies topic/date filters.
4. Frontend re-requests filtered article data.
5. SSE connection pushes newly arrived articles into the card grid.

## Dashboard Layout

### Top bar
- App title
- Last refresh timestamp
- Connection status

### Summary row
- Active feeds
- Total monitored topics
- Articles in last 24 hours
- Failed feeds

### Filter bar
- Topic dropdown
- Date range picker
- Search input optional

### Main content
- Responsive article card grid
- Each card shows:
  - thumbnail
  - topic badge
  - title
  - source
  - publication date
  - short summary
  - click-through link

### Sidebar or secondary panel
- Feed health list
- latest errors
- manual refresh button

## UI Design Direction

The UI should feel like a modern monitoring dashboard:
- dark neutral background or soft slate background
- high-contrast cards
- compact status chips
- clean typography
- responsive 3 to 4 column grid on desktop
- single column stack on mobile
- subtle hover elevation for article cards
- live update indicator when new items arrive

## Real-Time Strategy

Use SSE with two event types:

### `article:new`
- sent when a new article is inserted

### `article:update`
- sent when thumbnail or metadata enrichment completes

Example event payload:

```json
{
  "type": "article:new",
  "article": {
    "id": "123",
    "topic": "Cybersecurity",
    "title": "New breach report",
    "publishedAt": "2026-03-16T09:42:00.000Z",
    "thumbnailUrl": null
  }
}
```

## Scaling Notes

For 50 feeds every 5 minutes, this design is comfortably within range for a single Express service if you:
- limit concurrent feed requests
- use request timeouts
- process thumbnail extraction asynchronously
- index article queries properly

Expected workload:
- 50 feed fetches every 5 minutes
- article page fetches only for new entries
- dashboard reads are mostly filtered list queries

## Failure Handling

- mark feed failures in `feeds.lastStatus`
- store error details in `poll_logs`
- do not block all feed polling if one feed fails
- retry thumbnail extraction once or twice with backoff
- fall back to a placeholder image when OpenGraph data is missing

## Security and Operational Basics

- validate feed URLs before insertion
- sanitize all article summaries rendered into HTML
- enforce request rate limits on admin endpoints
- add `helmet` and `cors` middleware
- use environment variables for DB URI and port
- expose `/health` for uptime monitoring

## Suggested Environment Variables

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/google-alerts-dashboard
POLL_SCHEDULE=*/5 * * * *
REQUEST_TIMEOUT_MS=10000
MAX_FEEDS=50
POLL_CONCURRENCY=5
```

## Recommended Build Sequence

1. Set up Express server and MongoDB connection.
2. Build feed CRUD APIs.
3. Add RSS polling scheduler.
4. Add article ingestion and deduplication.
5. Add OpenGraph thumbnail extraction.
6. Build dashboard HTML/CSS/JS interface.
7. Add topic/date filtering.
8. Add SSE real-time updates.
9. Add health checks, logs, and deployment config.

## Best Architecture Choice

For your requirement set, the cleanest implementation is:
- vanilla HTML/CSS/JS frontend in `public/`
- Node.js + Express backend in `server/`
- MongoDB for feeds, articles, and polling logs
- `node-cron` scheduler every 5 minutes
- SSE for real-time dashboard updates

This gives you a simple standalone deployment, a modern card-based monitoring UI, and enough flexibility to support 50 Google Alerts feeds reliably.
