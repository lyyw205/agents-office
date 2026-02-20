import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { projects, agents, tasks, activity_log } from '../db/schema.js';
import { AppError } from '../middleware/error-handler.js';
import { optionalJsonString } from '../lib/validation.js';
import { exportSceneConfig } from '../lib/dashboard-export.js';

export const projectRoutes = new Hono();

const createProjectSchema = z.object({
  name: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  config_json: optionalJsonString,
  scene_config: optionalJsonString,
});

const updateProjectSchema = z.object({
  display_name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'planned', 'archived', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  config_json: optionalJsonString,
  scene_config: optionalJsonString,
});

const createAgentSchema = z.object({
  name: z.string().min(1),
  agent_type: z.enum(['master', 'pm', 'core', 'support']),
  role: z.string().min(1),
  department: z.string().optional(),
  parent_id: z.string().optional(),
  model_tier: z.enum(['low', 'medium', 'high']).optional(),
  emoji: z.string().optional(),
  persona_json: optionalJsonString,
  skills_json: optionalJsonString,
  config_json: optionalJsonString,
  sprite_key: z.string().optional(),
});

// GET / - List all projects with agent and task counts
projectRoutes.get('/', (c) => {
  const rows = db.select().from(projects).orderBy(desc(projects.created_at)).all();

  const data = rows.map((p) => {
    const agentCount = db
      .select({ count: count() })
      .from(agents)
      .where(eq(agents.project_id, p.id))
      .get();
    const taskCount = db
      .select({ count: count() })
      .from(tasks)
      .where(eq(tasks.project_id, p.id))
      .get();
    return {
      ...p,
      agent_count: agentCount?.count ?? 0,
      task_count: taskCount?.count ?? 0,
    };
  });

  return c.json({ data, total: data.length });
});

// POST / - Create new project
projectRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const { name, display_name, description, priority, config_json, scene_config } = parsed.data;

  const existing = db.select().from(projects).where(eq(projects.name, name)).get();
  if (existing) {
    throw new AppError(`Project with name "${name}" already exists`, 409, 'CONFLICT');
  }

  const id = nanoid();
  db.insert(projects)
    .values({ id, name, display_name, description, priority, config_json, scene_config })
    .run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: id,
      action: 'project_created',
      details_json: JSON.stringify({ name, display_name }),
    })
    .run();

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  return c.json(project, 201);
});

// GET /:id - Get project detail with agents and recent tasks
projectRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const agentList = db
    .select()
    .from(agents)
    .where(eq(agents.project_id, id))
    .orderBy(desc(agents.created_at))
    .all();

  const recentTasks = db
    .select()
    .from(tasks)
    .where(eq(tasks.project_id, id))
    .orderBy(desc(tasks.created_at))
    .limit(20)
    .all();

  return c.json({ ...project, agents: agentList, recent_tasks: recentTasks });
});

// PATCH /:id - Update project
projectRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const body = await c.req.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const updates = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  db.update(projects).set(updates).where(eq(projects.id, id)).run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: id,
      action: 'project_updated',
      details_json: JSON.stringify(parsed.data),
    })
    .run();

  // Auto-export scene_config to seed-data for git portability
  if (parsed.data.scene_config !== undefined) {
    exportSceneConfig(project.name, parsed.data.scene_config ?? project.scene_config);
  }

  const updated = db.select().from(projects).where(eq(projects.id, id)).get();
  return c.json(updated);
});

// DELETE /:id - Soft delete (archive)
projectRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  db.update(projects)
    .set({ status: 'archived', updated_at: new Date().toISOString() })
    .where(eq(projects.id, id))
    .run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: id,
      action: 'project_archived',
      details_json: JSON.stringify({ id }),
    })
    .run();

  return c.json({ success: true });
});

// GET /:id/agents - List agents for a project with parent hierarchy
projectRoutes.get('/:id/agents', (c) => {
  const id = c.req.param('id');
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const data = db
    .select()
    .from(agents)
    .where(eq(agents.project_id, id))
    .orderBy(desc(agents.created_at))
    .all();

  return c.json({ data, total: data.length });
});

// POST /:id/agents - Create agent under project
projectRoutes.post('/:id/agents', async (c) => {
  const projectId = c.req.param('id');
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

  const body = await c.req.json();
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const id = nanoid();
  db.insert(agents)
    .values({ id, project_id: projectId, ...parsed.data })
    .run();

  db.insert(activity_log)
    .values({
      id: nanoid(),
      project_id: projectId,
      agent_id: id,
      action: 'agent_created',
      details_json: JSON.stringify({ name: parsed.data.name, role: parsed.data.role }),
    })
    .run();

  const agent = db.select().from(agents).where(eq(agents.id, id)).get();
  return c.json(agent, 201);
});
