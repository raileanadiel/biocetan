/**
 * Runs before every page: loads the session, picks the language, enforces who may open which
 * area, and adds security headers. Pages can rely on these guarantees:
 *
 * - `/admin/**`: a fully authenticated admin (password + 2FA).
 * - `/2fa/**`: any session, including an admin who still owes the second factor.
 * - Public pages (`PUBLIC_PATHS`): anyone; a logged-in user opening /login is sent home.
 * - Everything else: a fully authenticated user of any role.
 */
import type { APIContext, MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { LOCALE_COOKIE, detectLocale, useTranslations } from './i18n';
import { SESSION_COOKIE, validateSession } from './server/auth/session';
import type { Deps } from './server/context';
import { getDb } from './server/db/client';
import { homeFor } from './server/web';

const PUBLIC_PATHS = [/^\/login$/, /^\/forgot$/, /^\/reset\/[^/]+$/, /^\/invite\/[^/]+$/];
const MFA_PATHS = /^\/2fa(\/setup)?$/;

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  // Invitation and reset links carry their token in the path: never send it as a referrer.
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Robots-Tag': 'noindex, nofollow',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request, locals } = context;
  const path = url.pathname;

  const deps: Deps = {
    db: getDb(env.DB),
    env,
    now: () => Date.now(),
    ip: request.headers.get('cf-connecting-ip') ?? (import.meta.env.DEV ? '127.0.0.1' : null),
    userAgent: request.headers.get('user-agent'),
  };
  locals.deps = deps;
  locals.auth = await validateSession(deps, cookies.get(SESSION_COOKIE)?.value);
  if (!locals.auth && cookies.has(SESSION_COOKIE)) cookies.delete(SESSION_COOKIE, { path: '/' });

  // Language: the account's setting when logged in; otherwise ?lang= (remembered) or the browser.
  const requested = url.searchParams.get('lang');
  if (requested === 'ro' || requested === 'en') {
    cookies.set(LOCALE_COOKIE, requested, {
      path: '/',
      maxAge: 365 * 24 * 3600,
      sameSite: 'lax',
      secure: true,
    });
  }
  locals.locale =
    locals.auth?.user.locale ??
    detectLocale(
      requested ?? cookies.get(LOCALE_COOKIE)?.value,
      request.headers.get('accept-language'),
    );
  locals.t = useTranslations(locals.locale);

  const response = await guard(context, next);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  // Private, per-user pages: never stored by the browser cache or any proxy.
  if (!path.startsWith('/_astro/')) response.headers.set('Cache-Control', 'no-store');
  return response;
});

async function guard(context: APIContext, next: MiddlewareNext): Promise<Response> {
  const { url, locals, redirect } = context;
  const path = url.pathname;
  const auth = locals.auth;

  if (path.startsWith('/_astro/') || path === '/favicon.svg' || path === '/robots.txt')
    return next();

  if (PUBLIC_PATHS.some((re) => re.test(path))) {
    if (auth?.fullyAuthenticated && path === '/login') return redirect(homeFor(auth.viewer.role));
    return next();
  }

  const loginUrl = `/login?next=${encodeURIComponent(path + url.search)}`;
  if (!auth) return redirect(path === '/' ? '/login' : loginUrl);

  if (MFA_PATHS.test(path)) {
    if (auth.fullyAuthenticated) return redirect(homeFor(auth.viewer.role));
    return next();
  }
  if (!auth.fullyAuthenticated) {
    return redirect(auth.user.totpEnabledAt ? '/2fa' : '/2fa/setup');
  }

  if (path === '/admin' || path.startsWith('/admin/')) {
    if (auth.viewer.role !== 'admin') return notFound(context);
  } else if (auth.viewer.role === 'admin' && path === '/') {
    return redirect('/admin');
  }
  return next();
}

/** Clients asking for admin pages get a plain 404: no hint that the area exists. */
function notFound(context: APIContext) {
  return context.rewrite('/404');
}
