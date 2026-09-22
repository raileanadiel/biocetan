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
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', ro: 'ro-RO' } },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
