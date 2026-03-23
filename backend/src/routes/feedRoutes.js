import { Router } from "express";
import {
  createFeed,
  deleteFeed,
  listFeeds,
  processBacklog,
  refreshAll,
  refreshFeed,
  updateFeed
} from "../controllers/feedController.js";

const router = Router();

router.get("/", listFeeds);
router.post("/", createFeed);
router.post("/refresh", refreshAll);
router.post("/process", processBacklog);
router.put("/:id", updateFeed);
router.delete("/:id", deleteFeed);
router.post("/:id/refresh", refreshFeed);

export default router;
