const clients = new Set();

export function addClient(response) {
  clients.add(response);
}

export function removeClient(response) {
  clients.delete(response);
}

export function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(message);
  }
}

export function getClientCount() {
  return clients.size;
}
