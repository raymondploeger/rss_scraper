import express from "express";

export function createApp() {
  const app = express();

  app.use((request, _response, next) => {
    console.log(request.method, request.url);
    next();
  });

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ ok: true, status: "healthy" });
  });

  app.get("/", (_request, response) => {
    response.status(200).send("RSS app is running");
  });

  app.use((_request, response) => {
    response.status(404).send("Not found");
  });

  return app;
}
