## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Project (BIOCETAN)

Marketing site for BIOCETAN S.R.L. Read `../IMPLEMENTATION_PLAN.md` first (scope, 9-page sitemap, facts, open client questions) and `README.md` (structure, how-tos).

- Page content goes in `src/views/<Id>.astro`; `src/pages/[...path].astro` generates every page × locale. Don't add per-locale page files.
- All UI strings live in `src/i18n/en.json` + `ro.json`; use `t('key')`. A missing key fails `npm run check`.
- Colours/fonts are tokens in `src/styles/global.css` (Tailwind's default palette is disabled). Run `npm run check:contrast` after changing any colour.
- Never publish unverified technical claims: `IMPLEMENTATION_PLAN.md` §3 lists claims the client must confirm (waterless vs washing, certifications, distances, SFME/SME oxidative stability). Do not invent testimonials, customers, certifications or figures.
- Keep `PUBLIC_ALLOW_INDEXING` off everywhere except production.
- TypeScript is pinned to 6.x because `@astrojs/check` does not support 7.x yet.
- Contact form: shared rules live in `src/lib/contact/` (used by browser and server). Change validation there, never in only one place. `npm test` must pass; the handler's order of checks is deliberate (see the docstring in `handler.ts`).
- Legal pages are drafts; leave the `[TODO: …]` markers for the client to resolve, and never invent registration data or provider details.
- Facility distances/coordinates (`src/config/logistics.ts`, `src/config/site.ts`) are computed (OSM geocoding + OSRM routing), not client-supplied — see those files' header comments before changing them, and re-derive rather than guess if they need updating.
- A template-literal translation key built from two loop variables (e.g. `t(\`x.${id}.${letter}\`)`) makes TypeScript check every id×letter combination, not just the pairs that exist — resolve the strings in frontmatter per known id instead (see Applications.astro).
