import express from "express";
import { listFeeds } from "./controllers/feedController.js";
import { asyncHandler } from "./utils/asyncHandler.js";

export function createApp() {
  const app = express();

  app.use((request, _response, next) => {
    console.log(request.method, request.url);
    next();
  });

  app.get("/", (_request, response) => {
    response.status(200).send("RSS app is running");
  });

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ ok: true, status: "healthy" });
  });

  app.get("/api/feeds", asyncHandler(listFeeds));

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
