// Bootstraps an admin account: the first admin can't be invited from the portal because nobody
// can log in yet. Creates the user (status "invited") plus a 72-hour invitation link and prints
// the link. The person opens it, chooses their own password, and sets up 2FA at first login.
//
//   npm run admin:invite -- --email you@biocetan.ro --name "Your Name" [--locale ro|en] [--remote]
//
// --remote writes to the production D1 (needs `wrangler login`); without it, the local one.
// The link is a one-time credential: give it only to that person.
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    locale: { type: 'string', default: 'ro' },
    remote: { type: 'boolean', default: false },
    url: { type: 'string' },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name) {
  console.error(
    'Usage: npm run admin:invite -- --email you@biocetan.ro --name "Your Name" [--remote]',
  );
  process.exit(1);
}
if (!['ro', 'en'].includes(values.locale)) {
  console.error('--locale must be ro or en');
  process.exit(1);
}

const portalUrl =
  values.url ?? (values.remote ? 'https://portal.biocetan.ro' : 'http://localhost:4322');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const now = Date.now();
const userId = randomUUID();
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const expiresAt = now + 72 * 60 * 60 * 1000;

function d1(sql) {
  const args = [
    'wrangler',
    'd1',
    'execute',
    'DB',
    values.remote ? '--remote' : '--local',
    '--json',
    '--command',
    sql,
  ];
  return JSON.parse(
    execFileSync('npx', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }),
  );
}

const existing = d1(`SELECT id, status FROM users WHERE email = ${q(email)}`)[0]?.results ?? [];
if (existing.length) {
  console.error(`A user with ${email} already exists (status: ${existing[0].status}).`);
  console.error('An admin can resend the invitation from the portal (Admins page).');
  process.exit(1);
}

d1(
  [
    `INSERT INTO users (id, email, name, locale, role, status, created_at, updated_at) VALUES (${q(userId)}, ${q(email)}, ${q(name)}, ${q(values.locale)}, 'admin', 'invited', ${now}, ${now})`,
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, created_at) VALUES (${q(randomUUID())}, ${q(userId)}, 'invite', ${q(tokenHash)}, ${expiresAt}, ${now})`,
    `INSERT INTO audit_log (id, at, action, entity_type, entity_id, data) VALUES (${q(randomUUID())}, ${now}, 'user.invited', 'user', ${q(userId)}, ${q(JSON.stringify({ email, role: 'admin', via: 'bootstrap script' }))})`,
  ].join('; '),
);

console.log(
  `\nAdmin invited: ${name} <${email}> (${values.remote ? 'production' : 'local'} database)`,
);
console.log(`Invitation link (valid 72 hours, works once):\n\n  ${portalUrl}/invite/${token}\n`);
