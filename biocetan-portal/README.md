# BIOCETAN client portal

Private B2B platform at `portal.biocetan.ro`: BIOCETAN admins create client companies and invite
their people; later phases add chat, offers, orders, deliveries and invoices. The full plan, in
Romanian, is [`../PORTAL_PLAN.md`](../PORTAL_PLAN.md).

**Status: phase P1 (foundation) built.** Admins log in with their password, create
client companies, invite client users and admins, resend invitations and disable users. Clients
activate their account, log in, reset their password and see an (empty) home page. Everything
is recorded in an append-only audit log.

Runs on the owner's own VM, `driverschat-vm`, in Docker (decision 2026-10-30: no monthly
Cloudflare Workers bill). The public site stays on Cloudflare Pages (free).

## Stack

- Astro 7, `output: 'server'`, **Node.js** standalone server (`@astrojs/node`). No page is
  prerendered or cached.
- **SQLite** file on the VM (libsql client) through **Drizzle ORM**. Schema in
  `src/server/db/schema.ts`; SQL migrations in `migrations/`, applied by `scripts/migrate.mjs`
  (automatically before every start).
- Tailwind 4 with the public site's design tokens (copied into `src/styles/global.css`).
- Email through **Resend** (same verified domain as the site; free up to 3 000 mails/month).
  Locally a mock prints mails.
- Tests: Vitest against a real SQLite file with the real migrations.

## Commands

| Command                | What it does                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | Dev server on http://localhost:4322 (reads `.env`)                |
| `npm run mock:resend`  | Fake email API on :8899; invitation/reset mails are printed there |
| `npm test`             | Unit + isolation tests                                            |
| `npm run check`        | Type check (also catches a missing RO/EN translation key)         |
| `npm run build`        | Production build into `dist/`                                     |
| `npm start`            | Migrates the database, then runs the production server            |
| `npm run db:generate`  | After editing `schema.ts`: writes a new SQL migration             |
| `npm run db:migrate`   | Applies pending migrations to `DATABASE_URL`                      |
| `npm run admin:invite` | Creates an admin + one-time invitation link in `DATABASE_URL`     |

`scripts/backup.mjs` writes a consistent snapshot of the database (run daily from cron on the VM).

## Local development

```bash
cp .env.example .env                  # then fill TOTP_ENC_KEY (command in the file)
npm run db:migrate
npm run mock:resend                   # terminal 1
npm run dev                           # terminal 2
npm run admin:invite -- --email you@example.test --name "You"   # prints the invite link
```

## Configuration (environment variables)

All in `.env.example`, with comments. On the VM the fixed ones (`DATABASE_URL`, `PORTAL_URL`,
`RESEND_API_URL`, `TRUSTED_PROXY`) are set in `docker-compose.yml`; only the secrets
(`RESEND_API_KEY`, `TOTP_ENC_KEY`) and optionally `REQUIRE_ADMIN_MFA` (currently `false`) go in
the VM's `.env`. `PORTAL_URL` is also read at build time: Astro trusts `X-Forwarded-Proto/Host`
from Caddy only for that host, which the CSRF origin check needs.

## Structure

```
src/
  middleware.ts         session, language, area guards, security headers
  server/               everything that touches data (pages stay thin)
    config.ts           environment variables, client IP
    db/                 schema (migrations/0001 adds integrity triggers), SQLite connection
    auth/               password flows, sessions, one-time links, TOTP 2FA, throttling
    accounts.ts         companies + users (admin writes, scoped reads)
    tenancy.ts          visibleTo(): the one place that filters by company
    audit.ts            append-only audit entries
    email/              Resend client + RO/EN templates
  pages/                login, forgot, reset/[token], invite/[token], 2fa, admin/**
  i18n/                 en.json + ro.json (a missing key is a type error)
test/                   crypto/TOTP, auth flows, tenant isolation
scripts/                migrate, invite-admin (bootstrap), backup, mock-resend
Dockerfile, docker-compose.yml   the container on the VM
deploy/                 the Caddy block for portal.biocetan.ro
```

## Security model (what is already enforced)

- **Invitation only**: no self-registration. Invitation links last 72 h, reset links 1 h; both
  single-use, stored only as SHA-256, and a newer link voids older ones.
- **Passwords**: PBKDF2-SHA256, 600 000 iterations, per-user salt, minimum 12 characters, common
  choices refused. Unknown emails get the same answer and the same hashing time as wrong
  passwords. Older, weaker hashes are upgraded at the next login.
