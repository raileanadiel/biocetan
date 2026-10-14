import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { createCompany, inviteUser } from '../src/server/accounts';
import { acceptInvite } from '../src/server/auth/flows';
import { toViewer } from '../src/server/auth/session';
import type { Deps, Viewer } from '../src/server/context';
import { getDb } from '../src/server/db/client';
import { users, type User } from '../src/server/db/schema';
import { sentMails } from './setup';

export const PASSWORD = 'correct horse battery staple';

/** Deps with a controllable clock: `clock.advance(ms)` moves time forward. */
export function makeDeps(start = Date.UTC(2026, 9, 14, 9, 0, 0)) {
  let now = start;
  const deps: Deps = {
    db: getDb(env.DB),
    env,
    now: () => now,
    ip: '203.0.113.7',
    userAgent: 'vitest',
  };
  return {
    deps,
    clock: {
      advance(ms: number) {
        now += ms;
      },
    },
  };
}

/** An active admin inserted directly (the first admin is bootstrapped by a script, not invited). */
export async function seedAdmin(
  deps: Deps,
  email = 'admin@biocetan.ro',
): Promise<{ user: User; viewer: Viewer }> {
  const { hashPassword } = await import('../src/server/crypto');
  const user = await deps.db
    .insert(users)
    .values({
      email,
      name: 'Admin Test',
      role: 'admin',
      status: 'active',
      passwordHash: await hashPassword(PASSWORD),
    })
    .returning()
    .get();
  return { user, viewer: toViewer(user) };
}

/** Pulls the token out of the most recent mail's link (`/invite/<token>` or `/reset/<token>`). */
export function lastLinkToken(kind: 'invite' | 'reset'): string {
  const mail = sentMails.at(-1);
  const match = mail?.text.match(new RegExp(`/${kind}/([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`No ${kind} link in the last mail`);
  return match[1]!;
}

/** A company with one client user who has accepted the invitation (status active). */
export async function seedCompanyWithClient(
  deps: Deps,
  admin: Viewer,
  name: string,
  email: string,
): Promise<{ companyId: string; user: User; viewer: Viewer }> {
  const company = await createCompany(deps, admin, {
    name,
    vatId: null,
    regCom: null,
    country: 'RO',
    internalNotes: `secret note about ${name}`,
  });
  await inviteUser(deps, admin, {
    email,
    name: `${name} Contact`,
    phone: null,
    locale: 'ro',
    role: 'client',
    companyId: company.id,
  });
  await acceptInvite(deps, lastLinkToken('invite'), PASSWORD);
  const user = (await deps.db.select().from(users).where(eq(users.email, email)).get())!;
  return { companyId: company.id, user, viewer: toViewer(user) };
}
