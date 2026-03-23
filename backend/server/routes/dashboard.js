import { Router } from "express";
import { getDashboardSummary } from "../../rss/dashboardController.js";

const router = Router();

router.get("/summary", getDashboardSummary);

export default router;
