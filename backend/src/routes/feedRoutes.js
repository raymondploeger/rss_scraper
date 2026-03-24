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
router.put("/:feedId", updateFeed);
router.delete("/:feedId", deleteFeed);
router.post("/:feedId/refresh", refreshFeed);

export default router;
