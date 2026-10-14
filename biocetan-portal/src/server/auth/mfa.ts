/**
 * Second factor: TOTP from an authenticator app, plus 10 single-use recovery codes for a lost
 * phone. Mandatory for admins (PORTAL_PLAN.md §6.2), optional for clients later.
 *
 * Setup is two-step: `beginTotpSetup` stores a new secret (encrypted) without enabling it;
 * `confirmTotpSetup` enables it only once the user proves their app produces valid codes.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { audit, auditInsert } from '../audit';
import { PortalError, type Deps } from '../context';
import { decryptString, encryptString, randomBytes, sha256Hex } from '../crypto';
import { recoveryCodes, users, type User } from '../db/schema';
import { LIMITS, accountKey, clear, hit, isThrottled } from './throttle';
import { base32Encode, generateTotpSecret, otpauthUri, verifyTotp } from './totp';

const RECOVERY_CODE_COUNT = 10;

function encryptionKey(env: Env): string {
  if (!env.TOTP_ENC_KEY) throw new Error('TOTP_ENC_KEY is not configured');
  return env.TOTP_ENC_KEY;
}

/** Returns the secret to show (QR + text). Reuses a pending secret so a reload keeps the QR. */
export async function beginTotpSetup(
  deps: Deps,
  user: User,
): Promise<{ secret: string; uri: string }> {
  if (user.totpEnabledAt) throw new PortalError('forbidden', 'TOTP already enabled');
  let secret: string;
  if (user.totpSecretEnc) {
    secret = await decryptString(user.totpSecretEnc, encryptionKey(deps.env));
  } else {
    secret = generateTotpSecret();
    await deps.db
      .update(users)
      .set({ totpSecretEnc: await encryptString(secret, encryptionKey(deps.env)) })
      .where(and(eq(users.id, user.id), isNull(users.totpEnabledAt)));
  }
  return { secret, uri: otpauthUri(secret, user.email) };
}

/** Enables TOTP if `code` is valid for the pending secret. Returns the recovery codes, once. */
export async function confirmTotpSetup(deps: Deps, user: User, code: string): Promise<string[]> {
  if (user.totpEnabledAt || !user.totpSecretEnc) throw new PortalError('forbidden');
  await guardAttempts(deps, user);
  const secret = await decryptString(user.totpSecretEnc, encryptionKey(deps.env));
  const step = await verifyTotp(secret, code, user.totpLastStep, deps.now());
  if (step === null) {
    await hit(deps, await accountKey('mfa', user.email), LIMITS.mfaPerAccount);
    throw new PortalError('invalidCode');
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    formatRecoveryCode(randomBytes(7)),
  );
  const now = new Date(deps.now());
  await deps.db.batch([
    deps.db
      .update(users)
      .set({ totpEnabledAt: now, totpLastStep: step, updatedAt: now })
      .where(eq(users.id, user.id)),
    deps.db.delete(recoveryCodes).where(eq(recoveryCodes.userId, user.id)),
    deps.db.insert(recoveryCodes).values(
      await Promise.all(
        codes.map(async (c) => ({
          userId: user.id,
          codeHash: await sha256Hex(normalizeRecovery(c)),
          createdAt: now,
        })),
      ),
    ),
    auditInsert(deps, {
      actor: { userId: user.id },
      action: 'auth.mfa_enabled',
      entityType: 'user',
      entityId: user.id,
      companyId: user.companyId,
    }),
  ]);
  await clear(deps, await accountKey('mfa', user.email));
  return codes;
}

/** Checks a login code: a TOTP code, or failing that an unused recovery code. */
export async function verifySecondFactor(
  deps: Deps,
  user: User,
  input: string,
): Promise<'totp' | 'recovery'> {
  if (!user.totpEnabledAt || !user.totpSecretEnc) throw new PortalError('forbidden');
  await guardAttempts(deps, user);
  const throttleKey = await accountKey('mfa', user.email);

  const secret = await decryptString(user.totpSecretEnc, encryptionKey(deps.env));
  const step = await verifyTotp(secret, input, user.totpLastStep, deps.now());
  if (step !== null) {
    // Conditional update: a concurrent request that already used this step loses.
    const updated = await deps.db
      .update(users)
      .set({ totpLastStep: step })
      .where(and(eq(users.id, user.id), eqOrNullBelow(user.totpLastStep)))
      .returning({ id: users.id })
      .get();
    if (updated) {
      await clear(deps, throttleKey);
      return 'totp';
    }
  }

  const normalized = normalizeRecovery(input);
  if (normalized.length === 10) {
    const used = await deps.db
      .update(recoveryCodes)
      .set({ usedAt: new Date(deps.now()) })
      .where(
        and(
          eq(recoveryCodes.userId, user.id),
          eq(recoveryCodes.codeHash, await sha256Hex(normalized)),
          isNull(recoveryCodes.usedAt),
        ),
      )
      .returning({ id: recoveryCodes.id })
      .get();
    if (used) {
      await clear(deps, throttleKey);
      await audit(deps, {
        actor: { userId: user.id },
        action: 'auth.recovery_code_used',
        entityType: 'user',
        entityId: user.id,
        companyId: user.companyId,
      });
      return 'recovery';
    }
  }

  await hit(deps, throttleKey, LIMITS.mfaPerAccount);
  await audit(deps, {
    actor: { userId: user.id },
    action: 'auth.mfa_failed',
    entityType: 'user',
    entityId: user.id,
    companyId: user.companyId,
  });
  throw new PortalError('invalidCode');
}

async function guardAttempts(deps: Deps, user: User) {
  if (await isThrottled(deps, await accountKey('mfa', user.email), LIMITS.mfaPerAccount)) {
    throw new PortalError('throttled');
  }
}

function eqOrNullBelow(lastStep: number | null) {
  // Matches the row only if nobody advanced totp_last_step since we read it.
  return lastStep === null ? isNull(users.totpLastStep) : eq(users.totpLastStep, lastStep);
}

/** 10 base32 characters (50 random bits) shown as `xxxxx-xxxxx`. */
function formatRecoveryCode(bytes: Uint8Array): string {
  const raw = base32Encode(bytes).toLowerCase().slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function normalizeRecovery(value: string): string {
  return value.toLowerCase().replace(/[^a-z2-7]/g, '');
}
