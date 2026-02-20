import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
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

export const sqlite: DatabaseType = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('foreign_keys = ON');

// Bootstrap: add new columns for legacy DBs that were created with raw SQL
const newColumns = [
  { table: 'projects', column: 'cwd', type: 'text' },
  { table: 'projects', column: 'source', type: "text DEFAULT 'manual'" },
  { table: 'projects', column: 'last_synced_at', type: 'text' },
  { table: 'projects', column: 'sync_hash', type: 'text' },
];

for (const { table, column, type } of newColumns) {
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // Column already exists — expected on fresh DBs or repeat runs
  }
}

// Bootstrap: create agent_communications table if missing
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_communications (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      session_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      sender_raw_name TEXT,
      recipient_raw_name TEXT,
      sender_agent_id TEXT REFERENCES agents(id),
      recipient_agent_id TEXT REFERENCES agents(id),
      summary TEXT NOT NULL,
      details_json TEXT,
      tool_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
} catch {
  // Table already exists
}

// Run Drizzle Kit managed migrations (single source of truth: schema.ts)
const migrationsFolder = resolve(__dirname, '../../drizzle');
export const db = drizzle(sqlite, { schema });

if (existsSync(migrationsFolder)) {
  migrate(db, { migrationsFolder });
}

// Indexes for query performance
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_agent_comms_created_at ON agent_communications (created_at)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_agent_comms_session ON agent_communications (session_id)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_agent_comms_project ON agent_communications (project_id, created_at)`);

// Retention: prune activity_log entries older than 30 days on startup
sqlite.exec(`DELETE FROM activity_log WHERE created_at < datetime('now', '-30 days')`);

// WAL checkpoint to reclaim disk space
sqlite.pragma('wal_checkpoint(TRUNCATE)');
