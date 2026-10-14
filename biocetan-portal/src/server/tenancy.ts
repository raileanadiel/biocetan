/**
 * Tenant isolation: the single place that decides which rows a viewer may see.
 *
 * Rule (PORTAL_PLAN.md §5): every read for a client user is filtered by that user's company.
 * Admins see everything. Client-facing queries must build their WHERE clause with
 * `visibleTo(viewer, table.companyId)` — never trust a company id from the URL or a form.
 * test/tenancy.test.ts checks that company A can't reach anything of company B.
 */
import { sql, eq, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { PortalError, type Viewer } from './context';

export function isAdmin(viewer: Viewer | null | undefined): viewer is Viewer & { role: 'admin' } {
  return viewer?.role === 'admin';
}

export function requireAdmin(viewer: Viewer | null | undefined): asserts viewer is Viewer {
  if (!isAdmin(viewer)) throw new PortalError('forbidden');
}

/** The company a client is confined to. Throws for admins, who aren't confined to one. */
export function clientCompanyId(viewer: Viewer): string {
  if (viewer.role !== 'client' || !viewer.companyId) throw new PortalError('forbidden');
  return viewer.companyId;
}

/**
 * WHERE condition limiting `companyColumn` to what `viewer` may see: everything for an admin,
 * only their own company for a client.
 */
export function visibleTo(viewer: Viewer, companyColumn: SQLiteColumn): SQL {
  if (isAdmin(viewer)) return sql`1 = 1`;
  return eq(companyColumn, clientCompanyId(viewer));
}
