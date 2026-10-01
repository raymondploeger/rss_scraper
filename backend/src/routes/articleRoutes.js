import { Router } from "express";
import { createNoiseFeedback, getArticleFilters, listArticles } from "../controllers/articleController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listArticles));
router.get("/filters", asyncHandler(getArticleFilters));
router.post("/:articleId/noise-feedback", asyncHandler(createNoiseFeedback));

export default router;
