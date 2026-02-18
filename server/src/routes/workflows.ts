import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { workflows, tasks, activity_log } from '../db/schema.js';
import { AppError } from '../middleware/error-handler.js';

export const workflowRoutes = new Hono();

const createWorkflowSchema = z.object({
  project_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  steps_json: z.string().min(1),
  estimated_time: z.string().optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  steps_json: z.string().optional(),
  estimated_time: z.string().optional(),
  status: z.enum(['idle', 'running', 'completed', 'failed', 'paused']).optional(),
  current_step: z.number().int().min(0).optional(),
});

// GET / - List workflows, optionally filtered by project_id
workflowRoutes.get('/', (c) => {
  const projectId = c.req.query('project_id');

  const data = projectId
    ? db
        .select()
        .from(workflows)
        .where(eq(workflows.project_id, projectId))
        .orderBy(desc(workflows.created_at))
        .all()
    : db.select().from(workflows).orderBy(desc(workflows.created_at)).all();

  return c.json({ data, total: data.length });
});

// POST / - Create workflow
workflowRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const id = nanoid();
  db.insert(workflows).values({ id, ...parsed.data }).run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: parsed.data.project_id,
      action: 'workflow_created',
      details_json: JSON.stringify({ name: parsed.data.name }),
    })
    .run();

  const workflow = db.select().from(workflows).where(eq(workflows.id, id)).get();
  return c.json(workflow, 201);
});

// GET /:id - Get workflow detail with steps parsed and associated tasks
workflowRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const workflow = db.select().from(workflows).where(eq(workflows.id, id)).get();
  if (!workflow) throw new AppError('Workflow not found', 404, 'NOT_FOUND');

  const workflowTasks = db
    .select()
    .from(tasks)
    .where(eq(tasks.workflow_id, id))
    .orderBy(desc(tasks.created_at))
    .all();

  let steps: unknown = null;
  try {
    steps = JSON.parse(workflow.steps_json);
  } catch {
    steps = workflow.steps_json;
  }

  return c.json({ ...workflow, steps, tasks: workflowTasks });
});

// PATCH /:id - Update workflow status
workflowRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const workflow = db.select().from(workflows).where(eq(workflows.id, id)).get();
  if (!workflow) throw new AppError('Workflow not found', 404, 'NOT_FOUND');

  const body = await c.req.json();
  const parsed = updateWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  db.update(workflows).set(parsed.data).where(eq(workflows.id, id)).run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: workflow.project_id,
      action: 'workflow_updated',
      details_json: JSON.stringify(parsed.data),
    })
    .run();

  const updated = db.select().from(workflows).where(eq(workflows.id, id)).get();
  return c.json(updated);
});
