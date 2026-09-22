# BIOCETAN website

Marketing site for BIOCETAN S.R.L. (vegetable methyl esters, Săcueni, Romania).
Astro 7 · Tailwind CSS 4 · TypeScript · static output · EN + RO (HU-ready). Map: Leaflet + OpenStreetMap (self-hosted, click-to-load, no API key).

The plan, page specs and open client questions live in [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md).
**Status: Phases 1–3 done.** All 9 pages have real content (EN + RO): Home, Products, Services, Applications, Technology, Quality, Facility & Logistics, About, Contact (+ 3 draft legal pages). Next up is Phase 4 (localisation polish / Hungarian) and Phase 5 (hardening & launch) — see the plan's roadmap.

## Commands

| Command                      | What it does                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `npm install`                | Install dependencies (Node ≥ 22.12)                                                     |
| `npm run dev`                | Dev server on http://localhost:4321 (`/styleguide/` is dev-only)                        |
| `npm run build`              | Static build to `dist/`                                                                 |
| `npm run preview`            | Serve the production build                                                              |
| `npm test`                   | Unit tests for the contact form backend (vitest)                                        |
| `npm run check`              | `astro check` (types, incl. missing translation keys)                                   |
| `npm run check:contrast`     | WCAG AA check of the colour tokens in `src/styles/global.css`                           |
| `npm run check:placeholders` | List every unresolved `[TODO …]` in the last build                                      |
| `npm run build:prod`         | Build; on a production build (`PUBLIC_ALLOW_INDEXING=true`) fail if any `[TODO` is left |
| `npm run dev:full`           | Build + serve the site **with** `/api/contact` (Pages runtime, :8788)                   |
| `npm run mock:resend`        | Fake email provider for local form testing (:8899)                                      |
| `npm run icons`              | Regenerate PNG/ICO icons from `public/favicon.svg`                                      |
| `npm run format`             | Prettier                                                                                |

CI (`.github/workflows/ci.yml`) runs type-check, tests, contrast, format check and build on every push/PR.

## Structure

```
src/
├─ config/site.ts          company facts (address, phone, email; registration data still null)
├─ i18n/
│  ├─ config.ts            locales
│  ├─ routes.ts            page registry (id → slug), nav lists, pathFor()
│  ├─ en.json · ro.json    all UI strings; a key missing from either fails type-check
│  └─ index.ts             useTranslations(locale)
├─ styles/global.css       design tokens (@theme), base styles, focus + reduced-motion rules
├─ layouts/BaseLayout.astro  <head> (title, canonical, hreflang, OG, robots), header, footer
├─ components/
│  ├─ layout/              Header, Footer, Logo (placeholder), LanguageSwitcher, MobileActionBar
│  ├─ ui/                  Button, Icon, Section, SectionHeading, Breadcrumb, PageHero, CtaBand,
│  │                       ScriptTagline, SubNav (sticky in-page nav with scroll-spy), MapEmbed (click-to-load Leaflet map)
│  ├─ sections/            ProcessSteps, Faq (with FAQPage JSON-LD)
│  └─ forms/               ContactForm (quick / full variants), FormField
├─ views/                  page content, one file per page id (all 9 pages have real content)
│  ├─ Legal.astro          shared by privacy / terms / cookies
│  ├─ _Stub.astro          fallback until a page's own view exists (none currently used)
│  └─ _Styleguide.astro    dev-only token/component preview
├─ legal/{en,ro}/*.md      draft privacy / cookies / terms text
├─ lib/contact/            form backend: constants, validation, file checks, email templates,
│                          handler (+ contact.test.ts). Shared by browser and server.
├─ config/logistics.ts     driving distances (computed via OSRM, see the file header) for Facility & Logistics
├─ scripts/contact-form.ts browser side of the form (validation, Turnstile, submit)
└─ pages/
   ├─ [...path].astro      generates every page in every locale from routes.ts
   └─ 404.astro · robots.txt.ts
functions/api/contact.ts   Cloudflare Pages Function (thin wrapper around lib/contact/handler.ts)
scripts/                   check-contrast, check-placeholders, make-icons, mock-resend
public/                    favicon + icons (placeholders), site.webmanifest, _headers (Cloudflare Pages)
```

## How to…

**Build a page.** Create `src/views/<Id>.astro` (capitalised page id: `Home`, `Products`, `Facility`, …). It receives `{ locale, pageId }`, renders only the `<main>` content, and replaces the stub automatically. Meta title/description come from `pages.<id>.metaTitle|metaDescription` in the dictionaries.

