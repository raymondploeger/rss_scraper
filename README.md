# RSS Monitoring Dashboard

Standalone RSS monitoring dashboard built with Node.js, Express, PostgreSQL, Prisma, and a vanilla JavaScript frontend.

No Firebase is used anywhere in the runtime.

## Exact Railway deployment steps

1. Push this repository to GitHub.
2. Create a new project in Railway.
3. Choose `Deploy from GitHub repo` and connect this repository.
4. In the Railway project, click `New` and add a `PostgreSQL` service.
5. Open your web app service in Railway.
6. Open `Variables`.
7. Copy the `DATABASE_URL` value from the Railway PostgreSQL service into the web app service variables.
8. Also add these variables to the web app service:

```env
HOST=0.0.0.0
CLIENT_ORIGIN=*
POLL_CRON=0 * * * *
POLL_CONCURRENCY=5
REQUEST_TIMEOUT_MS=10000
SCRAPE_RETRY_ATTEMPTS=2
MAX_FEEDS=150
PUBLIC_APP_URL=https://your-app.up.railway.app
PLACEHOLDER_IMAGE=https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image
```

9. Railway will build the app using [railway.toml](/Users/r.ploeger/rss_scraper/railway.toml) and [backend/Dockerfile](/Users/r.ploeger/rss_scraper/backend/Dockerfile).
10. On startup, the app automatically runs `prisma migrate deploy` before starting the Express server.
11. After deployment finishes, open the Railway app URL.
12. Add RSS feeds from the dashboard and click `Refresh feeds`.

## Railway env example

Template:

- [backend/.env.example](/Users/r.ploeger/rss_scraper/backend/.env.example)

Important value:

```env
DATABASE_URL="<paste Railway PostgreSQL DATABASE_URL here>"
```

## Scripts

Backend scripts in [backend/package.json](/Users/r.ploeger/rss_scraper/backend/package.json):

- `npm --prefix backend run setup`
  Runs `prisma generate && prisma migrate deploy`
- `npm --prefix backend run prisma:generate`
- `npm --prefix backend run prisma:deploy`
- `npm --prefix backend start`
  Runs `node src/start.js`, which checks `DATABASE_URL`, applies Prisma migrations, and then starts Express

This makes Railway deployment simpler because migrations are applied automatically when the app starts.

## Missing DATABASE_URL behavior

If `DATABASE_URL` is not set, startup prints a clear message and exits:

```text
Missing DATABASE_URL. Create backend/.env file.
For Railway, add a PostgreSQL service and copy its DATABASE_URL into your app variables.
```

## Prisma

Prisma schema:

- [backend/prisma/schema.prisma](/Users/r.ploeger/rss_scraper/backend/prisma/schema.prisma)

The datasource uses:

```prisma
url = env("DATABASE_URL")
```

## Main files changed

- [backend/.env.example](/Users/r.ploeger/rss_scraper/backend/.env.example)
- [backend/package.json](/Users/r.ploeger/rss_scraper/backend/package.json)
- [backend/src/server.js](/Users/r.ploeger/rss_scraper/backend/src/server.js)
- [README.md](/Users/r.ploeger/rss_scraper/README.md)
- [railway.toml](/Users/r.ploeger/rss_scraper/railway.toml)

## Architecture

- Node.js
- Express
- PostgreSQL
- Prisma
- Vanilla JavaScript frontend
- SSE for live updates
- Railway deployment
