import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// When running via tsx, __dirname is server/src/db/ -> go up 3 levels to project root
const dataDir = resolve(__dirname, '../../../data');
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}
const dbPath = resolve(dataDir, 'agents-office.db');
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
// Auto-create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    priority TEXT DEFAULT 'medium',
    config_json TEXT,
    scene_config TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    parent_id TEXT,
    name TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    status TEXT DEFAULT 'inactive',
    model_tier TEXT DEFAULT 'medium',
    emoji TEXT,
    persona_json TEXT,
    skills_json TEXT,
    config_json TEXT,
    sprite_key TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    description TEXT,
    steps_json TEXT NOT NULL,
    estimated_time TEXT,
    status TEXT DEFAULT 'idle',
    current_step INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    agent_id TEXT REFERENCES agents(id),
    workflow_id TEXT REFERENCES workflows(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    input_json TEXT,
    output_json TEXT,
    error_json TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id),
    project_id TEXT REFERENCES projects(id),
    task_id TEXT REFERENCES tasks(id),
    action TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS saved_agent_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    agent_type TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    model_tier TEXT DEFAULT 'medium',
    persona_json TEXT,
    skills_json TEXT,
    config_json TEXT,
    source_agent_id TEXT REFERENCES agents(id),
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
export const db = drizzle(sqlite, { schema });
//# sourceMappingURL=index.js.map