**Add a string.** Add the key to `en.json` and `ro.json`, then use `t('section.key')`. `npm run check` fails if a key is missing or misspelt.

**Add Hungarian (or another locale).** Add it to `locales` in `astro.config.mjs` **and** `src/i18n/config.ts`, add `localeMeta`, create `src/i18n/hu.json` with every key, and register it in `src/i18n/index.ts`.

**Change a colour.** Edit the token in `src/styles/global.css`, then `npm run check:contrast`. Tailwind's default palette is disabled on purpose; only brand tokens exist.

## Environment

**Build-time (site):**

| Variable                    | Default                   | Purpose                                                                                   |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `SITE_URL`                  | `https://www.biocetan.ro` | Origin for canonical/hreflang/sitemap URLs                                                |
| `PUBLIC_ALLOW_INDEXING`     | unset (= off)             | Must be `true` **only on production**. Otherwise `noindex` meta + `Disallow: /` in robots |
| `PUBLIC_TURNSTILE_SITE_KEY` | unset                     | Cloudflare Turnstile **site** key. Without it the form cannot be submitted                |

**Runtime (Pages Function secrets; set in the Cloudflare dashboard, never in git):**

| Variable               | Required | Purpose                                                         |
| ---------------------- | -------- | --------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY` | yes      | Turnstile **secret** key                                        |
| `RESEND_API_KEY`       | yes      | Resend API key                                                  |
| `CONTACT_FROM`         | yes      | Verified sender, e.g. `BIOCETAN Website <no-reply@biocetan.ro>` |
| `CONTACT_TO`           | no       | Recipient of leads; defaults to `office@biocetan.ro`            |
| `LEADS` (KV binding)   | no       | 90-day backup copy of each lead (no attachments). Recommended   |

The function fails closed: if a required secret is missing it returns an error instead of accepting leads.

## Deploy (Cloudflare Pages)

1. Push to GitHub, then Cloudflare → Workers & Pages → Create → Pages → connect the repo.
2. Build command `npm run build:prod`, output directory `dist`, environment variable `NODE_VERSION=22`. (Preview builds pass regardless; a production build fails while `[TODO` markers remain.)
3. Production environment only: `PUBLIC_ALLOW_INDEXING=true`. Every PR gets a preview URL (kept `noindex`).
4. Add the runtime secrets above, create a KV namespace and bind it as `LEADS`, and set `PUBLIC_TURNSTILE_SITE_KEY`.
5. Point the `biocetan.ro` DNS at Pages. Verify the sender domain in Resend and add its SPF/DKIM records plus a DMARC record, otherwise notifications land in spam.
6. Add a Cloudflare WAF rate-limiting rule for `/api/contact` (e.g. 5 requests / 10 min / IP).
7. **Launch gate:** with `PUBLIC_ALLOW_INDEXING=true`, `npm run build:prod` fails until every `[TODO` is resolved. Then send a real test lead and confirm it arrives in office@biocetan.ro _and_ the auto-reply reaches a second mailbox.

## Testing the contact form locally

```bash
cp .dev.vars.example .dev.vars          # local secrets (gitignored); uses Cloudflare's always-pass Turnstile test secret
cp .env.example .env                    # includes the matching test site key
npm run mock:resend                     # terminal 1: fake email provider
npm run dev:full                        # terminal 2: site + function on http://localhost:8788
```

Sent mails are printed by the mock instead of being delivered.

## Known placeholders (waiting on the client, plan §11)

- Logo: text wordmark in `components/layout/Logo.astro` + placeholder `public/favicon.svg`
- Legal registration data (CUI, Reg. Com., share capital) → `config/site.ts`
- Geo coordinates in `config/site.ts` and the distances in `config/logistics.ts` are **computed** (OpenStreetMap geocoding + OSRM routing), not client-supplied — good enough to ship, but replace with exact figures if the client provides them (see the files' header comments)
- Photography, certifications, TDS/SDS/CoA PDFs, analytics choice, email provider confirmation
- Legal texts are drafts with `[TODO: …]` markers (company registration data, providers, jurisdiction) and need review
- Romanian strings (UI, all page copy, legal) are AI-written first drafts and need review by a native speaker
- No numeric product-spec table on `/products/` (ester content, density, viscosity…) — the client mockups' numbers were flagged as unreliable (plan §3.1-6) and no real values have been supplied yet; specs are deferred to a per-batch CoA / on-request TDS
