/**
 * Companies and their users. Admin-only writes; reads go through `visibleTo` so a client only
 * ever gets their own company and colleagues.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { audit, auditInsert } from './audit';
import { revokeAllSessions } from './auth/session';
import { issueToken } from './auth/tokens';
import { PortalError, type Deps, type Viewer } from './context';
import {
  auditLog,
  companies,
  users,
  type Company,
  type Locale,
  type Role,
  type User,
} from './db/schema';
import { sendMail } from './email/mailer';
import { inviteEmail } from './email/templates';
import { isAdmin, requireAdmin, visibleTo } from './tenancy';
import {
  cleanText,
  isCountryCode,
  isValidEmail,
  normalizeEmail,
  parseLocale,
  type FieldErrors,
} from './validation';

// --- companies -----------------------------------------------------------------------------

export interface CompanyInput {
  name: string;
  vatId: string | null;
  regCom: string | null;
  country: string;
  internalNotes: string | null;
}

export function parseCompanyForm(form: FormData): { value?: CompanyInput; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = cleanText(form.get('name'), 200);
  const country = (cleanText(form.get('country'), 2) ?? '').toUpperCase();
  if (!name || name.length < 2) errors.name = 'required';
  if (!isCountryCode(country)) errors.country = 'required';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    value: {
      name: name!,
      vatId: cleanText(form.get('vatId'), 40),
      regCom: cleanText(form.get('regCom'), 40),
      country,
      internalNotes: cleanText(form.get('internalNotes'), 5000),
    },
  };
}

export async function createCompany(
  deps: Deps,
  viewer: Viewer,
  input: CompanyInput,
): Promise<Company> {
  requireAdmin(viewer);
  const now = new Date(deps.now());
  const id = crypto.randomUUID();
  const [inserted] = await deps.db.batch([
    deps.db
      .insert(companies)
      .values({ id, ...input, createdAt: now, updatedAt: now })
      .returning(),
    auditInsert(deps, {
      actor: viewer,
      action: 'company.created',
      entityType: 'company',
      entityId: id,
      companyId: id,
      data: { name: input.name, country: input.country },
    }),
  ]);
  return inserted[0]!;
}

export async function listCompanies(deps: Deps, viewer: Viewer) {
  requireAdmin(viewer);
  return deps.db.select().from(companies).orderBy(asc(companies.name)).all();
}

/**
 * A company the viewer may see, or null (also null for "exists but belongs to someone else").
 * Clients get it without the admins' internal notes.
 */
export async function getCompany(
  deps: Deps,
  viewer: Viewer,
  companyId: string,
): Promise<Company | null> {
  const row = await deps.db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), visibleTo(viewer, companies.id)))
    .get();
  if (!row) return null;
  return isAdmin(viewer) ? row : { ...row, internalNotes: null };
}

export async function listCompanyUsers(
  deps: Deps,
  viewer: Viewer,
  companyId: string,
): Promise<User[]> {
  return deps.db
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), visibleTo(viewer, users.companyId)))
    .orderBy(asc(users.name))
    .all();
}

export async function listAdmins(deps: Deps, viewer: Viewer): Promise<User[]> {
  requireAdmin(viewer);
  return deps.db.select().from(users).where(eq(users.role, 'admin')).orderBy(asc(users.name)).all();
}

// --- users ---------------------------------------------------------------------------------

export interface InviteInput {
  email: string;
  name: string;
  phone: string | null;
  locale: Locale;
  role: Role;
  companyId: string | null;
}

export function parseInviteForm(
  form: FormData,
  target: { role: 'client'; companyId: string } | { role: 'admin' },
): { value?: InviteInput; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const email = normalizeEmail(String(form.get('email') ?? ''));
  const name = cleanText(form.get('name'), 120);
  if (!isValidEmail(email)) errors.email = 'invalidEmail';
  if (!name || name.length < 2) errors.name = 'required';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    value: {
      email,
      name: name!,
      phone: cleanText(form.get('phone'), 40),
      locale: parseLocale(form.get('locale')),
      role: target.role,
      companyId: target.role === 'client' ? target.companyId : null,
    },
  };
}

/** Creates the user (status `invited`) and emails a 72-hour link to set a password. */
export async function inviteUser(deps: Deps, viewer: Viewer, input: InviteInput): Promise<User> {
  requireAdmin(viewer);
  if (input.role === 'client') {
    if (!input.companyId || !(await getCompany(deps, viewer, input.companyId))) {
      throw new PortalError('notFound');
    }
  }
  const existing = await deps.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .get();
  if (existing) throw new PortalError('emailTaken');

  const now = new Date(deps.now());
  const id = crypto.randomUUID();
  const [inserted] = await deps.db.batch([
    deps.db
      .insert(users)
      .values({ id, ...input, status: 'invited', createdAt: now, updatedAt: now })
      .returning(),
    auditInsert(deps, {
      actor: viewer,
      action: 'user.invited',
      entityType: 'user',
      entityId: id,
      companyId: input.companyId,
      data: { email: input.email, role: input.role },
    }),
  ]);
  const user = inserted[0]!;
  await sendInvitation(deps, viewer, user);
  return user;
}

/** (Re)sends the invitation; any earlier link for this user stops working. */
export async function sendInvitation(deps: Deps, viewer: Viewer, user: User): Promise<void> {
  requireAdmin(viewer);
  if (user.status !== 'invited') throw new PortalError('forbidden');
  const token = await issueToken(deps, user.id, 'invite', viewer.userId);
  const mail = inviteEmail(user.locale, {
    name: user.name,
    inviter: viewer.name,
    link: `${deps.env.PORTAL_URL}/invite/${token}`,
  });
  const sent = await sendMail(deps.env, { to: user.email, ...mail });
  await audit(deps, {
    actor: viewer,
    action: sent ? 'user.invitation_sent' : 'user.invitation_mail_failed',
    entityType: 'user',
    entityId: user.id,
    companyId: user.companyId,
  });
  if (!sent) throw new PortalError('mailFailed');
}

export async function getUser(deps: Deps, viewer: Viewer, userId: string): Promise<User | null> {
  requireAdmin(viewer);
  return (await deps.db.select().from(users).where(eq(users.id, userId)).get()) ?? null;
}

export async function setUserDisabled(
  deps: Deps,
  viewer: Viewer,
  userId: string,
  disabled: boolean,
) {
  requireAdmin(viewer);
  if (userId === viewer.userId) throw new PortalError('forbidden', 'cannot disable yourself');
  const user = await getUser(deps, viewer, userId);
  if (!user) throw new PortalError('notFound');
  // Re-enabling restores `active` only if a password was ever set; otherwise back to `invited`.
  const status = disabled ? 'disabled' : user.passwordHash ? 'active' : 'invited';
  await deps.db.batch([
    deps.db
      .update(users)
      .set({ status, updatedAt: new Date(deps.now()) })
      .where(eq(users.id, userId)),
    auditInsert(deps, {
      actor: viewer,
      action: disabled ? 'user.disabled' : 'user.enabled',
      entityType: 'user',
      entityId: userId,
      companyId: user.companyId,
    }),
  ]);
  if (disabled) await revokeAllSessions(deps, userId);
}

/** Latest audit entries for one company (admin view of a client's history). */
export async function companyActivity(deps: Deps, viewer: Viewer, companyId: string, limit = 50) {
  requireAdmin(viewer);
  return deps.db
    .select()
    .from(auditLog)
    .where(eq(auditLog.companyId, companyId))
    .orderBy(desc(auditLog.at))
    .limit(limit)
    .all();
}
