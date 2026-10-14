/**
 * Tenant isolation (PORTAL_PLAN.md §5, "regula de aur"): a client of company A must not reach
 * anything of company B, whatever id they put in a URL or form. Every new client-facing query
 * should get a case here.
 */
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  activity,
  dashboardStats,
  createCompany,
  getCompany,
  getUser,
  inviteUser,
  listAdmins,
  listCompanies,
  listCompanyUsers,
  setUserDisabled,
} from '../src/server/accounts';
import { PortalError } from '../src/server/context';
import { auditLog, users } from '../src/server/db/schema';
import { makeDeps, seedAdmin, seedCompanyWithClient } from './helpers';

async function setup() {
  const { deps } = makeDeps();
  const admin = await seedAdmin(deps);
  const a = await seedCompanyWithClient(deps, admin.viewer, 'Alpha SRL', 'ana@alpha.ro');
  const b = await seedCompanyWithClient(deps, admin.viewer, 'Beta SRL', 'bogdan@beta.ro');
  return { deps, admin, a, b };
}

async function expectForbidden(promise: Promise<unknown>) {
  await expect(promise).rejects.toSatisfy(
    (e) => e instanceof PortalError && e.code === 'forbidden',
  );
}

describe('client of company A', () => {
  it('sees their own company and colleagues', async () => {
    const { deps, a } = await setup();
    expect((await getCompany(deps, a.viewer, a.companyId))?.name).toBe('Alpha SRL');
    expect((await listCompanyUsers(deps, a.viewer, a.companyId)).map((u) => u.email)).toEqual([
      'ana@alpha.ro',
    ]);
  });

  it("can't read company B, even with B's id", async () => {
    const { deps, a, b } = await setup();
    expect(await getCompany(deps, a.viewer, b.companyId)).toBeNull();
    expect(await listCompanyUsers(deps, a.viewer, b.companyId)).toEqual([]);
  });

  it("gets nothing from ids that don't exist either (same answer as for B)", async () => {
    const { deps, a } = await setup();
    expect(await getCompany(deps, a.viewer, crypto.randomUUID())).toBeNull();
  });

  it("can't call any admin action", async () => {
    const { deps, a, b } = await setup();
    await expectForbidden(listCompanies(deps, a.viewer));
    await expectForbidden(listAdmins(deps, a.viewer));
    await expectForbidden(getUser(deps, a.viewer, b.user.id));
    await expectForbidden(activity(deps, a.viewer, { companyId: b.companyId }));
    await expectForbidden(dashboardStats(deps, a.viewer));
    await expectForbidden(setUserDisabled(deps, a.viewer, b.user.id, true));
    await expectForbidden(
      createCompany(deps, a.viewer, {
        name: 'X',
        vatId: null,
        regCom: null,
        country: 'RO',
        internalNotes: null,
      }),
    );
    await expectForbidden(
      inviteUser(deps, a.viewer, {
        email: 'intruder@alpha.ro',
        name: 'Intruder',
        phone: null,
        locale: 'ro',
        role: 'admin',
        companyId: null,
      }),
    );
  });

  it("can't escalate by forging a viewer with another company's id", async () => {
    const { deps, a, b } = await setup();
    // Viewers come only from validated sessions; this proves the filter really uses companyId.
    const forged = { ...a.viewer, companyId: b.companyId };
    expect(await getCompany(deps, forged, a.companyId)).toBeNull();
  });
});

describe('admin', () => {
  it('sees every company and its users', async () => {
    const { deps, admin, a, b } = await setup();
    expect((await listCompanies(deps, admin.viewer)).map((c) => c.company.name)).toEqual([
      'Alpha SRL',
      'Beta SRL',
    ]);
    expect(await getCompany(deps, admin.viewer, b.companyId)).not.toBeNull();
    expect(await listCompanyUsers(deps, admin.viewer, a.companyId)).toHaveLength(1);
  });

  it("can't invite a client into a company that doesn't exist", async () => {
    const { deps, admin } = await setup();
    await expect(
      inviteUser(deps, admin.viewer, {
        email: 'x@x.ro',
        name: 'X',
        phone: null,
        locale: 'ro',
        role: 'client',
        companyId: crypto.randomUUID(),
      }),
    ).rejects.toSatisfy((e) => e instanceof PortalError && e.code === 'notFound');
  });

  it("can't disable their own account", async () => {
    const { deps, admin } = await setup();
    await expectForbidden(setUserDisabled(deps, admin.viewer, admin.user.id, true));
  });

  it("reads one company's history without the other's", async () => {
    const { deps, admin, a } = await setup();
    const entries = await activity(deps, admin.viewer, { companyId: a.companyId });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.companyId === a.companyId)).toBe(true);
  });
});

describe('database guarantees (triggers)', () => {
  it('refuses a client without a company and an admin with one', async () => {
    const { deps, a } = await setup();
    await expect(
      deps.db.insert(users).values({ email: 'orphan@x.ro', name: 'Orphan', role: 'client' }),
    ).rejects.toThrow();
    await expect(
      deps.db
        .insert(users)
        .values({ email: 'adm@x.ro', name: 'Adm', role: 'admin', companyId: a.companyId }),
    ).rejects.toThrow();
  });

  it("won't move a user to another company", async () => {
    const { deps, a, b } = await setup();
    await expect(
      deps.db.update(users).set({ companyId: b.companyId }).where(eq(users.id, a.user.id)),
    ).rejects.toThrow();
  });

  it('keeps the audit log append-only', async () => {
    const { deps } = await setup();
    await expect(deps.db.update(auditLog).set({ action: 'tampered' })).rejects.toThrow();
    await expect(deps.db.delete(auditLog)).rejects.toThrow();
    const count = await deps.db
      .select({ n: sql<number>`count(*)` })
      .from(auditLog)
      .get();
    expect(count!.n).toBeGreaterThan(0);
  });

  it("never hands a client the admins' internal notes", async () => {
    const { deps, admin, a } = await setup();
    expect((await getCompany(deps, a.viewer, a.companyId))?.internalNotes).toBeNull();
    expect((await getCompany(deps, admin.viewer, a.companyId))?.internalNotes).toBe(
      'secret note about Alpha SRL',
    );
  });
});

describe('admin dashboard numbers', () => {
  it('counts companies, active client users and pending invitations', async () => {
    const { deps, admin, a } = await setup();
    await inviteUser(deps, admin.viewer, {
      email: 'pending@alpha.ro',
      name: 'Pending',
      phone: null,
      locale: 'ro',
      role: 'client',
      companyId: a.companyId,
    });
    expect(await dashboardStats(deps, admin.viewer)).toEqual({
      companies: 2,
      activeClients: 2,
      pendingInvites: 1,
    });
    const list = await listCompanies(deps, admin.viewer);
    expect(list.find((c) => c.company.id === a.companyId)?.userCount).toBe(2);
  });
});
