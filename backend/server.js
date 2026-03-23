import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { initializeFirestore, listFeeds, listRecentArticles, getDashboardSummary } from "./database/firestoreService.js";
import { refreshAllFeeds } from "./rss/rssService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../frontend/public");

const app = express();
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "127.0.0.1";
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5000";
const adminRefreshToken = process.env.ADMIN_REFRESH_TOKEN || "";

await initializeFirestore();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: clientOrigin }));
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/api/health", (request, response) => {
  response.json({ ok: true });
});

app.get("/api/feeds", async (request, response) => {
  const feeds = await listFeeds();
  response.json(feeds);
});

app.get("/api/articles", async (request, response) => {
  const filters = {
    topic: String(request.query.topic || ""),
    feedId: String(request.query.feedId || ""),
    date: String(request.query.date || ""),
    search: String(request.query.search || "")
  };

  const articles = await listRecentArticles(filters);
  response.json(articles);
});

app.get("/api/dashboard/summary", async (request, response) => {
  const summary = await getDashboardSummary();
  response.json(summary);
});

app.post("/api/admin/refresh", async (request, response) => {
  const token = request.headers.authorization?.replace("Bearer ", "") || "";
  if (!adminRefreshToken || token !== adminRefreshToken) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  const result = await refreshAllFeeds();
  response.json(result);
});

app.get("*", (request, response) => {
  response.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(port, host, () => {
  console.log(`RSS Monitoring Dashboard listening on http://${host}:${port}`);
});