- **Sessions**: random 256-bit cookie (`__Host-`, HttpOnly, Secure, SameSite=Lax); only its hash
  is stored. Admins: 2 h idle / 12 h absolute. Clients: 7 days idle / 30 days absolute. Changing
  or resetting a password and disabling a user end all their sessions.
- **2FA (TOTP)**: built and tested, **switched off** for now (`REQUIRE_ADMIN_MFA=false`, owner's
  decision). Setting it to `true` makes every admin enrol an authenticator at the next login.
  Secrets are AES-GCM encrypted with `TOTP_ENC_KEY`, codes can't be replayed, 10 single-use
  recovery codes, session re-issued after the code.
- **Throttling**: 5 wrong passwords or codes per account per 15 min, 30 per IP; 3 reset emails
  per account per hour.
- **Tenant isolation**: client reads go through `visibleTo(viewer, column)`; clients never see
  admins' internal notes; admin pages answer clients with a plain 404. Database triggers make a
  client without a company, or moving a user between companies, impossible.
- **CSRF**: Astro's origin check on every POST, SameSite cookies, logout is POST-only.
- **Headers**: CSP with hashes (no `unsafe-inline`), `X-Frame-Options: DENY`, `no-referrer`
  (links carry tokens), HSTS, `Cache-Control: no-store`, `noindex`.
- **Audit log**: logins (also failed), invitations, password changes, 2FA events, company and
  user changes. UPDATE/DELETE on it are blocked by triggers.
- **On the VM**: the container publishes no port (only Caddy reaches it), runs as the
  unprivileged `node` user with a read-only filesystem except `/data`, no Linux capabilities and
  `no-new-privileges`.

## Deploy on the VM (driverschat-vm)

The portal runs on `driverschat-vm` (Ubuntu 24.04, `81.181.102.218`, reached over SSH while
Cloudflare WARP is connected) like the other apps there: a Docker container on `app-network`,
behind the shared Caddy container (`/home/Caddy`), which owns ports 80/443 and the HTTPS
certificates. Everything runs as the `nxcd` user (member of the `docker` group); no sudo needed.

- Code: `~/biocetan` (git clone of this repo); compose file: `~/biocetan/biocetan-portal/docker-compose.yml`.
- Secrets: `~/biocetan/biocetan-portal/.env` (chmod 600): `RESEND_API_KEY` (a separate Resend
  key, "Sending access", domain biocetan.ro) and `TOTP_ENC_KEY` (32 random bytes, generated on the
  VM). Fixed settings (`DATABASE_URL`, `PORTAL_URL`, `TRUSTED_PROXY`...) are in the compose file.
- Data: Docker volume `biocetan-portal_portal_data` mounted at `/data` (database + `backups/`).
- DNS: Cloudflare, `A portal → 81.181.102.218`, **DNS only** (grey cloud), so Caddy can issue the
  certificate and sees the visitor's real IP.
- Caddy: the block in `deploy/Caddyfile.example`, appended to `/home/Caddy/Caddyfile`.

**First install** (on the VM):

```bash
git clone https://github.com/raileanadiel/biocetan.git ~/biocetan
cd ~/biocetan/biocetan-portal
install -m 600 /dev/null .env     # then add RESEND_API_KEY= and TOTP_ENC_KEY=
docker compose up -d --build
# Caddy: append deploy/Caddyfile.example to /home/Caddy/Caddyfile, then
docker exec driverschat_caddy caddy validate --config /etc/caddy/Caddyfile
docker exec driverschat_caddy caddy reload --config /etc/caddy/Caddyfile
```

**First admins** (prints a one-time link, valid 72 h):

```bash
docker exec biocetan_portal node scripts/invite-admin.mjs --email you@biocetan.ro --name "Your Name"
```

**Updates**: `cd ~/biocetan && git pull && cd biocetan-portal && docker compose up -d --build`
(migrations run automatically at start).

**Logs**: `docker logs -f biocetan_portal`.

**Backups**: the `nxcd` crontab runs `scripts/backup.mjs` daily at 03:15 inside the container
(newest 30 kept in `/data/backups`; output in `~/biocetan-portal-backup.log`). Copy them off the
VM too: `docker cp biocetan_portal:/data/backups ./portal-backups`. To restore, stop the
container, copy a snapshot over `/data/portal.db` and start it again.

Public site: add the "Cont client" link to `https://portal.biocetan.ro/login`.

## Next: phase P2 (communication)

Chat per client with attachments (files on the VM disk, served only after an access check),
requests from the portal, email notifications, and the site's contact-form leads flowing into
the admin area.
