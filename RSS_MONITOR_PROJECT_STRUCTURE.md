# RSS Monitoring Dashboard Project Structure

## Folder Structure

```text
backend/
├── package.json
├── server/
│   ├── index.js
│   ├── config.js
│   ├── scheduler.js
│   └── routes/
│       ├── articles.js
│       ├── dashboard.js
│       └── feeds.js
├── rss/
│   ├── rssParser.js
│   ├── rssSync.js
│   ├── articleController.js
│   ├── dashboardController.js
│   └── feedController.js
└── database/
    ├── firestore.js
    ├── articleRepository.js
    └── feedRepository.js

frontend/
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

## `package.json`

File: [backend/package.json](/Users/keesingtechnologies/Documents/New%20project/backend/package.json)

### Scripts
- `npm run dev`: starts the Express server with file watching
- `npm start`: starts the production server

### Dependencies
- `express`: HTTP server and routing
- `cors`: cross-origin support
- `helmet`: basic security headers
- `dotenv`: environment variable loading
- `rss-parser`: parses RSS XML feeds
- `node-cron`: runs the scheduled feed sync every 5 minutes
- `firebase-admin`: connects to Firestore from the backend
- `axios`: available for downstream HTTP requests such as article enrichment

## Module Explanation

### `backend/server`

Application bootstrap and API surface.

- [backend/server/index.js](/Users/keesingtechnologies/Documents/New%20project/backend/server/index.js)
  Starts Express, initializes Firestore, serves the frontend, mounts API routes, and starts the scheduler.
- [backend/server/config.js](/Users/keesingtechnologies/Documents/New%20project/backend/server/config.js)
  Centralizes environment configuration such as port, Firebase credentials, and cron schedule.
- [backend/server/scheduler.js](/Users/keesingtechnologies/Documents/New%20project/backend/server/scheduler.js)
  Runs the RSS polling job every 5 minutes.
- [backend/server/routes/articles.js](/Users/keesingtechnologies/Documents/New%20project/backend/server/routes/articles.js)
  Exposes the article listing endpoint with filters.
- [backend/server/routes/feeds.js](/Users/keesingtechnologies/Documents/New%20project/backend/server/routes/feeds.js)
  Exposes feed management and manual refresh endpoints.
- [backend/server/routes/dashboard.js](/Users/keesingtechnologies/Documents/New%20project/backend/server/routes/dashboard.js)
  Exposes dashboard summary metrics.

### `backend/rss`

RSS ingestion logic and request handlers.

- [backend/rss/rssParser.js](/Users/keesingtechnologies/Documents/New%20project/backend/rss/rssParser.js)
  Wraps `rss-parser` to fetch and parse RSS XML.
- [backend/rss/rssSync.js](/Users/keesingtechnologies/Documents/New%20project/backend/rss/rssSync.js)
  Loads active feeds, parses items, normalizes article data, and stores new articles without duplicates.
- [backend/rss/feedController.js](/Users/keesingtechnologies/Documents/New%20project/backend/rss/feedController.js)
  Handles feed create, list, and manual refresh actions.
- [backend/rss/articleController.js](/Users/keesingtechnologies/Documents/New%20project/backend/rss/articleController.js)
  Handles filtered article queries.
- [backend/rss/dashboardController.js](/Users/keesingtechnologies/Documents/New%20project/backend/rss/dashboardController.js)
  Aggregates counts for the dashboard summary.

### `backend/database`

Firestore integration and data access layer.

- [backend/database/firestore.js](/Users/keesingtechnologies/Documents/New%20project/backend/database/firestore.js)
  Initializes the Firebase Admin SDK and exposes the Firestore client.
- [backend/database/feedRepository.js](/Users/keesingtechnologies/Documents/New%20project/backend/database/feedRepository.js)
  Reads and writes feed documents, stores article records, updates sync status, and computes dashboard metrics.
- [backend/database/articleRepository.js](/Users/keesingtechnologies/Documents/New%20project/backend/database/articleRepository.js)
  Reads stored articles and applies topic, feed, and date filters.

### `frontend/public`

Static dashboard files served directly by Express.

- [frontend/public/index.html](/Users/keesingtechnologies/Documents/New%20project/frontend/public/index.html)
  Dashboard markup with filter controls, summary cards, and the article grid.
- [frontend/public/styles.css](/Users/keesingtechnologies/Documents/New%20project/frontend/public/styles.css)
  Card-grid dashboard styling.
- [frontend/public/app.js](/Users/keesingtechnologies/Documents/New%20project/frontend/public/app.js)
  Loads summary and article data from the API and renders the dashboard.

## Required Environment Variables

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:4000
POLL_CRON=*/5 * * * *
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
