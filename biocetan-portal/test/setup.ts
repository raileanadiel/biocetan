import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, vi } from 'vitest';

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
    }
  }
}

// Applying migrations is idempotent (tracked in d1_migrations).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Storage persists across the tests of a file, so every test starts from empty tables. The
// audit log's append-only triggers block DELETE, so they're dropped for the wipe and recreated
// from the migration itself (one source of truth for their SQL).
const TABLES_CHILD_FIRST = [
  'sessions',
  'recovery_codes',
  'auth_tokens',
  'throttle',
  'audit_log',
  'users',
  'companies',
];
const auditTriggers = env.TEST_MIGRATIONS.flatMap((m) => m.queries).filter((q) =>
  /CREATE TRIGGER `audit_log_/.test(q),
);

async function resetDatabase() {
  await env.DB.batch([
    env.DB.prepare('DROP TRIGGER IF EXISTS audit_log_no_update'),
    env.DB.prepare('DROP TRIGGER IF EXISTS audit_log_no_delete'),
    ...TABLES_CHILD_FIRST.map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
    ...auditTriggers.map((q) => env.DB.prepare(q)),
  ]);
}

/** Mails "sent" during the current test (the Resend API is never really called). */
export const sentMails: { to: string[]; subject: string; html: string; text: string }[] = [];

beforeEach(async () => {
  await resetDatabase();
  sentMails.length = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${env.RESEND_API_URL}/emails`) {
      sentMails.push(JSON.parse(String(init?.body)));
      return Response.json({ id: crypto.randomUUID() });
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
