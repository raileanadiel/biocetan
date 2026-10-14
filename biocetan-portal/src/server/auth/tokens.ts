/**
 * One-time links for invitations and password resets. The link carries a random 256-bit token;
 * the database stores its SHA-256, an expiry, and when it was used. Issuing a new link for the
 * same purpose voids the older ones, so only the latest email works.
 */
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Deps } from '../context';
import { randomToken, sha256Hex } from '../crypto';
import { authTokens, users, type User } from '../db/schema';

export type TokenPurpose = 'invite' | 'reset';

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  invite: 72 * 60 * 60_000,
  reset: 60 * 60_000,
};

export async function issueToken(
  deps: Pick<Deps, 'db' | 'now'>,
  userId: string,
  purpose: TokenPurpose,
  createdBy: string | null,
): Promise<string> {
  const token = randomToken();
  const now = deps.now();
  await deps.db.batch([
    deps.db
      .update(authTokens)
      .set({ usedAt: new Date(now) })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.purpose, purpose),
          isNull(authTokens.usedAt),
        ),
      ),
    deps.db.insert(authTokens).values({
      userId,
      purpose,
      tokenHash: await sha256Hex(token),
      expiresAt: new Date(now + TOKEN_TTL_MS[purpose]),
      createdBy,
      createdAt: new Date(now),
    }),
  ]);
  return token;
}

/** Looks a link up without using it (to decide whether to show the form at all). */
export async function peekToken(
  deps: Pick<Deps, 'db' | 'now'>,
  token: string,
  purpose: TokenPurpose,
): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const row = await deps.db
    .select({ user: users })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(
      and(
        eq(authTokens.tokenHash, await sha256Hex(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date(deps.now())),
      ),
    )
    .get();
  if (!row || row.user.status === 'disabled') return null;
  return row.user;
}

/**
 * Marks the link used and returns its user. The conditional UPDATE … RETURNING makes this
 * single-use even if the same link is submitted twice at the same moment.
 */
export async function consumeToken(
  deps: Pick<Deps, 'db' | 'now'>,
  token: string,
  purpose: TokenPurpose,
): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const now = new Date(deps.now());
  const used = await deps.db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.tokenHash, await sha256Hex(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
      ),
    )
    .returning({ userId: authTokens.userId })
    .get();
  if (!used) return null;
  const user = await deps.db.select().from(users).where(eq(users.id, used.userId)).get();
  if (!user || user.status === 'disabled') return null;
  return user;
}
