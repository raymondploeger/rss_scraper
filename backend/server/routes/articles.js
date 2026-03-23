import { Router } from "express";
import { getArticles } from "../../rss/articleController.js";

const router = Router();

router.get("/", getArticles);

export default router;
