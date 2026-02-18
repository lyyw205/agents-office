import type { Database as DatabaseType } from 'better-sqlite3';

let shuttingDown = false;

export function setupGracefulShutdown(sqlite: DatabaseType): void {
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[server] Received ${signal}. Starting graceful shutdown...`);

    const finalize = () => {
      try {
        sqlite.close();
        console.log('[server] Database connection closed.');
      } catch (err) {
        console.error('[server] Error closing database:', err);
      }
      console.log('[server] Shutdown complete.');
      process.exit(0);
    };

    // Attempt to clean up bridge subprocess references if the module is loaded
    import('../bridge/index.js')
      .then((bridgeMod) => {
        if (bridgeMod?.bridge && typeof bridgeMod.bridge.shutdown === 'function') {
          bridgeMod.bridge.shutdown();
          console.log('[server] Bridge processes cleaned up.');
        }
      })
      .catch(() => {
        // Bridge module not available - that's fine
      })
      .finally(finalize);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
