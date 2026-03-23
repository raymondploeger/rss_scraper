import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config.js";
import { initializeFirestore } from "../database/firestore.js";
import articleRoutes from "./routes/articles.js";
import feedRoutes from "./routes/feeds.js";
import dashboardRoutes from "./routes/dashboard.js";
import { startFeedScheduler } from "./scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend/public");

async function start() {
  await initializeFirestore();

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());
  app.use(express.static(frontendPath));

  app.get("/health", (request, response) => {
    response.json({ ok: true });
  });

  app.use("/api/articles", articleRoutes);
  app.use("/api/feeds", feedRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.get("*", (request, response) => {
    response.sendFile(path.join(frontendPath, "index.html"));
  });

  startFeedScheduler();

  app.listen(env.port, () => {
    console.log(`RSS Monitoring Dashboard running on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start app", error);
  process.exit(1);
});
