import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { inviteUser, setUserDisabled } from '../src/server/accounts';
import {
  acceptInvite,
  completePasswordReset,
  login,
  requestPasswordReset,
} from '../src/server/auth/flows';
import { beginTotpSetup, confirmTotpSetup, verifySecondFactor } from '../src/server/auth/mfa';
import {
  createSession,
  MFA_PENDING_MS,
  SESSION_POLICY,
  validateSession,
} from '../src/server/auth/session';
import { totpAt, currentStep } from '../src/server/auth/totp';
import { PortalError } from '../src/server/context';
import { auditLog, authTokens, sessions, users } from '../src/server/db/schema';
import { PASSWORD, lastLinkToken, makeDeps, seedAdmin, seedCompanyWithClient } from './helpers';
import { sentMails } from './setup';

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PortalError) return error.code;
    throw error;
  }
  return 'no error';
}

describe('invitation', () => {
  it('emails a link that activates the account once', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const { user } = await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    expect(user.status).toBe('active');
    expect(user.passwordHash).toMatch(/^pbkdf2-sha256\$/);
    expect(sentMails[0]!.to).toEqual(['maria@agro.ro']);
    expect(sentMails[0]!.subject).toContain('BIOCETAN');

    // The same link can't be used again.
    const token = lastLinkToken('invite');
    expect(await errorCode(acceptInvite(deps, token, 'another long password'))).toBe(
      'invalidToken',
    );
  });

  it('stores only a hash of the link token', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    const token = lastLinkToken('invite');
    const rows = await deps.db.select().from(authTokens).all();
    expect(rows.every((r) => r.tokenHash !== token && r.tokenHash.length === 64)).toBe(true);
  });

  it('expires after 72 hours', async () => {
    const { deps, clock } = makeDeps();
    const admin = await seedAdmin(deps);
    const { createCompany } = await import('../src/server/accounts');
    const company = await createCompany(deps, admin.viewer, {
      name: 'Late SRL',
      vatId: null,
      regCom: null,
      country: 'RO',
      internalNotes: null,
    });
    await inviteUser(deps, admin.viewer, {
      email: 'late@late.ro',
      name: 'Late',
      phone: null,
      locale: 'en',
      role: 'client',
      companyId: company.id,
    });
    const token = lastLinkToken('invite');
    clock.advance(72 * 60 * 60_000 + 1);
    expect(await errorCode(acceptInvite(deps, token, PASSWORD))).toBe('invalidToken');
  });

  it('rejects weak passwords without using up the link', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const { createCompany } = await import('../src/server/accounts');
    const company = await createCompany(deps, admin.viewer, {
      name: 'Weak SRL',
      vatId: null,
      regCom: null,
      country: 'RO',
      internalNotes: null,
    });
    await inviteUser(deps, admin.viewer, {
      email: 'weak@weak.ro',
      name: 'Weak',
      phone: null,
      locale: 'ro',
      role: 'client',
      companyId: company.id,
    });
    const token = lastLinkToken('invite');
    expect(await errorCode(acceptInvite(deps, token, 'short'))).toBe('weakPassword');
    expect((await acceptInvite(deps, token, PASSWORD)).status).toBe('active');
  });

  it('refuses a second account with the same email', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const { companyId } = await seedCompanyWithClient(
      deps,
      admin.viewer,
      'Agro SRL',
      'maria@agro.ro',
    );
    const again = inviteUser(deps, admin.viewer, {
      email: 'maria@agro.ro',
      name: 'Maria',
      phone: null,
      locale: 'ro',
      role: 'client',
      companyId,
    });
    expect(await errorCode(again)).toBe('emailTaken');
  });
});

