import { Router } from "express";
import { createNoiseFeedback, deleteNoiseFeedback, getArticleFilters, listArticles } from "../controllers/articleController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listArticles));
router.get("/filters", asyncHandler(getArticleFilters));
router.post("/:articleId/noise-feedback", asyncHandler(createNoiseFeedback));
router.delete("/:articleId/noise-feedback", asyncHandler(deleteNoiseFeedback));

export default router;
