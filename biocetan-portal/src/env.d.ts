/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Services' dependencies for this request (db, env, clock, client IP). */
    deps: import('./server/context').Deps;
    /** The validated session, or null when logged out. Users who still owe a 2FA code have one too. */
    auth: import('./server/auth/session').ValidSession | null;
    locale: import('./server/db/schema').Locale;
    t: import('./i18n').Translate;
  }
}
