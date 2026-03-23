import { Router } from "express";
import { streamEvents } from "../controllers/streamController.js";

const router = Router();

router.get("/", streamEvents);

export default router;
