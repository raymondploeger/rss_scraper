import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { listArticles } from "./controllers/articleController.js";
import { createFeed, deleteFeed, listFeeds, refreshAll, refreshFeed, updateFeed } from "./controllers/feedController.js";
import { asyncHandler } from "./utils/asyncHandler.js";

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
  app.post("/api/feeds", asyncHandler(createFeed));
  app.post("/api/feeds/refresh", asyncHandler(refreshAll));
  app.put("/api/feeds/:feedId", asyncHandler(updateFeed));
  app.delete("/api/feeds/:feedId", asyncHandler(deleteFeed));
  app.post("/api/feeds/:feedId/refresh", asyncHandler(refreshFeed));
  app.get("/api/articles", asyncHandler(listArticles));

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
