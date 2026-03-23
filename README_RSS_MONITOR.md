# RSS Monitoring Dashboard

Standalone web application for aggregating Google Alerts RSS feeds and displaying articles in a modern monitoring dashboard.

## Project Structure

```text
frontend/
backend/
database-schema.md
deployment-instructions.md
```

## Features

- up to 50 RSS feeds
- RSS XML parsing
- article title, link, source, and date extraction
- OpenGraph thumbnail extraction from article pages
- MongoDB storage
- duplicate prevention with article hashing
- dashboard card layout
- filters by topic, feed, and date
- newest-first sorting
- cards open original articles in a new tab
- real-time updates with server-sent events

## Run

```bash
cd backend
npm install
npm run dev
```

Then open `http://localhost:4000`.
