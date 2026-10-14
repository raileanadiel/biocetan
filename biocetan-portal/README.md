# BIOCETAN client portal

Private B2B platform at `portal.biocetan.ro`: BIOCETAN admins create client companies and invite
their people; later phases add chat, offers, orders, deliveries and invoices. The full plan, in
Romanian, is [`../PORTAL_PLAN.md`](../PORTAL_PLAN.md).

**Status: phase P1 (foundation) built, not deployed.** Admins can log in with password + 2FA,
create client companies, invite client users and admins, resend invitations and disable users.
Clients can activate their account, log in, reset their password and see an (empty) home page.
Everything is recorded in an append-only audit log.

## Stack

- Astro 7, `output: 'server'`, on **Cloudflare Workers** (`@astrojs/cloudflare`). No page is
  prerendered or cached.
- **D1** (SQLite) through **Drizzle ORM**. Schema in `src/server/db/schema.ts`; SQL migrations
  in `migrations/`, applied by wrangler.
- Tailwind 4 with the public site's design tokens (copied into `src/styles/global.css`).
- Email through **Resend** (same verified domain as the site). Locally a mock prints mails.
- Tests: Vitest inside workerd (`@cloudflare/vitest-plugin`) against a real local D1 with the
  real migrations.

## Commands

| Command                     | What it does                                                          |
| --------------------------- | --------------------------------------------------------------------- |
| `npm run dev`               | Dev server on http://localhost:4322 (local D1, `.dev.vars`)           |
| `npm run mock:resend`       | Fake email API on :8899; invitation/reset mails are printed there     |
| `npm test`                  | Unit + isolation tests in workerd                                     |
| `npm run check`             | Type check (also catches a missing RO/EN translation key)             |
| `npm run build`             | Production build into `dist/`                                         |
| `npm run db:generate`       | After editing `schema.ts`: writes a new SQL migration                 |
| `npm run db:migrate:local`  | Applies migrations to the local D1                                    |
| `npm run db:migrate:remote` | Applies migrations to the production D1                               |
| `npm run admin:invite`      | Creates an admin + one-time invitation link (`--remote` for prod)     |
| `npm run typegen`           | Regenerates `worker-configuration.d.ts` after changing wrangler.jsonc |

## Local development

```bash
cp .dev.vars.example .dev.vars        # then fill TOTP_ENC_KEY (command in the file)
npm run db:migrate:local
npm run mock:resend                   # terminal 1
npm run dev                           # terminal 2
npm run admin:invite -- --email you@example.test --name "You"   # prints the invite link
```

Open the printed link, choose a password, then scan the QR code with an authenticator app.

## Structure

```
src/
  middleware.ts         session, language, area guards, security headers
  server/               everything that touches data (pages stay thin)
    db/schema.ts        tables; migrations/0001 adds integrity triggers
    auth/               passwords flows, sessions, one-time links, TOTP 2FA, throttling
    accounts.ts         companies + users (admin writes, scoped reads)
    tenancy.ts          visibleTo(): the one place that filters by company
    audit.ts            append-only audit entries
    email/              Resend client + RO/EN templates
  pages/                login, forgot, reset/[token], invite/[token], 2fa, admin/**
  i18n/                 en.json + ro.json (a missing key is a type error)
test/                   crypto/TOTP, auth flows, tenant isolation
scripts/                invite-admin.mjs (bootstrap), mock-resend.mjs
```

## Security model (what is already enforced)

- **Invitation only**: no self-registration. Invitation links last 72 h, reset links 1 h; both
  single-use, stored only as SHA-256, and a newer link voids older ones.
- **Passwords**: PBKDF2-SHA256, 100 000 iterations (the Workers maximum), per-user salt,
  minimum 12 characters, common choices refused. Unknown emails get the same answer and the
  same hashing time as wrong passwords.
- **Sessions**: random 256-bit cookie (`__Host-`, HttpOnly, Secure, SameSite=Lax); only its hash
  is stored. Admins: 2 h idle / 12 h absolute. Clients: 7 days idle / 30 days absolute. Changing
  or resetting a password and disabling a user end all their sessions.
- **2FA**: mandatory TOTP for admins (optional for clients later), secret AES-GCM encrypted with
  `TOTP_ENC_KEY`, codes can't be replayed, 10 single-use recovery codes. The session is
  re-issued after the second factor (no fixation).
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

## Deploy (not done yet)

1. **Workers Paid plan** (~5 $/month) on the Wehostro account: PBKDF2 at 100k iterations needs
   more CPU per request than the free plan's 10 ms.
2. `npx wrangler d1 create biocetan-portal --jurisdiction eu` → put the id in `wrangler.jsonc`
   → `npm run db:migrate:remote`.
3. Secrets (typed by the owner in the dashboard or `wrangler secret put`): `RESEND_API_KEY`
   (a separate Resend key, "Sending access", domain biocetan.ro) and `TOTP_ENC_KEY` (32 random
   bytes, base64url; losing it means every admin re-enrols 2FA). Vars: `PORTAL_URL=https://portal.biocetan.ro`,
   `RESEND_API_URL=https://api.resend.com`.
4. Deploy (`npx wrangler deploy` after `npm run build`, or Workers Builds from Git, root
   `biocetan-portal`), custom domain `portal.biocetan.ro`.
5. **Cloudflare Access** application on `portal.biocetan.ro/admin*` (email one-time PIN for the
   admins' addresses): a second, independent lock in front of the admin area.
6. WAF rate limit on `POST /login` and `POST /forgot` per IP.
7. `npm run admin:invite -- --remote --email … --name …` for each admin; they open the link
   and enrol 2FA.
8. Public site: add the "Cont client" link to `https://portal.biocetan.ro/login`.

## Next: phase P2 (communication)

Chat per client with attachments (R2), requests from the portal, email notifications, and the
site's contact-form leads flowing into the admin area.
