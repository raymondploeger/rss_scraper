# Project Architecture

## Target architecture

```text
RSS feeds
  -> Express ingestion service
  -> PostgreSQL via Prisma
  -> SSE stream
  -> Vanilla JS dashboard served by Express
```

## Components

### Backend

- Node.js + Express app in [backend/src/app.js](/Users/r.ploeger/rss_scraper/backend/src/app.js)
- HTTP server bootstrap in [backend/src/server.js](/Users/r.ploeger/rss_scraper/backend/src/server.js)
- Prisma/PostgreSQL connection in [backend/src/config/db.js](/Users/r.ploeger/rss_scraper/backend/src/config/db.js)
- Scheduler in [backend/src/services/schedulerService.js](/Users/r.ploeger/rss_scraper/backend/src/services/schedulerService.js)

### Database

- PostgreSQL schema defined in [backend/prisma/schema.prisma](/Users/r.ploeger/rss_scraper/backend/prisma/schema.prisma)
- repositories in [backend/src/database/feedRepository.js](/Users/r.ploeger/rss_scraper/backend/src/database/feedRepository.js), [backend/src/database/articleRepository.js](/Users/r.ploeger/rss_scraper/backend/src/database/articleRepository.js), and [backend/src/database/pollLogRepository.js](/Users/r.ploeger/rss_scraper/backend/src/database/pollLogRepository.js)

### Ingestion

- RSS parsing in [backend/src/services/rssService.js](/Users/r.ploeger/rss_scraper/backend/src/services/rssService.js)
- thumbnail scraping in [backend/src/services/thumbnailService.js](/Users/r.ploeger/rss_scraper/backend/src/services/thumbnailService.js)

### Frontend

- static dashboard in [frontend/public/index.html](/Users/r.ploeger/rss_scraper/frontend/public/index.html), [frontend/public/styles.css](/Users/r.ploeger/rss_scraper/frontend/public/styles.css), and [frontend/public/app.js](/Users/r.ploeger/rss_scraper/frontend/public/app.js)

## Data flow

1. `node-cron` triggers feed refresh every 5 minutes.
2. Active feeds are loaded from PostgreSQL through Prisma.
3. Each feed is fetched and parsed with `rss-parser`.
4. Articles are normalized, deduplicated, and stored in PostgreSQL.
5. New articles are enriched with `og:image` thumbnails.
6. SSE broadcasts article and feed updates to connected browsers.
7. The dashboard updates itself without Firebase.
