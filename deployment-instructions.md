# Railway Deployment Instructions

## Simple deployment flow

1. Push the project to GitHub.
2. Create a new Railway project.
3. Deploy from the GitHub repository.
4. Add a PostgreSQL service in the same Railway project.
5. Copy the PostgreSQL `DATABASE_URL` into the web app service variables.
6. Add the rest of the app variables from [backend/.env.example](/Users/r.ploeger/rss_scraper/backend/.env.example).
7. Redeploy the app.

## Required Railway app variables

```env
DATABASE_URL=<paste Railway PostgreSQL DATABASE_URL here>
HOST=0.0.0.0
CLIENT_ORIGIN=*
POLL_CRON=*/5 * * * *
POLL_CONCURRENCY=5
REQUEST_TIMEOUT_MS=10000
SCRAPE_RETRY_ATTEMPTS=2
MAX_FEEDS=50
PUBLIC_APP_URL=https://your-app.up.railway.app
PLACEHOLDER_IMAGE=https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image
```

`PORT` is usually provided by Railway automatically.

## Prisma on Railway

The backend start command already runs migrations:

```bash
node src/start.js
```

That means Railway will:

1. generate the Prisma client during install
2. check that `DATABASE_URL` exists
3. apply committed migrations on startup
4. start the Express server

Useful scripts:

- `npm --prefix backend run setup`
- `npm --prefix backend run prisma:generate`
- `npm --prefix backend run prisma:deploy`

## Files used by Railway

- [railway.toml](/Users/r.ploeger/rss_scraper/railway.toml)
- [backend/Dockerfile](/Users/r.ploeger/rss_scraper/backend/Dockerfile)
- [backend/package.json](/Users/r.ploeger/rss_scraper/backend/package.json)
- [backend/prisma/schema.prisma](/Users/r.ploeger/rss_scraper/backend/prisma/schema.prisma)

## If startup fails

If `DATABASE_URL` is missing, the app prints:

```text
Missing DATABASE_URL. Create backend/.env file.
For Railway, add a PostgreSQL service and copy its DATABASE_URL into your app variables.
```

If PostgreSQL is attached but unreachable, the app prints a direct database connection error instead of failing silently.
