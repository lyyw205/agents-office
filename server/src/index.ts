import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { projectRoutes } from './routes/projects.js';
import { agentRoutes } from './routes/agents.js';
import { taskRoutes } from './routes/tasks.js';
import { workflowRoutes } from './routes/workflows.js';
import { activityRoutes } from './routes/activity.js';
import { sseRoutes } from './routes/sse.js';
import { savedConfigRoutes } from './routes/saved-configs.js';
import { hookRoutes, startSessionTimeoutChecker } from './routes/hooks.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { getClientCount, broadcast } from './sse/broadcast.js';
import { sqlite } from './db/index.js';
import { setupGracefulShutdown, registerInterval } from './lib/graceful-shutdown.js';

const startTime = Date.now();

const app = new Hono();

const allowedOrigins = process.env['CORS_ORIGINS']
  ? process.env['CORS_ORIGINS'].split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

// Middleware
app.use('*', requestLogger);
app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));
// Rate limiter: exclude /api/hooks/* (localhost-only, high-frequency hook events)
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/hooks')) {
    return next();
  }
  return rateLimiter({ windowMs: 60_000, max: 200 })(c, next);
});
// Stricter limit on write operations
app.use('/api/tasks/*/execute', rateLimiter({ windowMs: 60_000, max: 10 }));

// API Routes
app.route('/api/projects', projectRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/workflows', workflowRoutes);
app.route('/api/activity', activityRoutes);
app.route('/api/saved-configs', savedConfigRoutes);
app.route('/api/sse', sseRoutes);
app.route('/api/hooks', hookRoutes);


// Health check
app.get('/api/health', async (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // DB health check
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbTables = 0;
  let dbPath = '';
  try {
    const result = sqlite.prepare("SELECT count(*) as cnt FROM projects").get() as { cnt: number } | undefined;
    dbPath = (sqlite as unknown as { name: string }).name ?? '';
    const tableResult = sqlite
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table'")
      .get() as { cnt: number } | undefined;
    dbTables = tableResult?.cnt ?? 0;
    void result;
  } catch {
    dbStatus = 'error';
  }

  // Bridge health check - optional, may not exist yet
  let bridgeStatus: 'ok' | 'unavailable' = 'unavailable';
  let activeProcesses = 0;
  let queueLength = 0;
  const maxConcurrent = parseInt(process.env['MAX_CONCURRENT_AGENTS'] ?? '', 10) || 3;
  try {
    const bridgeMod = await import('./bridge/index.js').catch(() => null);
    if (bridgeMod?.bridge) {
      const status = bridgeMod.bridge.getStatus();
      bridgeStatus = 'ok';
      activeProcesses = status.active.length;
      queueLength = status.queueLength;
    }
  } catch {
    // Bridge not available
  }

  const overallStatus: 'ok' | 'degraded' | 'error' =
    dbStatus === 'error' ? 'error' : bridgeStatus === 'unavailable' ? 'degraded' : 'ok';

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime,
    db: {
      status: dbStatus,
      path: dbPath,
      tables: dbTables,
    },
    bridge: {
      status: bridgeStatus,
      activeProcesses,
      queueLength,
      maxConcurrent,
    },
    sse: {
      connectedClients: getClientCount(),
    },
    memory: (() => {
      const mem = process.memoryUsage();
      return {
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        external_mb: Math.round(mem.external / 1024 / 1024),
      };
    })(),
  });
});

// Serve dashboard static files in production
if (process.env['NODE_ENV'] === 'production') {
  app.use('/*', serveStatic({ root: './dashboard/dist' }));
}

// Error handler
app.onError(errorHandler);

// Start server
const port = parseInt(process.env['PORT'] ?? '', 10) || 3001;
console.log(`[server] Agents Office API running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});


// Session timeout checker for hook-based activity detection
const sessionTimeoutInterval = startSessionTimeoutChecker();
registerInterval(sessionTimeoutInterval);

// Periodic DB maintenance: prune old activity logs + WAL checkpoint (every 24h)
const maintenanceInterval = setInterval(() => {
  try {
    sqlite.exec(`DELETE FROM activity_log WHERE created_at < datetime('now', '-30 days')`);
    sqlite.exec(`DELETE FROM agent_communications WHERE created_at < datetime('now', '-30 days')`);
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('[db] Maintenance failed:', err);
  }
}, 24 * 60 * 60_000);
registerInterval(maintenanceInterval);

// Graceful shutdown
setupGracefulShutdown(sqlite);

export default app;
