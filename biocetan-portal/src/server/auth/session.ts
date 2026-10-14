/**
 * Login sessions. The browser holds a random 256-bit token in an HttpOnly cookie; the database
 * holds only its SHA-256, so reading the database doesn't let anyone log in as a user.
 *
 * Admin sessions are short and need the second factor (`mfaVerifiedAt`) before they count as
 * logged in; client sessions last longer because clients log in rarely.
 */
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { Deps, Viewer } from '../context';
import { randomToken, sha256Hex } from '../crypto';
import { sessions, users, type Role, type Session, type User } from '../db/schema';

export const SESSION_COOKIE = '__Host-portal_session';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

export const SESSION_POLICY: Record<Role, { idleMs: number; absoluteMs: number }> = {
  admin: { idleMs: 2 * HOUR, absoluteMs: 12 * HOUR },
  client: { idleMs: 7 * DAY, absoluteMs: 30 * DAY },
};

/** `last_seen_at` is written at most this often, to avoid a DB write on every page view. */
const TOUCH_INTERVAL_MS = 5 * 60_000;

/** A pending (pre-2FA) admin session may only be used this long to enter the code. */
export const MFA_PENDING_MS = 10 * 60_000;

export async function createSession(
  deps: Pick<Deps, 'db' | 'now' | 'ip' | 'userAgent'>,
  user: Pick<User, 'id' | 'role'>,
  { mfaVerified }: { mfaVerified: boolean },
): Promise<{ token: string; session: Session }> {
  const token = randomToken();
  const now = deps.now();
  const policy = SESSION_POLICY[user.role];
  const pendingMfa = user.role === 'admin' && !mfaVerified;
  const session = await deps.db
    .insert(sessions)
    .values({
      id: await sha256Hex(token),
      userId: user.id,
      createdAt: new Date(now),
      lastSeenAt: new Date(now),
      expiresAt: new Date(now + (pendingMfa ? MFA_PENDING_MS : policy.absoluteMs)),
      mfaVerifiedAt: mfaVerified ? new Date(now) : null,
      ip: deps.ip,
      userAgent: deps.userAgent?.slice(0, 300) ?? null,
    })
    .returning()
    .get();
  return { token, session };
}

export interface ValidSession {
  session: Session;
  user: User;
  viewer: Viewer;
  /** False for an admin who has passed the password but not yet the 2FA code. */
  fullyAuthenticated: boolean;
}

export async function validateSession(
  deps: Pick<Deps, 'db' | 'now'>,
  token: string | undefined,
): Promise<ValidSession | null> {
  if (!token || token.length > 100) return null;
  const now = deps.now();
  const row = await deps.db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, await sha256Hex(token)))
    .get();
  if (!row) return null;
  const { session, user } = row;

  const policy = SESSION_POLICY[user.role];
  const expired =
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= now ||
    session.lastSeenAt.getTime() + policy.idleMs <= now ||
    user.status !== 'active';
  if (expired) {
    if (session.revokedAt === null) await revokeSession(deps, session.id);
    return null;
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await deps.db
      .update(sessions)
      .set({ lastSeenAt: new Date(now) })
      .where(eq(sessions.id, session.id));
  }

  return {
    session,
    user,
    viewer: toViewer(user),
    fullyAuthenticated: user.role !== 'admin' || session.mfaVerifiedAt !== null,
  };
}

export function toViewer(user: User): Viewer {
  return {
    userId: user.id,
    role: user.role,
    companyId: user.companyId,
    email: user.email,
    name: user.name,
    locale: user.locale,
  };
}

export async function revokeSession(deps: Pick<Deps, 'db' | 'now'>, sessionId: string) {
  await deps.db
    .update(sessions)
    .set({ revokedAt: new Date(deps.now()) })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

/** Logs a user out everywhere (password change, account disabled), optionally keeping one. */
export async function revokeAllSessions(
  deps: Pick<Deps, 'db' | 'now'>,
  userId: string,
  exceptSessionId?: string,
) {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  await deps.db
    .update(sessions)
    .set({ revokedAt: new Date(deps.now()) })
    .where(and(...conditions));
}

export function sessionCookieOptions(role: Role) {
  return {
    httpOnly: true,
    // `__Host-` cookies must be Secure; browsers accept Secure cookies on http://localhost.
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_POLICY[role].absoluteMs / 1000),
  };
}