describe('login', () => {
  it('logs in with the right password, case-insensitive email', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    const result = await login(deps, '  Maria@Agro.RO ', PASSWORD);
    expect(result.user.email).toBe('maria@agro.ro');
    expect(result.mfa).toBe('none');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    expect(await errorCode(login(deps, 'maria@agro.ro', 'wrong password!!'))).toBe(
      'invalidCredentials',
    );
    expect(await errorCode(login(deps, 'nobody@agro.ro', PASSWORD))).toBe('invalidCredentials');
  });

  it('locks the account for 15 minutes after 5 failures, even with the right password', async () => {
    const { deps, clock } = makeDeps();
    const admin = await seedAdmin(deps);
    await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    for (let i = 0; i < 5; i++) {
      expect(await errorCode(login(deps, 'maria@agro.ro', `wrong ${i} password`))).toBe(
        'invalidCredentials',
      );
    }
    expect(await errorCode(login(deps, 'maria@agro.ro', PASSWORD))).toBe('throttled');
    clock.advance(15 * 60_000 + 1);
    expect((await login(deps, 'maria@agro.ro', PASSWORD)).user.email).toBe('maria@agro.ro');
  });

  it('refuses disabled users and logs them out', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const client = await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    const { token } = await createSession(deps, client.user, { mfaVerified: true });
    await setUserDisabled(deps, admin.viewer, client.user.id, true);
    expect(await validateSession(deps, token)).toBeNull();
    expect(await errorCode(login(deps, 'maria@agro.ro', PASSWORD))).toBe('invalidCredentials');
  });

  it('records failed and successful logins in the audit log', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    await errorCode(login(deps, 'maria@agro.ro', 'wrong password!!'));
    await login(deps, 'maria@agro.ro', PASSWORD);
    const actions = (await deps.db.select().from(auditLog).all()).map((r) => r.action);
    expect(actions).toContain('auth.login_failed');
    expect(actions).toContain('auth.login');
  });
});

describe('sessions', () => {
  it('stores only a hash of the cookie and expires after inactivity', async () => {
    const { deps, clock } = makeDeps();
    const admin = await seedAdmin(deps);
    const client = await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    const { token, session } = await createSession(deps, client.user, { mfaVerified: false });
    expect(session.id).not.toBe(token);
    expect((await validateSession(deps, token))?.viewer.companyId).toBe(client.companyId);
    clock.advance(SESSION_POLICY.client.idleMs + 1);
    expect(await validateSession(deps, token)).toBeNull();
  });

  it('rejects garbage and unknown tokens', async () => {
    const { deps } = makeDeps();
    expect(await validateSession(deps, undefined)).toBeNull();
    expect(await validateSession(deps, 'x'.repeat(500))).toBeNull();
    expect(await validateSession(deps, 'not-a-real-token')).toBeNull();
  });

  it('keeps an admin session half-open until the second factor, for 10 minutes', async () => {
    const { deps, clock } = makeDeps();
    const admin = await seedAdmin(deps);
    const { token } = await createSession(deps, admin.user, { mfaVerified: false });
    expect((await validateSession(deps, token))?.fullyAuthenticated).toBe(false);
    clock.advance(MFA_PENDING_MS + 1);
    expect(await validateSession(deps, token)).toBeNull();
  });
});

describe('password reset', () => {
  it('sends a one-hour link, changes the password and ends other sessions', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const client = await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    const { token: oldSession } = await createSession(deps, client.user, { mfaVerified: true });

    await requestPasswordReset(deps, 'maria@agro.ro');
    const link = lastLinkToken('reset');
    await completePasswordReset(deps, link, 'a brand new long password');

    expect(await validateSession(deps, oldSession)).toBeNull();
    expect(await errorCode(login(deps, 'maria@agro.ro', PASSWORD))).toBe('invalidCredentials');
    expect((await login(deps, 'maria@agro.ro', 'a brand new long password')).user.id).toBe(
      client.user.id,
    );
    expect(await errorCode(completePasswordReset(deps, link, 'yet another password'))).toBe(
      'invalidToken',
    );
  });

  it('says nothing about unknown emails and sends nothing', async () => {
    const { deps } = makeDeps();
    await requestPasswordReset(deps, 'nobody@nowhere.ro');
    expect(sentMails).toHaveLength(0);
  });

  it('only the newest link works', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    await requestPasswordReset(deps, 'maria@agro.ro');
    const first = lastLinkToken('reset');
    await requestPasswordReset(deps, 'maria@agro.ro');
    expect(await errorCode(completePasswordReset(deps, first, 'a brand new long password'))).toBe(
      'invalidToken',
    );
    await completePasswordReset(deps, lastLinkToken('reset'), 'a brand new long password');
  });

  it('stops sending after 3 requests an hour', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    sentMails.length = 0;
    for (let i = 0; i < 5; i++) await requestPasswordReset(deps, 'maria@agro.ro');
    expect(sentMails).toHaveLength(3);
  });
});

