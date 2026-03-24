import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env, envFilePath } from "./config/env.js";
import { startScheduler } from "./services/schedulerService.js";

async function start() {
  if (!env.databaseUrl) {
    console.error("Missing DATABASE_URL. Create backend/.env file.");
    console.error("For Railway, add a PostgreSQL service and copy its DATABASE_URL into your app variables.");
    console.error(`Optional local env file path: ${envFilePath}`);
    process.exit(1);
  }

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

      disconnectDatabase()
        .catch((disconnectError) => {
          console.error("Failed to disconnect database cleanly", disconnectError);
        })
        .finally(() => {
          process.exit(0);
        });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  if (!env.databaseUrl) {
    console.error("Missing DATABASE_URL. Create backend/.env file.");
    console.error("For Railway, add a PostgreSQL service and copy its DATABASE_URL into your app variables.");
  }

  if (env.databaseUrl) {
    console.error("Could not connect to PostgreSQL using DATABASE_URL.");
    console.error("Check that Railway PostgreSQL is attached and DATABASE_URL is set on the app service.");
  }

  console.error("Failed to start server", error);
  process.exit(1);
});
