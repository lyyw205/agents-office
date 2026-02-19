import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { saved_agent_configs } from '../db/schema.js';
import { AppError } from '../middleware/error-handler.js';
import { optionalJsonString } from '../lib/validation.js';

export const savedConfigRoutes = new Hono();

const createConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  agent_type: z.enum(['master', 'pm', 'core', 'support']),
  role: z.string().min(1),
  department: z.string().optional(),
  model_tier: z.enum(['low', 'medium', 'high']).optional(),
  persona_json: optionalJsonString,
  skills_json: optionalJsonString,
  config_json: optionalJsonString,
  source_agent_id: z.string().optional(),
});

// GET / - List all saved agent configs
savedConfigRoutes.get('/', (c) => {
  const data = db
    .select()
    .from(saved_agent_configs)
    .orderBy(desc(saved_agent_configs.created_at))
    .all();
  return c.json({ data, total: data.length });
});

// POST / - Save a new agent config
savedConfigRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createConfigSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  }

  const id = nanoid();
  db.insert(saved_agent_configs).values({ id, ...parsed.data }).run();

  const config = db
    .select()
    .from(saved_agent_configs)
    .where(eq(saved_agent_configs.id, id))
    .get();
  return c.json(config, 201);
});

// GET /:id - Get config detail
savedConfigRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const config = db
    .select()
    .from(saved_agent_configs)
    .where(eq(saved_agent_configs.id, id))
    .get();
  if (!config) throw new AppError('Saved config not found', 404, 'NOT_FOUND');
  return c.json(config);
});

// DELETE /:id - Delete saved config
savedConfigRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');
  const config = db
    .select()
    .from(saved_agent_configs)
    .where(eq(saved_agent_configs.id, id))
    .get();
  if (!config) throw new AppError('Saved config not found', 404, 'NOT_FOUND');

  db.delete(saved_agent_configs).where(eq(saved_agent_configs.id, id)).run();
  return c.json({ success: true });
});
