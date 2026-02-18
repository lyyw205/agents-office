import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { tasks, agents, activity_log } from '../db/schema.js';
import { AppError } from '../middleware/error-handler.js';
import { broadcast } from '../sse/broadcast.js';
import { bridge } from '../bridge/index.js';

export const taskRoutes = new Hono();

const createTaskSchema = z.object({
  project_id: z.string().min(1),
  title: z.string().min(1),
  agent_id: z.string().optional(),
  workflow_id: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  input_json: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'blocked'])
    .optional(),
  agent_id: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  output_json: z.string().optional(),
  error_json: z.string().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
});

// GET / - List tasks with optional filters
taskRoutes.get('/', (c) => {
  const projectId = c.req.query('project_id');
  const agentId = c.req.query('agent_id');
  const status = c.req.query('status');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const conditions = [];
  if (projectId) conditions.push(eq(tasks.project_id, projectId));
  if (agentId) conditions.push(eq(tasks.agent_id, agentId));
  if (status) conditions.push(eq(tasks.status, status));

  const query = db.select().from(tasks).orderBy(desc(tasks.created_at));
  const data =
    conditions.length > 0
      ? query.where(and(...conditions)).limit(limit).offset(offset).all()
      : query.limit(limit).offset(offset).all();

  return c.json({ data, total: data.length, limit, offset });
});

// POST / - Create task
taskRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const id = nanoid();
  db.insert(tasks).values({ id, ...parsed.data }).run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: parsed.data.project_id,
      agent_id: parsed.data.agent_id,
      task_id: id,
      action: 'task_created',
      details_json: JSON.stringify({ title: parsed.data.title }),
    })
    .run();

  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  return c.json(task, 201);
});

// GET /:id - Get task detail
taskRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND');
  return c.json(task);
});

// PATCH /:id - Update task
taskRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND');

  const body = await c.req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  // Auto-set timestamps based on status transitions
  const now = new Date().toISOString();
  const extra: Record<string, string | null> = {};
  if (parsed.data.status === 'in_progress' && !task.started_at) {
    extra.started_at = now;
  }
  if (
    (parsed.data.status === 'completed' ||
      parsed.data.status === 'failed' ||
      parsed.data.status === 'cancelled') &&
    !task.completed_at
  ) {
    extra.completed_at = now;
  }

  db.update(tasks)
    .set({ ...parsed.data, ...extra })
    .where(eq(tasks.id, id))
    .run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: task.project_id,
      agent_id: parsed.data.agent_id !== undefined ? parsed.data.agent_id : task.agent_id,
      task_id: id,
      action: 'task_updated',
      details_json: JSON.stringify(parsed.data),
    })
    .run();

  const updated = db.select().from(tasks).where(eq(tasks.id, id)).get();
  broadcast('task_updated', JSON.stringify(updated));
  return c.json(updated);
});

// POST /:id/execute - Execute task via Agent Bridge
taskRoutes.post('/:id/execute', async (c) => {
  const id = c.req.param('id');
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND');

  if (task.status !== 'pending' && task.status !== 'failed') {
    throw new AppError(
      `Task is not executable in status '${task.status}'. Must be 'pending' or 'failed'.`,
      409,
      'INVALID_STATUS'
    );
  }

  const now = new Date().toISOString();

  // Set task to in_progress
  db.update(tasks)
    .set({ status: 'in_progress', started_at: now })
    .where(eq(tasks.id, id))
    .run();

  // Set agent to working if assigned
  const agentId = task.agent_id;
  if (agentId) {
    db.update(agents)
      .set({ status: 'working', updated_at: now })
      .where(eq(agents.id, agentId))
      .run();
    broadcast('agent_status', JSON.stringify({ agentId, status: 'working', taskId: id }));
  }

  db.insert(activity_log)
    .values({
      id: nanoid(),
      agent_id: agentId,
      project_id: task.project_id,
      task_id: id,
      action: 'task_execution_started',
      details_json: JSON.stringify({ taskId: id }),
    })
    .run();

  broadcast('task_updated', JSON.stringify({ ...task, status: 'in_progress', started_at: now }));

  // Dispatch to bridge (non-blocking)
  const { queued, position } = await bridge.executeTask(id);

  return c.json(
    {
      message: queued ? 'Task queued for execution' : 'Task execution started',
      taskId: id,
      queued,
      ...(queued ? { queuePosition: position } : {}),
    },
    202
  );
});
