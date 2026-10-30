# BIOCETAN client portal

Private B2B platform at `portal.biocetan.ro`: BIOCETAN admins create client companies and invite
their people; later phases add chat, offers, orders, deliveries and invoices. The full plan, in
Romanian, is [`../PORTAL_PLAN.md`](../PORTAL_PLAN.md).

**Status: phase P1 (foundation) built, not deployed.** Admins log in with their password, create
client companies, invite client users and admins, resend invitations and disable users. Clients
activate their account, log in, reset their password and see an (empty) home page. Everything
is recorded in an append-only audit log.

Runs on the owner's own VM (decision 2026-10-30: no monthly Cloudflare Workers bill). The public
site stays on Cloudflare Pages (free).

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

`scripts/backup.mjs` writes a consistent snapshot of the database (used by the daily timer).

## Local development

```bash
cp .env.example .env                  # then fill TOTP_ENC_KEY (command in the file)
npm run db:migrate
npm run mock:resend                   # terminal 1
npm run dev                           # terminal 2
npm run admin:invite -- --email you@example.test --name "You"   # prints the invite link
```

## Configuration (environment variables)

All in `.env.example`, with comments. The important ones on the VM: `DATABASE_URL`
(`file:/var/lib/biocetan-portal/portal.db`), `PORTAL_URL` (`https://portal.biocetan.ro`),
`RESEND_API_KEY`, `TOTP_ENC_KEY`, `REQUIRE_ADMIN_MFA` (currently `false`), `TRUSTED_PROXY`
(which header carries the visitor's IP; must match how the portal is exposed).

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
deploy/                 systemd service + backup timer, Caddy example
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
- **On the VM**: the app listens on 127.0.0.1 only, runs as an unprivileged user under a
  hardened systemd unit that can write only to `/var/lib/biocetan-portal`.

## Deploy on the VM (not done yet)

Needs: Linux with systemd, Node.js 22+, ~512 MB RAM, outbound internet (Resend). No inbound
port has to be opened if Cloudflare Tunnel is used.

1. **User and folders**
   ```bash
   sudo useradd --system --home /var/lib/biocetan-portal --shell /usr/sbin/nologin biocetan
   sudo install -d -o biocetan -g biocetan -m 750 /var/lib/biocetan-portal
   sudo git clone https://github.com/raileanadiel/biocetan.git /opt/biocetan
   sudo ln -s /opt/biocetan/biocetan-portal /opt/biocetan-portal
   cd /opt/biocetan-portal && sudo npm ci && sudo npm run build
   ```
2. **Configuration**: `/etc/biocetan-portal.env` from `.env.example`, `chmod 600`, owned by
   root. The owner types the secrets (`RESEND_API_KEY`: a separate Resend key, "Sending access",
   domain biocetan.ro; `TOTP_ENC_KEY`: 32 random bytes). `DATABASE_URL=file:/var/lib/biocetan-portal/portal.db`,
   `PORTAL_URL=https://portal.biocetan.ro`, `RESEND_API_URL=https://api.resend.com`.
3. **Service + daily backup**
   ```bash
   sudo cp deploy/biocetan-portal*.service deploy/biocetan-portal-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now biocetan-portal biocetan-portal-backup.timer
   ```
   Also copy `/var/lib/biocetan-portal/backups` off the VM regularly.
4. **Expose it**, one of:
   - **Cloudflare Tunnel (recommended, free)**: `cloudflared` on the VM, tunnel
     `portal.biocetan.ro → http://127.0.0.1:4322`. No open ports, HTTPS and DDoS protection by
     Cloudflare, and the free WAF rate limit can cover `POST /login` and `POST /forgot`.
     `TRUSTED_PROXY=cloudflare`.
   - **Caddy** on a VM with a public IP: `deploy/Caddyfile.example`, `TRUSTED_PROXY=x-forwarded-for`.
5. **First admins** (runs as the service user with the service's environment, so the database
   files keep the right owner):
   ```bash
   sudo systemd-run --uid=biocetan --gid=biocetan --pipe --wait \
     -p EnvironmentFile=/etc/biocetan-portal.env -p WorkingDirectory=/opt/biocetan-portal \
     /usr/bin/node scripts/invite-admin.mjs --email you@biocetan.ro --name "Your Name"
   ```
   and give each person their link.
6. **Updates**: `git pull && npm ci && npm run build && sudo systemctl restart biocetan-portal`
   (migrations run automatically before the start).
7. Public site: add the "Cont client" link to `https://portal.biocetan.ro/login`.

## Next: phase P2 (communication)

Chat per client with attachments (files on the VM disk, served only after an access check),
requests from the portal, email notifications, and the site's contact-form leads flowing into
the admin area.
