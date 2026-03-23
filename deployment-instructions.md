# Deployment Instructions

## Local Development

### 1. Start MongoDB

Use a local MongoDB instance or MongoDB Atlas.

Example local connection string:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/rss-monitor
```

### 2. Configure backend environment

Copy [backend/.env.example](/Users/keesingtechnologies/Documents/New%20project/backend/.env.example) to `backend/.env` and update values as needed.

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Run the app

```bash
cd backend
npm run dev
```

The backend serves the frontend automatically.

Open:

```text
http://localhost:4000
```

## Production Deployment

## Option 1: Render + MongoDB Atlas

### Backend service
- Create a new Render Web Service
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Environment variables:

```env
PORT=4000
MONGODB_URI=<your-mongodb-atlas-uri>
CLIENT_ORIGIN=https://your-app-domain.com
POLL_CRON=*/5 * * * *
POLL_CONCURRENCY=5
REQUEST_TIMEOUT_MS=10000
MAX_FEEDS=50
```

Because the Express server serves the frontend folder directly, deploy the repository so the `frontend/` folder is present alongside `backend/`.

## Option 2: Railway + MongoDB Atlas

- Create a new project from the repo
- Set the service root to `backend`
- Add the same environment variables
- Deploy

## Option 3: VPS or Docker Host

### Example process
1. Install Node.js 20+
2. Install MongoDB or connect to Atlas
3. Copy the project to the server
4. Create `backend/.env`
5. Run `npm install` in `backend/`
6. Start with PM2:

```bash
cd backend
pm2 start src/server.js --name rss-monitor
```

## Reverse Proxy Example

Use Nginx to proxy traffic to Express on port `4000`.

## Health Check

The app exposes:

```text
GET /health
```

Use that endpoint in your host platform health monitor.
