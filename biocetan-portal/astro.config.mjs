import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// Every page is rendered per request: the portal is private, nothing is prerendered or cached.
export default defineConfig({
  site: process.env.PORTAL_URL ?? 'https://portal.biocetan.ro',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  // Sessions are our own (D1 `sessions` table, see src/server/auth/session.ts) so they can be
  // listed, revoked and audited. Astro's KV-backed sessions stay off.
  session: false,
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
