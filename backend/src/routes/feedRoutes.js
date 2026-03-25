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
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listFeeds));
router.post("/", asyncHandler(createFeed));
router.post("/refresh", asyncHandler(refreshAll));
router.post("/process", asyncHandler(processBacklog));
router.put("/:feedId", asyncHandler(updateFeed));
router.delete("/:feedId", asyncHandler(deleteFeed));
router.post("/:feedId/refresh", asyncHandler(refreshFeed));

export default router;
