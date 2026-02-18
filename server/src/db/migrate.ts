import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationsFolder = resolve(__dirname, '../../drizzle');

console.log('Running migrations from:', migrationsFolder);

migrate(db, { migrationsFolder });

console.log('Migrations complete.');
