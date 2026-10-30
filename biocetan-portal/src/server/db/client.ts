import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export function createDb(client: Client) {
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/**
 * Opens the SQLite database with the settings the portal relies on: foreign keys enforced
 * (SQLite leaves them off by default), WAL so reads don't block the writer, and a busy timeout
 * so a concurrent write waits instead of failing.
 */
export async function openDatabase(url: string): Promise<{ client: Client; db: Db }> {
  const client = createClient({ url });
  if (url.startsWith('file:') && !url.includes(':memory:')) {
    await client.execute('PRAGMA journal_mode = WAL');
  }
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute('PRAGMA busy_timeout = 5000');
  return { client, db: createDb(client) };
}

/** Applies pending migrations from `migrations/` (idempotent; tracked in __drizzle_migrations). */
export async function migrateDatabase(db: Db, migrationsFolder = 'migrations') {
  await migrate(db, { migrationsFolder });
}

let shared: Promise<Db> | undefined;

/** One connection for the whole server process. */
export function getSharedDb(url: string): Promise<Db> {
  shared ??= openDatabase(url).then(({ db }) => db);
  return shared;
}
