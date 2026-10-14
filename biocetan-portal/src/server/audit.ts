import type { Deps, Viewer } from './context';
import { auditLog } from './db/schema';

export interface AuditEntry {
  /** `null` for anonymous or system events. */
  actor: Viewer | { userId: string } | null;
  action: string;
  entityType?: string;
  entityId?: string;
  companyId?: string | null;
  /** Before/after values or context. Never put passwords, tokens or secrets here. */
  data?: Record<string, unknown>;
}

/**
 * Returns the insert without running it, so callers can put it in the same `db.batch()` as the
 * change it records (D1 runs a batch atomically: both happen or neither).
 */
export function auditInsert(deps: Pick<Deps, 'db' | 'ip' | 'now'>, entry: AuditEntry) {
  return deps.db.insert(auditLog).values({
    at: new Date(deps.now()),
    actorUserId: entry.actor?.userId ?? null,
    actorIp: deps.ip,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    companyId: entry.companyId ?? null,
    data: entry.data ?? null,
  });
}

export async function audit(deps: Pick<Deps, 'db' | 'ip' | 'now'>, entry: AuditEntry) {
  await auditInsert(deps, entry);
}
