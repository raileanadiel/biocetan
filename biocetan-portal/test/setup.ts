import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, vi } from 'vitest';
import type { PortalConfig } from '../src/server/config';
import { migrateDatabase, openDatabase, type Db } from '../src/server/db/client';

export const testConfig: PortalConfig = {
  DATABASE_URL: '',
  PORTAL_URL: 'https://portal.test',
  MAIL_FROM: 'BIOCETAN Portal <no-reply@biocetan.ro>',
  RESEND_API_URL: 'https://resend.test',
  RESEND_API_KEY: 're_test',
  // Test-only key: "test-key-test-key-test-key-32byt" (32 bytes, base64url).
  TOTP_ENC_KEY: 'dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMzJieXQ',
  REQUIRE_ADMIN_MFA: false,
  TRUSTED_PROXY: 'none',
};

// A fresh SQLite file per test file (an in-memory database would give batches/transactions a
// separate, empty connection), migrated with the real migrations.
const dir = mkdtempSync(join(tmpdir(), 'portal-test-'));
const { client, db } = await openDatabase(`file:${join(dir, 'test.db')}`);
await migrateDatabase(db);
export const testDb: Db = db;

// Every test starts from empty tables. The audit log's append-only triggers block DELETE, so
// they're dropped for the wipe and recreated from the migration itself (one source of truth).
const TABLES_CHILD_FIRST = [
  'sessions',
  'recovery_codes',
  'auth_tokens',
  'throttle',
  'audit_log',
  'users',
  'companies',
];
const auditTriggers = readdirSync('migrations')
  .filter((f) => f.endsWith('.sql'))
  .flatMap((f) => readFileSync(join('migrations', f), 'utf8').split('--> statement-breakpoint'))
  .map((q) => q.trim())
  .filter((q) => /CREATE TRIGGER `audit_log_/.test(q));

async function resetDatabase() {
  await client.batch(
    [
      'DROP TRIGGER IF EXISTS audit_log_no_update',
      'DROP TRIGGER IF EXISTS audit_log_no_delete',
      ...TABLES_CHILD_FIRST.map((table) => `DELETE FROM ${table}`),
      ...auditTriggers,
    ],
    'write',
  );
}

/** Mails "sent" during the current test (the Resend API is never really called). */
export const sentMails: { to: string[]; subject: string; html: string; text: string }[] = [];

beforeEach(async () => {
  await resetDatabase();
  sentMails.length = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${testConfig.RESEND_API_URL}/emails`) {
      sentMails.push(JSON.parse(String(init?.body)));
      return Response.json({ id: crypto.randomUUID() });
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  client.close();
  rmSync(dir, { recursive: true, force: true });
});
