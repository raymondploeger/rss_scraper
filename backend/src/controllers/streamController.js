import { addClient, removeClient } from "../services/realtimeService.js";

export function streamEvents(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  response.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  addClient(response);

  request.on("close", () => {
    removeClient(response);
    response.end();
  });
}
