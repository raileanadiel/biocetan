/**
 * Password-based flows: login, accepting an invitation, password reset.
 *
 * Deliberate choices:
 * - Login, reset requests and their errors never reveal whether an email has an account
 *   (same message, and unknown emails still pay the PBKDF2 cost).
 * - Attempts are throttled per account and per IP before the password is even checked.
 * - Setting or resetting a password logs the user out of every other session.
 */
import { eq } from 'drizzle-orm';
import { auditInsert, audit } from '../audit';
import { PortalError, type Deps } from '../context';
import { getDummyPasswordHash, hashPassword, passwordNeedsRehash, verifyPassword } from '../crypto';
import { users, type User } from '../db/schema';
import { sendMail } from '../email/mailer';
import { resetEmail } from '../email/templates';
import { normalizeEmail, passwordProblem } from '../validation';
import { revokeAllSessions } from './session';
import { LIMITS, accountKey, clear, hit, ipKey, isThrottled } from './throttle';
import { consumeToken, issueToken, peekToken } from './tokens';

export type LoginResult = {
  user: User;
  /** Admins always need a code; `setupRequired` when they haven't enrolled an authenticator. */
  mfa: 'none' | 'required' | 'setupRequired';
};

export async function login(
  deps: Deps,
  emailInput: string,
  password: string,
): Promise<LoginResult> {
  const email = normalizeEmail(emailInput);
  const accountThrottle = await accountKey('login', email);
  const ipThrottle = ipKey('login', deps.ip);
  if (
    (await isThrottled(deps, accountThrottle, LIMITS.loginPerAccount)) ||
    (await isThrottled(deps, ipThrottle, LIMITS.loginPerIp))
  ) {
    throw new PortalError('throttled');
  }

  const user = email
    ? await deps.db.select().from(users).where(eq(users.email, email)).get()
    : undefined;
  const hash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordOk = (await verifyPassword(password, hash)) && Boolean(user?.passwordHash);

  if (!user || !passwordOk || user.status !== 'active') {
    await hit(deps, accountThrottle, LIMITS.loginPerAccount);
    await hit(deps, ipThrottle, LIMITS.loginPerIp);
    await audit(deps, {
      actor: user ? { userId: user.id } : null,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: user?.id,
      companyId: user?.companyId,
      data: {
        reason: !user ? 'unknown_email' : user.status !== 'active' ? user.status : 'password',
      },
    });
    throw new PortalError('invalidCredentials');
  }

  await clear(deps, accountThrottle);
  const updates: Partial<User> = { lastLoginAt: new Date(deps.now()) };
  if (passwordNeedsRehash(user.passwordHash!)) updates.passwordHash = await hashPassword(password);
  await deps.db.batch([
    deps.db.update(users).set(updates).where(eq(users.id, user.id)),
    auditInsert(deps, {
      actor: { userId: user.id },
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      companyId: user.companyId,
    }),
  ]);

  const mfa =
    user.role === 'admin'
      ? user.totpEnabledAt
        ? 'required'
        : 'setupRequired'
      : user.totpEnabledAt
        ? 'required'
        : 'none';
  return { user, mfa };
}

/** For the GET of /invite/<token> and /reset/<token>: is the link still usable? */
export async function checkLink(deps: Deps, token: string, purpose: 'invite' | 'reset') {
  return peekToken(deps, token, purpose);
}

/** Sets the first password from an invitation link and activates the account. */
export async function acceptInvite(deps: Deps, token: string, password: string): Promise<User> {
  const pending = await peekToken(deps, token, 'invite');
  if (!pending) throw new PortalError('invalidToken');
  const problem = passwordProblem(password, pending.email);
  if (problem) throw new PortalError('weakPassword', problem);

  const user = await consumeToken(deps, token, 'invite');
  if (!user) throw new PortalError('invalidToken');
  const now = new Date(deps.now());
  const [updated] = await deps.db.batch([
    deps.db
      .update(users)
      .set({ passwordHash: await hashPassword(password), status: 'active', updatedAt: now })
      .where(eq(users.id, user.id))
      .returning(),
    auditInsert(deps, {
      actor: { userId: user.id },
      action: 'user.invite_accepted',
      entityType: 'user',
      entityId: user.id,
      companyId: user.companyId,
    }),
  ]);
  await revokeAllSessions(deps, user.id);
  return updated[0]!;
}

/**
 * Sends a reset link if the email belongs to an active account. Always resolves the same way,
 * so the page can't be used to discover which emails have accounts.
 */
export async function requestPasswordReset(deps: Deps, emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const perAccount = await accountKey('reset', email);
  const perIp = ipKey('reset', deps.ip);
  // `max` requests per window go through; extra ones are dropped silently (same response).
  const ipCount = (await hit(deps, perIp, LIMITS.resetPerIp)).count;
  const accountCount = (await hit(deps, perAccount, LIMITS.resetPerAccount)).count;
  if (ipCount > LIMITS.resetPerIp.max || accountCount > LIMITS.resetPerAccount.max) return;

  const user = await deps.db.select().from(users).where(eq(users.email, email)).get();
  if (!user || user.status !== 'active') return;

  const token = await issueToken(deps, user.id, 'reset', null);
  const mail = resetEmail(user.locale, {
    name: user.name,
    link: `${deps.env.PORTAL_URL}/reset/${token}`,
  });
  const sent = await sendMail(deps.env, { to: user.email, ...mail });
  await audit(deps, {
    actor: { userId: user.id },
    action: sent ? 'auth.reset_requested' : 'auth.reset_mail_failed',
    entityType: 'user',
    entityId: user.id,
    companyId: user.companyId,
  });
}

export async function completePasswordReset(
  deps: Deps,
  token: string,
  password: string,
): Promise<User> {
  const pending = await peekToken(deps, token, 'reset');
  if (!pending) throw new PortalError('invalidToken');
  const problem = passwordProblem(password, pending.email);
  if (problem) throw new PortalError('weakPassword', problem);

  const user = await consumeToken(deps, token, 'reset');
  if (!user) throw new PortalError('invalidToken');
  const [updated] = await deps.db.batch([
    deps.db
      .update(users)
      .set({ passwordHash: await hashPassword(password), updatedAt: new Date(deps.now()) })
      .where(eq(users.id, user.id))
      .returning(),
    auditInsert(deps, {
      actor: { userId: user.id },
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: user.id,
      companyId: user.companyId,
    }),
  ]);
  await revokeAllSessions(deps, user.id);
  await clear(deps, await accountKey('login', user.email));
  return updated[0]!;
}
