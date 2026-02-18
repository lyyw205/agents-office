import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { activity_log } from '../db/schema.js';

export const activityRoutes = new Hono();

// GET / - List activity log entries
activityRoutes.get('/', (c) => {
  const projectId = c.req.query('project_id');
  const agentId = c.req.query('agent_id');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const conditions = [];
  if (projectId) conditions.push(eq(activity_log.project_id, projectId));
  if (agentId) conditions.push(eq(activity_log.agent_id, agentId));

  const query = db.select().from(activity_log).orderBy(desc(activity_log.created_at));
  const data =
    conditions.length > 0
      ? query.where(and(...conditions)).limit(limit).offset(offset).all()
      : query.limit(limit).offset(offset).all();

  return c.json({ data, total: data.length, limit, offset });
});
