import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  display_name: text('display_name').notNull(),
  description: text('description'),
  status: text('status').default('active'),
  priority: text('priority').default('medium'),
  config_json: text('config_json'),
  scene_config: text('scene_config'),
  cwd: text('cwd'),
  source: text('source').default('manual'), // 'manual' | 'synced' | 'seed'
  last_synced_at: text('last_synced_at'),
  sync_hash: text('sync_hash'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
});

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  project_id: text('project_id').references(() => projects.id),
  parent_id: text('parent_id'),
  name: text('name').notNull(),
  agent_type: text('agent_type').notNull(), // master|pm|core|support
  role: text('role').notNull(),
  department: text('department'),
  status: text('status').default('inactive'), // inactive|idle|working|completed|failed
  model_tier: text('model_tier').default('medium'),
  emoji: text('emoji'),
  persona_json: text('persona_json'),
  skills_json: text('skills_json'),
  config_json: text('config_json'),
  sprite_key: text('sprite_key'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (table) => ({
  projectNameUnique: uniqueIndex('idx_agents_project_name').on(table.project_id, table.name),
}));

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  description: text('description'),
  steps_json: text('steps_json').notNull(),
  estimated_time: text('estimated_time'),
  status: text('status').default('idle'),
  current_step: integer('current_step').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (table) => ({
  projectNameUnique: uniqueIndex('idx_workflows_project_name').on(table.project_id, table.name),
}));

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id),
  agent_id: text('agent_id').references(() => agents.id),
  workflow_id: text('workflow_id').references(() => workflows.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('pending'), // pending|in_progress|completed|failed|cancelled|blocked
  priority: text('priority').default('medium'),
  input_json: text('input_json'),
  output_json: text('output_json'),
  error_json: text('error_json'),
  started_at: text('started_at'),
  completed_at: text('completed_at'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const activity_log = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  agent_id: text('agent_id').references(() => agents.id),
  project_id: text('project_id').references(() => projects.id),
  task_id: text('task_id').references(() => tasks.id),
  action: text('action').notNull(),
  details_json: text('details_json'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const saved_agent_configs = sqliteTable('saved_agent_configs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  agent_type: text('agent_type').notNull(),
  role: text('role').notNull(),
  department: text('department'),
  model_tier: text('model_tier').default('medium'),
  persona_json: text('persona_json'),
  skills_json: text('skills_json'),
  config_json: text('config_json'),
  source_agent_id: text('source_agent_id').references(() => agents.id),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});
