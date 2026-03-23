# RSS Monitoring Dashboard

## 1. Project Architecture

This application uses three layers:

- `frontend/public`
  Static HTML, CSS, and vanilla JavaScript served by Firebase Hosting.
- `functions`
  Firebase Functions hosts the Express API and runs the scheduled RSS refresh every 5 minutes.
- `backend`
  Local Node.js/Express implementation with reusable ingestion, scraping, and Firestore modules for development and testing.

### Runtime flow

1. A scheduled Firebase Function runs every 5 minutes.
2. Active feeds are loaded from Firestore.
3. RSS XML is parsed with `rss-parser`.
4. Articles are normalized and deduplicated by `link`.
5. The article page is fetched with `axios`.
6. `cheerio` extracts `og:image`.
7. Articles are saved to Firestore with cached thumbnails.
8. The frontend subscribes to Firestore with realtime listeners and updates the dashboard immediately.

## 2. Folder Structure

```text
backend/
├── package.json
├── .env.example
├── server.js
├── server/
│   ├── config.js
│   └── routes.js
├── rss/
│   └── rssService.js
├── scraper/
│   └── thumbnailScraper.js
└── database/
    └── firestoreService.js

frontend/
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── firebase-config.example.js

functions/
├── package.json
└── src/
    └── index.ts
```

## 3. Backend Code

### Main files

- [backend/server.js](/Users/keesingtechnologies/Documents/New%20project/backend/server.js)
  Local Express server for development and admin refresh.
- [backend/rss/rssService.js](/Users/keesingtechnologies/Documents/New%20project/backend/rss/rssService.js)
  RSS ingestion pipeline for up to 50 feeds.
- [backend/scraper/thumbnailScraper.js](/Users/keesingtechnologies/Documents/New%20project/backend/scraper/thumbnailScraper.js)
  OpenGraph image extraction and thumbnail caching.
- [backend/database/firestoreService.js](/Users/keesingtechnologies/Documents/New%20project/backend/database/firestoreService.js)
  Firestore connection, deduplication, article writes, and summary queries.
- [functions/src/index.ts](/Users/keesingtechnologies/Documents/New%20project/functions/src/index.ts)
  Production Firebase Functions entry point with the scheduled job and Express API.

### Required dependencies

Backend and Functions use:

- `express`
- `rss-parser`
- `axios`
- `cheerio`
- `firebase-admin`
- `firebase-functions`
- `cors`
- `helmet`

## 4. Frontend Code

Main files:

- [frontend/public/index.html](/Users/keesingtechnologies/Documents/New%20project/frontend/public/index.html)
- [frontend/public/styles.css](/Users/keesingtechnologies/Documents/New%20project/frontend/public/styles.css)
- [frontend/public/app.js](/Users/keesingtechnologies/Documents/New%20project/frontend/public/app.js)

### Frontend features

- Responsive white-background monitoring dashboard
- Card-based article layout
- Thumbnail, title, source, date, and topic tag
- Entire card opens original article in a new tab
- Realtime Firestore listeners
- Filters for topic, feed, date, and search
- Newest-first sorting
- Loading skeletons
- Optional dark mode toggle

## 5. Firestore Configuration

### Collections

#### `feeds`

Example document:

```json
{
  "id": "feed_google_openai",
  "name": "OpenAI Company Mentions",
  "rssUrl": "https://www.google.com/alerts/feeds/00000000000000000000/00000000000000000000",
  "topic": "AI",
  "isActive": true,
  "createdAt": "2026-03-16T09:00:00.000Z",
  "lastFetchedAt": "2026-03-16T09:05:00.000Z",
  "lastStatus": "success",
  "lastInsertedCount": 3,
  "lastError": null
}
```

#### `articles`

Example document:

```json
{
  "id": "sha256-link-hash",
  "title": "OpenAI launches new platform update",
  "link": "https://example.com/openai-update",
  "pubDate": "2026-03-16T08:42:00.000Z",
  "source": "example.com",
  "topic": "AI",
  "thumbnail": "https://example.com/image.jpg",
  "feedId": "feed_google_openai",
  "createdAt": "2026-03-16T09:05:12.000Z"
}
```

### Rules

Public dashboard reads are enabled in:

- [firestore.rules](/Users/keesingtechnologies/Documents/New%20project/firestore.rules)

### Indexes

Required indexes are defined in:

- [firestore.indexes.json](/Users/keesingtechnologies/Documents/New%20project/firestore.indexes.json)

## 6. Setup Instructions

### Firebase setup

1. Create a Firebase project.
2. Enable Firestore.
3. Enable Firebase Hosting.
4. Enable Cloud Functions.
5. Create a Firebase web app and copy its config.
6. Create a service account for Functions and local admin usage if needed.

### Frontend config

Create `frontend/public/firebase-config.js` from:

- [frontend/public/firebase-config.example.js](/Users/keesingtechnologies/Documents/New%20project/frontend/public/firebase-config.example.js)

### Local backend config

Create `backend/.env` from:

- [backend/.env.example](/Users/keesingtechnologies/Documents/New%20project/backend/.env.example)

## 7. Deployment Instructions

### Install dependencies

```bash
cd /Users/keesingtechnologies/Documents/New\ project/functions
npm install
```

```bash
cd /Users/keesingtechnologies/Documents/New\ project/backend
npm install
```

### Deploy Firestore rules and indexes

```bash
cd /Users/keesingtechnologies/Documents/New\ project
firebase deploy --only firestore
```

### Deploy Functions and Hosting

```bash
cd /Users/keesingtechnologies/Documents/New\ project
firebase deploy --only functions,hosting
```

### Firebase Hosting behavior

- Static assets are served from `frontend/public`
- `/api/**` is rewritten to the `api` Firebase Function

This rewrite is configured in:

- [firebase.json](/Users/keesingtechnologies/Documents/New%20project/firebase.json)

## 8. Performance Notes

- Feed ingestion is capped at 50 feeds.
- Scheduled ingestion runs every 5 minutes.
- Duplicate prevention is link-based.
- Thumbnail extraction is cached into the article document.
- The dashboard listens directly to Firestore for sub-2-second perceived updates on fresh data.

## 9. Production Notes

- Use `og:image` as the primary thumbnail source.
- Keep Functions in the same region as your Firestore instance.
- Consider archiving or TTL cleanup for very old articles if the collection grows large.
- If you need stricter public access control later, switch read rules behind App Check or a signed API layer.
