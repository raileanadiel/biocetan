import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Every page is rendered per request: the portal is private, nothing is prerendered or cached.
// Runs as a plain Node.js server (`node dist/server/entry.mjs`) on the owner's VM.
export default defineConfig({
  site: process.env.PORTAL_URL ?? 'https://portal.biocetan.ro',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Sessions are our own (SQLite `sessions` table, see src/server/auth/session.ts) so they can be
  // listed, revoked and audited. Astro's built-in sessions stay off.
  session: false,
  server: { port: 4322, host: '127.0.0.1' },
  trailingSlash: 'never',
  security: {
    // Rejects cross-site form posts (CSRF) on every on-demand route. On by default; stated so
    // nobody turns it off by accident.
    checkOrigin: true,
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-src 'none'",
      ],
    },
  },
  vite: { plugins: [tailwindcss()] },
});
