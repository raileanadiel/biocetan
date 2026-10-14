## Project (BIOCETAN client portal)

Private B2B portal on Cloudflare Workers + D1. Read `README.md` (security model, structure) and
`../PORTAL_PLAN.md` (Romanian; phases, data model, decisions) first.

- Data access lives in `src/server/`; pages only parse forms and render. Services take `deps`
  (db, env, clock, ip) explicitly so tests can drive them.
- **Tenant isolation is the top rule.** Any query a client can trigger must filter with
  `visibleTo(viewer, table.companyId)` from `src/server/tenancy.ts`, never with a company id
  taken from the URL or a form. Every new client-facing query gets a case in
  `test/tenancy.test.ts` proving company A can't reach company B. Admin-only functions start
  with `requireAdmin(viewer)`.
- Anything legally or commercially relevant writes an audit entry (`auditInsert` in the same
  `db.batch()` as the change). Never put passwords, tokens, TOTP secrets or codes in audit data
  or logs. Nothing important is hard-deleted.
- Schema changes: edit `src/server/db/schema.ts`, run `npm run db:generate`, never edit an
  applied migration. Integrity rules SQLite can't express in drizzle go in a custom migration
  (see `migrations/0001_integrity.sql`); tests reset tables in `test/setup.ts`, so add new
  tables to `TABLES_CHILD_FIRST` there.
- Security primitives only from `src/server/crypto.ts` (hashing, tokens, constant-time compare,
  encryption). Error messages must not reveal whether an account exists.
- UI strings in `src/i18n/en.json` + `ro.json`; `npm run check` fails on a missing key. Romanian
  is the default for clients.
- Before committing: `npm test`, `npm run check`, `npx prettier --check .`.
- Local test accounts go in `.dev-accounts` (gitignored), never in chat or committed files. Real
  credentials and secrets are entered by the owner only.
- TypeScript is pinned to 6.x (as in the site) because `@astrojs/check` doesn't support 7.x yet;
  Vitest is 4.1.x because `@cloudflare/vitest-plugin` failed to load test files under Vitest 5.
