/** Glue between Astro pages and the services: forms, cookies, errors, notices. */
import type { AstroCookies } from 'astro';
import type { TranslationKey } from '../i18n';
import { SESSION_COOKIE, createSession, revokeSession, sessionCookieOptions } from './auth/session';
import { PortalError, type Deps } from './context';
import type { User } from './db/schema';

/** Forms here are small; anything bigger is refused before parsing. */
const MAX_FORM_BYTES = 64 * 1024;

export async function readForm(request: Request): Promise<FormData | null> {
  if (request.method !== 'POST') return null;
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_FORM_BYTES) return null;
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** Maps a thrown error to a translation code; unexpected errors are logged, never shown. */
export function errorCode(error: unknown): string {
  if (error instanceof PortalError) return error.code;
  console.error('portal: unexpected error', error);
  return 'generic';
}

/** Starts a session and sets its cookie. */
export async function signIn(
  deps: Deps,
  cookies: AstroCookies,
  user: Pick<User, 'id' | 'role' | 'totpEnabledAt'>,
  mfaVerified: boolean,
) {
  const { token } = await createSession(deps, user, { mfaVerified });
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions(user.role));
}

/**
 * Replaces the current session with a new, fully verified one after the second factor, so the
 * pre-2FA cookie value can never be used for a privileged session (session fixation).
 */
export async function upgradeSession(
  deps: Deps,
  cookies: AstroCookies,
  sessionId: string,
  user: Pick<User, 'id' | 'role' | 'totpEnabledAt'>,
) {
  await revokeSession(deps, sessionId);
  await signIn(deps, cookies, user, true);
}

/** One-word notices passed as `?n=` after a redirect; anything else is ignored. */
const NOTICES = {
  loggedOut: 'login.loggedOut',
  passwordChanged: 'login.passwordChanged',
  inviteAccepted: 'login.inviteAccepted',
  sessionExpired: 'login.sessionExpired',
  companyCreated: 'admin.companyCreated',
  userDisabled: 'admin.userDisabled',
  userEnabled: 'admin.userEnabled',
} satisfies Record<string, TranslationKey>;

export function noticeKey(url: URL): TranslationKey | null {
  const n = url.searchParams.get('n');
  return n && n in NOTICES ? NOTICES[n as keyof typeof NOTICES] : null;
}

export function formatDateTime(value: Date | null | undefined, locale: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(value);
}

/** Only same-site paths, so `?next=` can't be used to bounce users to another website. */
export function safeNext(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}

export function homeFor(role: 'admin' | 'client'): string {
  return role === 'admin' ? '/admin' : '/';
}