describe('two-step verification', () => {
  it('enrols, issues recovery codes once, and checks codes without replay', async () => {
    const { deps, clock } = makeDeps();
    const admin = await seedAdmin(deps);
    expect((await login(deps, 'admin@biocetan.ro', PASSWORD)).mfa).toBe('setupRequired');

    const { secret, uri } = await beginTotpSetup(deps, admin.user);
    expect(uri).toContain('otpauth://totp/');
    // A reload shows the same secret until it's confirmed.
    const fresh = (await deps.db.select().from(users).where(eq(users.id, admin.user.id)).get())!;
    expect((await beginTotpSetup(deps, fresh)).secret).toBe(secret);
    expect(fresh.totpSecretEnc).not.toContain(secret);

    const code = await totpAt(secret, currentStep(deps.now()));
    const recovery = await confirmTotpSetup(deps, fresh, code);
    expect(recovery).toHaveLength(10);
    expect(new Set(recovery).size).toBe(10);

    const enrolled = (await deps.db.select().from(users).where(eq(users.id, admin.user.id)).get())!;
    expect((await login(deps, 'admin@biocetan.ro', PASSWORD)).mfa).toBe('required');
    // The code used for enrolment can't be replayed.
    expect(await errorCode(verifySecondFactor(deps, enrolled, code))).toBe('invalidCode');

    clock.advance(30_000);
    const next = await totpAt(secret, currentStep(deps.now()));
    expect(await verifySecondFactor(deps, enrolled, next)).toBe('totp');

    const afterTotp = (await deps.db
      .select()
      .from(users)
      .where(eq(users.id, admin.user.id))
      .get())!;
    expect(await verifySecondFactor(deps, afterTotp, recovery[0]!.toUpperCase())).toBe('recovery');
    expect(await errorCode(verifySecondFactor(deps, afterTotp, recovery[0]!))).toBe('invalidCode');
  });

  it('locks out after 5 wrong codes', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const { secret } = await beginTotpSetup(deps, admin.user);
    const pending = (await deps.db.select().from(users).where(eq(users.id, admin.user.id)).get())!;
    await confirmTotpSetup(deps, pending, await totpAt(secret, currentStep(deps.now())));
    const enrolled = (await deps.db.select().from(users).where(eq(users.id, admin.user.id)).get())!;
    for (let i = 0; i < 5; i++) {
      expect(await errorCode(verifySecondFactor(deps, enrolled, '000000'))).toBe('invalidCode');
    }
    expect(await errorCode(verifySecondFactor(deps, enrolled, '000000'))).toBe('throttled');
  });
});

describe('admin-only actions', () => {
  it('a revoked session stays revoked', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const { token, session } = await createSession(deps, admin.user, { mfaVerified: true });
    await deps.db
      .update(sessions)
      .set({ revokedAt: new Date(deps.now()) })
      .where(eq(sessions.id, session.id));
    expect(await validateSession(deps, token)).toBeNull();
  });
});

describe('client with 2FA turned on', () => {
  it('is only half logged in until the code is entered', async () => {
    const { deps } = makeDeps();
    const admin = await seedAdmin(deps);
    const client = await seedCompanyWithClient(deps, admin.viewer, 'Agro SRL', 'maria@agro.ro');
    await deps.db
      .update(users)
      .set({ totpEnabledAt: new Date(deps.now()) })
      .where(eq(users.id, client.user.id));
    const withMfa = (await deps.db.select().from(users).where(eq(users.id, client.user.id)).get())!;
    expect((await login(deps, 'maria@agro.ro', PASSWORD)).mfa).toBe('required');
    const { token } = await createSession(deps, withMfa, { mfaVerified: false });
    expect((await validateSession(deps, token))?.fullyAuthenticated).toBe(false);
  });
});
