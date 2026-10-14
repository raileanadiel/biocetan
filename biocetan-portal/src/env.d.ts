/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Services' dependencies for this request (db, env, clock, client IP). */
    deps: import('./server/context').Deps;
    /** The validated session, or null when logged out. Pending-2FA admins have one too. */
    auth: import('./server/auth/session').ValidSession | null;
    locale: import('./server/db/schema').Locale;
    t: import('./i18n').Translate;
    /** Set by the Cloudflare adapter. */
    cfContext: ExecutionContext;
  }
}
