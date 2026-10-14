/**
 * Fixed-window attempt counters in D1. Used for login, 2FA codes and password-reset requests,
 * keyed per account and per IP so neither one person nor one machine can grind through guesses.
 * Cloudflare WAF rate limiting in front of the portal is a second, coarser layer.
 */
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Deps } from '../context';
import { sha256Hex } from '../crypto';
import { throttle } from '../db/schema';

export interface Limit {
  max: number;
  windowMs: number;
}

export const LIMITS = {
  loginPerAccount: { max: 5, windowMs: 15 * 60_000 },
  loginPerIp: { max: 30, windowMs: 15 * 60_000 },
  mfaPerAccount: { max: 5, windowMs: 15 * 60_000 },
  resetPerAccount: { max: 3, windowMs: 60 * 60_000 },
  resetPerIp: { max: 10, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;

/** Emails are hashed in keys so the throttle table holds no personal data. */
export async function accountKey(kind: string, email: string): Promise<string> {
  return `${kind}:account:${await sha256Hex(email.trim().toLowerCase())}`;
}

export function ipKey(kind: string, ip: string | null): string {
  return `${kind}:ip:${ip ?? 'unknown'}`;
}

/** True when `key` has already used up `limit` in the current window (does not count a hit). */
export async function isThrottled(
  deps: Pick<Deps, 'db' | 'now'>,
  key: string,
  limit: Limit,
): Promise<boolean> {
  const row = await deps.db
    .select({ count: throttle.count })
    .from(throttle)
    .where(and(eq(throttle.key, key), gt(throttle.windowEndsAt, new Date(deps.now()))))
    .get();
  return (row?.count ?? 0) >= limit.max;
}

/** Counts one attempt atomically (single UPSERT) and reports whether the limit is now reached. */
export async function hit(
  deps: Pick<Deps, 'db' | 'now'>,
  key: string,
  limit: Limit,
): Promise<{ count: number; limited: boolean }> {
  const now = deps.now();
  const windowEnd = now + limit.windowMs;
  const row = await deps.db
    .insert(throttle)
    .values({ key, count: 1, windowEndsAt: new Date(windowEnd) })
    .onConflictDoUpdate({
      target: throttle.key,
      set: {
        count: sql`CASE WHEN ${throttle.windowEndsAt} <= ${now} THEN 1 ELSE ${throttle.count} + 1 END`,
        windowEndsAt: sql`CASE WHEN ${throttle.windowEndsAt} <= ${now} THEN ${windowEnd} ELSE ${throttle.windowEndsAt} END`,
      },
    })
    .returning({ count: throttle.count })
    .get();
  const count = row?.count ?? 1;
  return { count, limited: count >= limit.max };
}

export async function clear(deps: Pick<Deps, 'db'>, key: string): Promise<void> {
  await deps.db.delete(throttle).where(eq(throttle.key, key));
}

/** Removes finished windows. Cheap; run it from time to time (e.g. a cron trigger). */
export async function purgeExpired(deps: Pick<Deps, 'db' | 'now'>): Promise<void> {
  await deps.db.delete(throttle).where(lt(throttle.windowEndsAt, new Date(deps.now())));
}
