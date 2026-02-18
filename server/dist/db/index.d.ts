import Database, { type Database as DatabaseType } from 'better-sqlite3';
import * as schema from './schema.js';
export declare const sqlite: DatabaseType;
export declare const db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema> & {
    $client: Database.Database;
};
//# sourceMappingURL=index.d.ts.map