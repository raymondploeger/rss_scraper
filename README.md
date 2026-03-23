# RSS Monitoring Dashboard

Standalone RSS monitoring dashboard for Google Alerts and other RSS feeds. The app runs as a regular Node.js + Express service, stores data in a local SQLite file, serves the frontend directly, refreshes feeds every 5 minutes, and pushes live updates to the dashboard with Server-Sent Events.

## Architecture

- `backend/src/server.js`
  - standalone Node entry point
- `backend/src/app.js`
  - Express app, REST API, static frontend serving, SSE stream, image proxy
- `backend/src/services/rssService.js`
  - feed ingestion, normalization, metadata enrichment, article upserts
- `backend/src/services/thumbnailService.js`
  - article page scraping with retries and thumbnail extraction
- `backend/src/services/trendService.js`
  - trend calculation from stored articles
- `backend/src/services/schedulerService.js`
  - 5-minute refresh scheduler using `node-cron`
- `backend/src/database`
  - SQLite repositories for feeds, articles, and poll logs
- `frontend/public`
  - standalone HTML, CSS, and vanilla JavaScript dashboard

## Folder structure

```text
.
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── config/
│       ├── controllers/
│       ├── database/
│       ├── routes/
│       ├── services/
│       └── utils/
├── frontend/
│   └── public/
│       ├── app.js
│       ├── index.html
│       └── styles.css
├── docker-compose.yml
├── package.json
└── .env.example
```

## Environment variables

Copy `.env.example` to `backend/.env` or `/.env` and adjust values as needed.

```bash
HOST=127.0.0.1
PORT=4000
CLIENT_ORIGIN=http://127.0.0.1:4000
SQLITE_PATH=./backend/data/rss-monitor.db
MAX_FEEDS=50
POLL_CRON=*/5 * * * *
POLL_CONCURRENCY=5
REQUEST_TIMEOUT_MS=10000
SCRAPE_RETRY_ATTEMPTS=2
PLACEHOLDER_IMAGE=https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image
PUBLIC_APP_URL=http://127.0.0.1:4000
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5-mini
```

Notes:
- `OPENAI_API_KEY` is optional. The dashboard still works without it.
- `SQLITE_PATH` controls where the local database file is stored.
- `PUBLIC_APP_URL` is used when the UI needs absolute links or deployment-aware defaults.

## Local development

1. Install backend dependencies:

```bash
cd /Users/keesingtechnologies/Documents/New\ project
npm run backend:install
```

2. Create `backend/.env` from `backend/.env.example`.
3. Start the dashboard:

```bash
cd /Users/keesingtechnologies/Documents/New\ project
npm run dev
```

4. Open [http://127.0.0.1:4000](http://127.0.0.1:4000).

The first launch creates the SQLite database file automatically.

### Docker Compose

1. Create `backend/.env` from `backend/.env.example`.
2. Start the full stack:

```bash
cd /Users/keesingtechnologies/Documents/New\ project
npm run docker:up
```

3. Open [http://127.0.0.1:4000](http://127.0.0.1:4000).

This starts a single container and persists the SQLite database in a Docker volume.

## API

- `GET /api/health`
- `GET /api/feeds`
- `POST /api/feeds`
- `PUT /api/feeds/:id`
- `DELETE /api/feeds/:id`
- `POST /api/feeds/refresh`
- `POST /api/feeds/process`
- `GET /api/articles`
- `GET /api/dashboard/summary`
- `GET /api/trends?timeframe=24h|7d|30d`
- `GET /api/clusters`
- `GET /api/stream`
- `GET /api/image?url=...`

Admin feed actions are also mounted at `/api/admin/feeds` for compatibility with the existing frontend.

## Standalone deployment

You do not need Firebase for this version.

## Railway deployment

This app is ready for Railway now.

What was added for Railway:
- [railway.toml](/Users/keesingtechnologies/Documents/New%20project/railway.toml) with Dockerfile builder, healthcheck path, restart policy, and watch patterns
- [backend/Dockerfile](/Users/keesingtechnologies/Documents/New%20project/backend/Dockerfile) for containerized deploys
- automatic SQLite volume support through `RAILWAY_VOLUME_MOUNT_PATH` in [backend/src/config/env.js](/Users/keesingtechnologies/Documents/New%20project/backend/src/config/env.js)

Railway-specific notes:
- Railway supports persistent volumes mounted into the running service, and exposes `RAILWAY_VOLUME_MOUNT_PATH` automatically when a volume is attached. I use that path for the SQLite database when `SQLITE_PATH` is not set. Source: [Using Volumes](https://docs.railway.com/guides/volumes)
- Railway can use config-as-code from `railway.toml`, including Dockerfile path, healthcheck path, and restart policy. Source: [Config as Code](https://docs.railway.com/config-as-code/reference)
- Railway healthchecks wait for an HTTP `200` from your health endpoint and use the injected `PORT` variable. Source: [Healthchecks](https://docs.railway.com/deployments/healthchecks)

### Deploy on Railway

1. Push this repository to GitHub.
2. In Railway, create a new project and import the GitHub repo.
3. Create one service for this app.
4. Railway should detect [railway.toml](/Users/keesingtechnologies/Documents/New%20project/railway.toml) and build with the Dockerfile automatically.
5. Attach a Volume to the service.
Mount it to `/app/data`.
6. Set these variables in the Railway service:

```bash
HOST=0.0.0.0
CLIENT_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
PUBLIC_APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5-mini
POLL_CRON=*/5 * * * *
POLL_CONCURRENCY=5
REQUEST_TIMEOUT_MS=10000
SCRAPE_RETRY_ATTEMPTS=2
MAX_FEEDS=50
```

Optional:
- `PLACEHOLDER_IMAGE`
- `SQLITE_PATH` if you want to override the default volume path behavior

7. Redeploy the service.
8. Once the healthcheck passes on `/api/health`, open the generated Railway domain.

### Important Railway caveats

- Attach a Volume. Without one, SQLite data will not persist across deployments or restarts.
- Because Railway documents that services with attached volumes have a small amount of downtime during redeploys, expect brief deploy-time interruption for this app. Source: [Healthchecks](https://docs.railway.com/deployments/healthchecks)
- This app uses SSE for live updates, so keep it as a regular long-running web service, not a serverless function.

### Deploy on a VPS

1. Provision a Linux host.
2. Install Docker and Docker Compose, or install Node.js 22+ directly.
3. Copy the project to the server.
4. Create `backend/.env`.
5. Start with either:

```bash
docker compose up -d --build
```

or:

```bash
cd backend
npm install
npm start
```

6. Put Nginx or Caddy in front of the app and reverse proxy to `127.0.0.1:4000`.

### Reverse proxy example

```nginx
server {
  listen 80;
  server_name your-domain.example;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_buffering off;
  }
}
```

## What changed from the Firebase version

- Frontend live updates now use `EventSource` against `/api/stream`
- Backend persistence is now a local SQLite file through Node's built-in `node:sqlite`
- The frontend is served directly by Express
- Scheduled refreshes are handled by `node-cron`
- Docker Compose is included for a one-command standalone stack
