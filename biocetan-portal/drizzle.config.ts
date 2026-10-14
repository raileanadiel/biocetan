import { defineConfig } from 'drizzle-kit';

// Only generates SQL; migrations are applied by wrangler (`npm run db:migrate:local|remote`),
// which tracks them in D1's `d1_migrations` table.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './migrations',
});
