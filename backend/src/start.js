import { env, envFilePath } from "./config/env.js";

async function run() {
  if (!env.databaseUrl) {
    console.error("Missing DATABASE_URL. Create backend/.env file.");
    console.error("For Railway, add a PostgreSQL service and copy its DATABASE_URL into your app variables.");
    console.error(`Optional local env file path: ${envFilePath}`);
    process.exit(1);
  }

  await import("./server.js");
}

run().catch((error) => {
  console.error("Failed to bootstrap the application", error);
  process.exit(1);
});
