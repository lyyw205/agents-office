type Writer = (event: string, data: string) => void;

const clients = new Set<Writer>();

export function addClient(writer: Writer): void {
  clients.add(writer);
}

export function removeClient(writer: Writer): void {
  clients.delete(writer);
}

export function broadcast(event: string, data: string): void {
  for (const writer of clients) {
    try {
      writer(event, data);
    } catch {
      clients.delete(writer);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
