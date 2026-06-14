import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { env } from "./config/env.js";
import { listArticles } from "./controllers/articleController.js";
import {
  batchImportGoogleAlertsFeeds,
  createFeed,
  deleteFeed,
  listFeeds,
  refreshAll,
  refreshFeed,
  updateFeed,
} from "./controllers/feedController.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { canonicalizeUrl, normalizeText } from "./utils/text.js";
import { importDmvFeeds } from "./controllers/dmvImportController.js";
import { loadDmvCatalog, toDmvCatalogDto } from "./services/dmvCatalogService.js";
import { cleanupLegacyCanadaFeeds } from "./services/legacyCanadaFeedCleanupService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend/public");
const indexPath = path.join(frontendPath, "index.html");

export function createApp() {
  const app = express();

  app.use((request, _response, next) => {
    console.log(request.method, request.url);
    next();
  });

  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ ok: true, status: "healthy" });
  });

  app.get("/api/feeds", asyncHandler(listFeeds));
  app.get("/api/dmv-catalog", (_request, response) => {
    response.json(loadDmvCatalog().map(toDmvCatalogDto));
  });
  app.post("/api/feeds", asyncHandler(createFeed));
  app.post("/api/feeds/batch-google-alerts", asyncHandler(batchImportGoogleAlertsFeeds));
  app.post("/api/admin/import-dmv", importDmvFeeds);
  app.post("/api/admin/cleanup-canada-feeds", asyncHandler(async (_request, response) => {
    response.json({
      success: true,
      ...(await cleanupLegacyCanadaFeeds()),
    });
  }));
  app.post("/api/feeds/refresh", asyncHandler(refreshAll));
  app.put("/api/feeds/:feedId", asyncHandler(updateFeed));
  app.delete("/api/feeds/:feedId", asyncHandler(deleteFeed));
  app.post("/api/feeds/:feedId/refresh", asyncHandler(refreshFeed));
  app.get("/api/articles", asyncHandler(listArticles));
  app.get("/api/image", asyncHandler(async (request, response) => {
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

    console.log(`Image proxy request: ${parsedUrl.toString()}`);

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

      console.log(`Image proxy upstream status for ${parsedUrl.toString()}: ${upstream.status}`);
      const contentType = String(upstream.headers["content-type"] || "");
      console.log(`Image proxy content-type for ${parsedUrl.toString()}: ${contentType || "unknown"}`);
      if (!contentType.startsWith("image/")) {
        console.warn(`Image proxy fallback for ${parsedUrl.toString()}: upstream content was not an image`);
        response.redirect(302, env.placeholderImage);
        return;
      }

      response.setHeader("Content-Type", contentType);
      response.setHeader("Cache-Control", "public, max-age=86400");
      if (upstream.headers["content-length"]) {
        response.setHeader("Content-Length", String(upstream.headers["content-length"]));
      }
      upstream.data.pipe(response);
    } catch (error) {
      console.error(`Image proxy fallback for ${parsedUrl.toString()}:`, error?.stack || error);
      response.redirect(302, env.placeholderImage);
    }
  }));

  app.use(express.static(frontendPath));

  app.get("/", (_request, response) => {
    if (!fs.existsSync(indexPath)) {
      response.status(500).type("text/plain").send("Missing frontend/public/index.html");
      return;
    }

    response.sendFile(indexPath, (error) => {
      if (error) {
        console.error("Root sendFile error:", error?.stack || error);
        if (!response.headersSent) {
          response.status(500).type("text/plain").send("Failed to serve dashboard");
        }
      }
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use((error, _request, response, _next) => {
    console.error("ERROR:", error?.stack || error);
    response.status(500).json({
      error: "Internal Server Error",
      message: error?.message || "Unknown error"
    });
  });

  return app;
}
