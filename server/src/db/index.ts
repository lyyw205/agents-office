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

// Run Drizzle Kit managed migrations (single source of truth: schema.ts)
const migrationsFolder = resolve(__dirname, '../../drizzle');
export const db = drizzle(sqlite, { schema });

if (existsSync(migrationsFolder)) {
  migrate(db, { migrationsFolder });
}
