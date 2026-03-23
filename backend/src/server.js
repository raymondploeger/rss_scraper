import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { startScheduler } from "./services/schedulerService.js";

async function start() {
  await connectDatabase();
  startScheduler();

  const app = createApp();
  const server = app.listen(env.port, env.host, () => {
    console.log(`RSS monitor backend running on http://${env.host}:${env.port}`);
  });

  server.on("error", (error) => {
    console.error(`Failed to listen on http://${env.host}:${env.port}`, error);
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully.`);
    server.close((error) => {
      if (error) {
        console.error("Failed to close HTTP server cleanly", error);
        process.exit(1);
      }

      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
