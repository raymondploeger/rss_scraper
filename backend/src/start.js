import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { env, envFilePath } from "./config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const prismaBinary = path.join(backendRoot, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");

async function run() {
  if (!env.databaseUrl) {
    console.error("Missing DATABASE_URL. Create backend/.env file.");
    console.error("For Railway, add a PostgreSQL service and copy its DATABASE_URL into your app variables.");
    console.error(`Optional local env file path: ${envFilePath}`);
    process.exit(1);
  }

  const migrate = spawnSync(prismaBinary, ["migrate", "deploy"], {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (migrate.status !== 0) {
    console.error("Prisma migrate deploy failed. Check DATABASE_URL and Railway PostgreSQL connectivity.");
    process.exit(migrate.status || 1);
  }

  await import("./server.js");
}

run().catch((error) => {
  console.error("Failed to bootstrap the application", error);
  process.exit(1);
});
