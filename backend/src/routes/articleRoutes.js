import { Router } from "express";
import { getArticleFilters, listArticles } from "../controllers/articleController.js";

const router = Router();

router.get("/", listArticles);
router.get("/filters", getArticleFilters);

export default router;
