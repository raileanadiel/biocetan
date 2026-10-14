-- Integrity rules SQLite can't express in drizzle's schema DSL. Enforced by the database itself,
-- so a bug in application code can't break them.

-- audit_log is append-only: corrections are new entries, history is never rewritten.
CREATE TRIGGER `audit_log_no_update` BEFORE UPDATE ON `audit_log`
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_no_delete` BEFORE DELETE ON `audit_log`
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
--> statement-breakpoint

-- A client always belongs to exactly one company; an admin never does. Tenant isolation relies on
-- this (src/server/tenancy.ts), so a client row without a company must be impossible.
CREATE TRIGGER `users_role_company_insert` BEFORE INSERT ON `users`
WHEN (NEW.role = 'client' AND NEW.company_id IS NULL)
  OR (NEW.role = 'admin' AND NEW.company_id IS NOT NULL)
  OR NEW.role NOT IN ('admin', 'client')
BEGIN
  SELECT RAISE(ABORT, 'users: clients need a company, admins must not have one');
END;
--> statement-breakpoint
CREATE TRIGGER `users_role_company_update` BEFORE UPDATE OF `role`, `company_id` ON `users`
WHEN (NEW.role = 'client' AND NEW.company_id IS NULL)
  OR (NEW.role = 'admin' AND NEW.company_id IS NOT NULL)
  OR NEW.role NOT IN ('admin', 'client')
BEGIN
  SELECT RAISE(ABORT, 'users: clients need a company, admins must not have one');
END;
--> statement-breakpoint

-- Moving a user to another company would silently hand them that company's data.
CREATE TRIGGER `users_company_immutable` BEFORE UPDATE OF `company_id` ON `users`
WHEN OLD.company_id IS NOT NULL AND NEW.company_id IS NOT OLD.company_id
BEGIN
  SELECT RAISE(ABORT, 'users: company_id cannot change; invite a new user instead');
END;
