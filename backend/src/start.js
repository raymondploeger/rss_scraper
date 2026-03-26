console.log("BOOTING APPLICATION STARTUP");

import("./server.js").catch((error) => {
  console.error("Failed to import server.js", error?.stack || error);
  process.exit(1);
});
