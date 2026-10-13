// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Canonical origin. Override per environment with SITE_URL (e.g. for preview builds).
const site = process.env.SITE_URL ?? 'https://www.biocetan.ro';

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static',
  // Cloudflare Pages serves `/foo/index.html` at `/foo/`, so canonical URLs use a trailing slash.
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'en',
    // Keep in sync with src/i18n/config.ts. Adding Hungarian later = add 'hu' in both + hu.json.
    locales: ['en', 'ro'],
    routing: { prefixDefaultLocale: false },
  },
  // Astro hashes every inline script/style into a per-page CSP <meta>. The only third parties
  // are Turnstile (contact form) and OpenStreetMap tiles (click-to-load map). frame-ancestors
  // can't be set from a <meta>; X-Frame-Options in public/_headers covers framing.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://tile.openstreetmap.org",
        "font-src 'self'",
        "connect-src 'self' https://challenges.cloudflare.com",
        'frame-src https://challenges.cloudflare.com',
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ],
      scriptDirective: { resources: ["'self'", 'https://challenges.cloudflare.com'] },
    },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', ro: 'ro-RO' } },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
