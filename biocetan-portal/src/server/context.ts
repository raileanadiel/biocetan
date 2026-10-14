import type { Db } from './db/client';
import type { Locale, Role } from './db/schema';

/** The logged-in person, as every permission check sees them. */
export interface Viewer {
  userId: string;
  role: Role;
  /** Always set for clients, always null for admins (enforced by a DB trigger). */
  companyId: string | null;
  email: string;
  name: string;
  locale: Locale;
}

/**
 * Everything a service needs, passed explicitly so services run the same in pages and in tests.
 * `now` is injectable so expiry logic can be tested without waiting.
 */
export interface Deps {
  db: Db;
  env: Env;
  now: () => number;
  ip: string | null;
  userAgent: string | null;
}

export class PortalError extends Error {
  constructor(
    /** Stable code; pages map it to a translated message (`errors.<code>`). */
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'PortalError';
  }
}

export type ErrorCode =
  | 'forbidden'
  | 'notFound'
  | 'invalidCredentials'
  | 'throttled'
  | 'invalidToken'
  | 'emailTaken'
  | 'invalidInput'
  | 'weakPassword'
  | 'invalidCode'
  | 'mailFailed';
