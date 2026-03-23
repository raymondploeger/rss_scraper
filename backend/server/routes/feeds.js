import { Router } from "express";
import { createFeed, getFeeds, refreshFeed } from "../../rss/feedController.js";

const router = Router();

router.get("/", getFeeds);
router.post("/", createFeed);
router.post("/:feedId/refresh", refreshFeed);

export default router;
