import { Router } from "express";
import { getArticleFilters, listArticles } from "../controllers/articleController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listArticles));
router.get("/filters", asyncHandler(getArticleFilters));

export default router;
