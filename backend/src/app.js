import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { listTrends } from "./services/trendService.js";
import articleRoutes from "./routes/articleRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import streamRoutes from "./routes/streamRoutes.js";
import { canonicalizeUrl, normalizeText } from "./utils/text.js";
import axios from "axios";
import { processBacklog, refreshAll } from "./controllers/feedController.js";
import { getRuntimeState } from "./services/runtimeState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend/public");

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(cors({ origin: env.clientOrigin === "*" ? true : env.clientOrigin }));
  app.use(express.json());

  app.get("/", (_request, response) => {
    response.send("OK");
  });

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ ok: true, status: "healthy" });
  });

  app.get("/api/ready", (_request, response) => {
    const state = getRuntimeState();
    const isReady = state.databaseConnected && state.migrationsApplied;

    response.status(isReady ? 200 : 503).json({
      ok: isReady,
      status: isReady ? "ready" : "starting",
      databaseConnected: state.databaseConnected,
      migrationsApplied: state.migrationsApplied,
      schedulerStarted: state.schedulerStarted,
      lastBootstrapError: state.lastBootstrapError
    });
  });

  app.use(express.static(frontendPath));

  app.use("/api/feeds", feedRoutes);
  app.use("/api/admin/feeds", feedRoutes);
  app.use("/api/articles", articleRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/stream", streamRoutes);
  app.post("/api/admin/refresh", refreshAll);
  app.post("/api/admin/process", processBacklog);

  app.get("/api/clusters", (_request, response) => {
    response.json([]);
  });

  app.get("/api/trends", async (request, response) => {
    response.json(await listTrends(normalizeText(request.query.timeframe, "24h")));
  });

  app.get("/api/image", async (request, response) => {
    const targetUrl = normalizeText(request.query.url, "");
    if (!targetUrl) {
      response.status(400).json({ error: "Image URL is required." });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(canonicalizeUrl(targetUrl));
    } catch {
      response.status(400).json({ error: "Invalid image URL." });
      return;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      response.status(400).json({ error: "Unsupported image protocol." });
      return;
    }

    try {
      const upstream = await axios.get(parsedUrl.toString(), {
        responseType: "stream",
        timeout: env.requestTimeoutMs,
        maxRedirects: 5,
        headers: {
          "User-Agent": "RSS Monitor Dashboard/2.0",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        },
        validateStatus: (status) => status >= 200 && status < 400
      });

      const contentType = String(upstream.headers["content-type"] || "");
      if (!contentType.startsWith("image/")) {
        response.redirect(302, env.placeholderImage);
        return;
      }

      response.setHeader("Content-Type", contentType);
      response.setHeader("Cache-Control", "public, max-age=86400");
      if (upstream.headers["content-length"]) {
        response.setHeader("Content-Length", String(upstream.headers["content-length"]));
      }
      upstream.data.pipe(response);
    } catch {
      response.redirect(302, env.placeholderImage);
    }
  });

  app.get("*", (request, response) => {
    response.sendFile(path.join(frontendPath, "index.html"));
  });

  return app;
}
