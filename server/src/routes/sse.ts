import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { addClient, removeClient } from '../sse/broadcast.js';

export const sseRoutes = new Hono();

// GET / - SSE endpoint
sseRoutes.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    const writer = (event: string, data: string) => {
      stream.writeSSE({ event, data });
    };

    addClient(writer);

    // Send initial connection event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ message: 'SSE connection established', timestamp: new Date().toISOString() }),
    });

    // Heartbeat loop every 30 seconds
    try {
      while (true) {
        await stream.sleep(30_000);
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        });
      }
    } finally {
      removeClient(writer);
    }
  });
});
