import { Router } from "express";
import { listFeeds, listRecentArticles, getDashboardSummary } from "../database/firestoreService.js";

const router = Router();

router.get("/feeds", async (request, response) => {
  response.json(await listFeeds());
});

router.get("/articles", async (request, response) => {
  response.json(
    await listRecentArticles({
      topic: String(request.query.topic || ""),
      feedId: String(request.query.feedId || ""),
      date: String(request.query.date || ""),
      search: String(request.query.search || "")
    })
  );
});

router.get("/dashboard/summary", async (request, response) => {
  response.json(await getDashboardSummary());
});

export default router;
