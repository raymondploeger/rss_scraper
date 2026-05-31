import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env, envFilePath } from "./config/env.js";
import { startScheduler } from "./services/schedulerService.js";
import { ensureStrategicFeeds } from "./services/strategicFeedBootstrapService.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import {
  markDatabaseConnected,
  markMigrationsApplied,
  markSchedulerStarted,
  setBootstrapError
} from "./services/runtimeState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const prismaBinary = path.join(backendRoot, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

let schedulerStarted = false;

process.on("uncaughtException", (error) => {
  console.error("uncaughtException:", error?.stack || error);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason && reason.stack ? reason.stack : reason);
});

function runMigrationsInBackground() {
  return new Promise((resolve, reject) => {
    const child = spawn(prismaBinary, ["migrate", "deploy"], {
      cwd: backendRoot,
      stdio: "inherit",
      env: process.env
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Prisma migrate deploy exited with code ${code || 1}`));
    });

    child.on("error", reject);
  });
}

async function bootstrapRuntime() {
  await connectDatabase();
  markDatabaseConnected(true);
  await runMigrationsInBackground();
  markMigrationsApplied(true);
  await ensureStrategicFeeds();

  if (!schedulerStarted) {
    startScheduler();
    schedulerStarted = true;
    markSchedulerStarted(true);
  }

  console.log("Background bootstrap complete.");
}

async function start() {
  if (!env.databaseUrl) {
    console.error("Missing DATABASE_URL. Create backend/.env file.");
    console.error("For Railway, add a PostgreSQL service and copy its DATABASE_URL into your app variables.");
    console.error(`Optional local env file path: ${envFilePath}`);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on ${PORT}`);
    void startBackgroundTasks();
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

  server.on("error", (error) => {
    console.error(`Failed to listen on ${HOST}:${PORT}`, error);
    process.exit(1);
  });
}

async function startBackgroundTasks() {
  try {
    await bootstrapRuntime();
    setBootstrapError(null);
    console.log("Database ready");
  } catch (error) {
    setBootstrapError(error);
    console.error("Background init failed", error);
  }
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
