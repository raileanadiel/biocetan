// Applies pending database migrations (migrations/*.sql) to DATABASE_URL. Idempotent: drizzle
// records what ran in __drizzle_migrations. `npm start` runs it before the server, so a deploy
// of new code also brings the schema up to date.
//
//   npm run db:migrate          (reads .env locally; on the VM the systemd environment)
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL ?? 'file:./data/portal.db';
if (url.startsWith('file:')) mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });

const client = createClient({ url });
await client.execute('PRAGMA journal_mode = WAL');
await client.execute('PRAGMA foreign_keys = ON');
const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));
await migrate(drizzle(client), { migrationsFolder });
client.close();
console.log(`Database up to date: ${url}`);
