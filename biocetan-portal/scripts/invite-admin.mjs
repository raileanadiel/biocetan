// Bootstraps an admin account: the first admin can't be invited from the portal because nobody
// can log in yet. Creates the user (status "invited") plus a 72-hour invitation link and prints
// the link. The person opens it and chooses their own password.
//
//   npm run admin:invite -- --email you@biocetan.ro --name "Your Name" [--locale ro|en]
//
// Works on whatever DATABASE_URL points at: run it on the VM (with the portal's environment)
// to create a real admin, or locally for a test one. The link is a one-time credential: give
// it only to that person.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createClient } from '@libsql/client';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    locale: { type: 'string', default: 'ro' },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name) {
  console.error('Usage: npm run admin:invite -- --email you@biocetan.ro --name "Your Name"');
  process.exit(1);
}
if (!['ro', 'en'].includes(values.locale)) {
  console.error('--locale must be ro or en');
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? 'file:./data/portal.db';
const portalUrl = (process.env.PORTAL_URL ?? 'http://localhost:4322').replace(/\/$/, '');
const client = createClient({ url });
await client.execute('PRAGMA foreign_keys = ON');

const existing = await client.execute({
  sql: 'SELECT status FROM users WHERE email = ?',
  args: [email],
});
if (existing.rows.length) {
  console.error(`A user with ${email} already exists (status: ${existing.rows[0].status}).`);
  console.error('An admin can resend the invitation from the portal (Admins page).');
  process.exit(1);
}

const now = Date.now();
const userId = randomUUID();
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');

await client.batch(
  [
    {
      sql: `INSERT INTO users (id, email, name, locale, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'admin', 'invited', ?, ?)`,
      args: [userId, email, name, values.locale, now, now],
    },
    {
      sql: `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, created_at)
            VALUES (?, ?, 'invite', ?, ?, ?)`,
      args: [randomUUID(), userId, tokenHash, now + 72 * 60 * 60 * 1000, now],
    },
    {
      sql: `INSERT INTO audit_log (id, at, action, entity_type, entity_id, data)
            VALUES (?, ?, 'user.invited', 'user', ?, ?)`,
      args: [
        randomUUID(),
        now,
        userId,
        JSON.stringify({ email, role: 'admin', via: 'bootstrap script' }),
      ],
    },
  ],
  'write',
);
client.close();

console.log(`\nAdmin invited: ${name} <${email}> (${url})`);
console.log(`Invitation link (valid 72 hours, works once):\n\n  ${portalUrl}/invite/${token}\n`);
