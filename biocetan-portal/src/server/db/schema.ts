/**
 * D1 schema (SQLite). Source of truth for `drizzle-kit generate`, which writes the SQL files in
 * `migrations/`. Never edit an applied migration; change this file and generate a new one.
 *
 * Conventions: ids are random UUIDs (never sequential, so they can't be guessed or enumerated);
 * timestamps are integer milliseconds since the epoch, UTC; nothing that matters legally or
 * commercially is hard-deleted (statuses instead, and `audit_log` is append-only, enforced by
 * triggers in migration 0001).
 *
 * Phase P1 (PORTAL_PLAN.md §8) only. Later phases add requests, conversations, offers, orders…
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

export const ROLES = ['admin', 'client'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['invited', 'active', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const COMPANY_STATUSES = ['active', 'inactive'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const LOCALES = ['ro', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Client firms. BIOCETAN itself is not a row: admins have no company. */
export const companies = sqliteTable(
  'companies',
  {
    id: id(),
    name: text('name').notNull(),
    /** CUI for Romanian firms, VAT number otherwise. Optional at creation. */
    vatId: text('vat_id'),
    regCom: text('reg_com'),
    /** ISO 3166-1 alpha-2, upper case. Drives the default offer currency later (RON vs EUR). */
    country: text('country').notNull(),
    status: text('status', { enum: COMPANY_STATUSES }).notNull().default('active'),
    /** Admin-only notes; never rendered to client users. */
    internalNotes: text('internal_notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('companies_name_idx').on(t.name)],
);

export const users = sqliteTable(
  'users',
  {
    id: id(),
    /** Stored lower-cased and trimmed; unique across admins and clients. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    locale: text('locale', { enum: LOCALES }).notNull().default('ro'),
    role: text('role', { enum: ROLES }).notNull(),
    /** Required for clients, NULL for admins (CHECK in migration 0001). */
    companyId: text('company_id').references(() => companies.id),
    status: text('status', { enum: USER_STATUSES }).notNull().default('invited'),
    /** `pbkdf2-sha256$<iterations>$<salt>$<hash>`; NULL until the invitation is accepted. */
    passwordHash: text('password_hash'),
    /** TOTP secret, AES-GCM encrypted with TOTP_ENC_KEY. NULL until 2FA is set up. */
    totpSecretEnc: text('totp_secret_enc'),
    totpEnabledAt: integer('totp_enabled_at', { mode: 'timestamp_ms' }),
    /** Last accepted TOTP time step, so a code can't be replayed inside its window. */
    totpLastStep: integer('totp_last_step'),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    index('users_company_idx').on(t.companyId),
  ],
);

/** One-time links: invitations and password resets. Only the SHA-256 of the token is stored. */
export const authTokens = sqliteTable(
  'auth_tokens',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    purpose: text('purpose', { enum: ['invite', 'reset'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    createdBy: text('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('auth_tokens_hash_unique').on(t.tokenHash),
    index('auth_tokens_user_idx').on(t.userId),
  ],
);

/**
 * Login sessions. `id` is the SHA-256 of the cookie value, so a leaked database can't be used to
 * hijack sessions. `mfaVerifiedAt` stays NULL until the second factor is passed; admin sessions
 * without it can only reach the 2FA pages.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    mfaVerifiedAt: integer('mfa_verified_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Single-use 2FA recovery codes (hashed). */
export const recoveryCodes = sqliteTable(
  'recovery_codes',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    codeHash: text('code_hash').notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('recovery_codes_user_idx').on(t.userId)],
);

/**
 * Fixed-window counters for brute-force protection (login, 2FA, password-reset requests).
 * `key` is e.g. `login:email:<sha256>` or `login:ip:<ip>`; rows expire with their window.
 */
export const throttle = sqliteTable('throttle', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowEndsAt: integer('window_ends_at', { mode: 'timestamp_ms' }).notNull(),
});

/** Append-only (UPDATE/DELETE blocked by triggers in migration 0001). */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    at: integer('at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
    /** NULL for system actions and for anonymous events (e.g. a failed login). */
    actorUserId: text('actor_user_id'),
    actorIp: text('actor_ip'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    /** The client firm the event concerns, if any; lets an admin read one client's history. */
    companyId: text('company_id'),
    /** JSON details (before/after values). Never passwords, tokens or secrets. */
    data: text('data', { mode: 'json' }),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_company_idx').on(t.companyId),
    index('audit_at_idx').on(t.at),
  ],
);

export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
