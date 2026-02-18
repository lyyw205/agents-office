import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { projectRoutes } from './routes/projects.js';
import { agentRoutes } from './routes/agents.js';
import { taskRoutes } from './routes/tasks.js';
import { workflowRoutes } from './routes/workflows.js';
import { activityRoutes } from './routes/activity.js';
import { sseRoutes } from './routes/sse.js';
import { savedConfigRoutes } from './routes/saved-configs.js';
import { errorHandler } from './middleware/error-handler.js';
const app = new Hono();
// Middleware
app.use('*', logger());
app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
}));
// API Routes
app.route('/api/projects', projectRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/workflows', workflowRoutes);
app.route('/api/activity', activityRoutes);
app.route('/api/saved-configs', savedConfigRoutes);
app.route('/api/sse', sseRoutes);
// Health check
app.get('/api/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
// Error handler
app.onError(errorHandler);
// Start server
const port = 3001;
console.log(`[server] Agents Office API running on http://localhost:${port}`);
serve({
    fetch: app.fetch,
    port,
});
export default app;
//# sourceMappingURL=index.js.map