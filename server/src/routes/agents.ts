import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { agents, tasks, activity_log } from '../db/schema.js';
import { AppError } from '../middleware/error-handler.js';
import { broadcast } from '../sse/broadcast.js';
import { optionalJsonString } from '../lib/validation.js';

export const agentRoutes = new Hono();

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  department: z.string().optional(),
  status: z.enum(['inactive', 'idle', 'working', 'completed', 'failed']).optional(),
  model_tier: z.enum(['low', 'medium', 'high']).optional(),
  emoji: z.string().optional(),
  persona_json: optionalJsonString,
  skills_json: optionalJsonString,
  config_json: optionalJsonString,
  sprite_key: z.string().optional(),
});

const cloneAgentSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  department: z.string().optional(),
  project_id: z.string().optional(),
  parent_id: z.string().optional(),
  model_tier: z.enum(['low', 'medium', 'high']).optional(),
  emoji: z.string().optional(),
  persona_json: optionalJsonString,
  skills_json: optionalJsonString,
  config_json: optionalJsonString,
  sprite_key: z.string().optional(),
});

// GET / - List all agents
agentRoutes.get('/', (c) => {
  const rows = db.select().from(agents).orderBy(desc(agents.created_at)).all();
  return c.json({ data: rows, total: rows.length });
});

// GET /:id - Get agent detail with tasks and recent activity
agentRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const agent = db.select().from(agents).where(eq(agents.id, id)).get();
  if (!agent) throw new AppError('Agent not found', 404, 'NOT_FOUND');

  const agentTasks = db
    .select()
    .from(tasks)
    .where(eq(tasks.agent_id, id))
    .orderBy(desc(tasks.created_at))
    .limit(20)
    .all();

  const recentActivity = db
    .select()
    .from(activity_log)
    .where(eq(activity_log.agent_id, id))
    .orderBy(desc(activity_log.created_at))
    .limit(20)
    .all();

  return c.json({ ...agent, tasks: agentTasks, recent_activity: recentActivity });
});

// PATCH /:id - Update agent
agentRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const agent = db.select().from(agents).where(eq(agents.id, id)).get();
  if (!agent) throw new AppError('Agent not found', 404, 'NOT_FOUND');

  const body = await c.req.json();
  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const updates = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  db.update(agents).set(updates).where(eq(agents.id, id)).run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      agent_id: id,
      project_id: agent.project_id,
      action: 'agent_updated',
      details_json: JSON.stringify(parsed.data),
    })
    .run();

  const updated = db.select().from(agents).where(eq(agents.id, id)).get();
  broadcast('agent_status', JSON.stringify(updated));
  return c.json(updated);
});

// DELETE /:id - Soft delete (set inactive)
agentRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');
  const agent = db.select().from(agents).where(eq(agents.id, id)).get();
  if (!agent) throw new AppError('Agent not found', 404, 'NOT_FOUND');

  db.update(agents)
    .set({ status: 'inactive', updated_at: new Date().toISOString() })
    .where(eq(agents.id, id))
    .run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      agent_id: id,
      project_id: agent.project_id,
      action: 'agent_deactivated',
      details_json: JSON.stringify({ id }),
    })
    .run();

  return c.json({ success: true });
});

// POST /:id/clone - Clone agent
agentRoutes.post('/:id/clone', async (c) => {
  const id = c.req.param('id');
  const source = db.select().from(agents).where(eq(agents.id, id)).get();
  if (!source) throw new AppError('Agent not found', 404, 'NOT_FOUND');

  const body = await c.req.json().catch(() => ({}));
  const parsed = cloneAgentSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const newId = nanoid();
  const clonedName = parsed.data.name ?? `${source.name} (copy)`;

  db.insert(agents)
    .values({
      id: newId,
      project_id: parsed.data.project_id ?? source.project_id,
      parent_id: parsed.data.parent_id ?? source.parent_id,
      name: clonedName,
      agent_type: source.agent_type,
      role: parsed.data.role ?? source.role,
      department: parsed.data.department ?? source.department,
      status: 'inactive',
      model_tier: parsed.data.model_tier ?? source.model_tier,
      emoji: parsed.data.emoji ?? source.emoji,
      persona_json: parsed.data.persona_json ?? source.persona_json,
      skills_json: parsed.data.skills_json ?? source.skills_json,
      config_json: parsed.data.config_json ?? source.config_json,
      sprite_key: parsed.data.sprite_key ?? source.sprite_key,
    })
    .run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      agent_id: newId,
      project_id: parsed.data.project_id ?? source.project_id,
      action: 'agent_cloned',
      details_json: JSON.stringify({ source_id: id, name: clonedName }),
    })
    .run();

  const cloned = db.select().from(agents).where(eq(agents.id, newId)).get();
  return c.json(cloned, 201);
});
