const clients = new Set();
export function addClient(writer) {
    clients.add(writer);
}
export function removeClient(writer) {
    clients.delete(writer);
}
export function broadcast(event, data) {
    for (const writer of clients) {
        try {
            writer(event, data);
        }
        catch {
            clients.delete(writer);
        }
    }
}
//# sourceMappingURL=broadcast.js.map