/**
 * Runtime configuration, read once from environment variables (on the VM: docker-compose.yml plus
 * its `.env`; locally: `.env`, loaded by `node --env-file` / Astro). See `.env.example`.
 * Secrets (RESEND_API_KEY, TOTP_ENC_KEY) only ever come from the environment, never from code.
 */
export interface PortalConfig {
  /** libsql URL; a local SQLite file on the VM, e.g. `file:/data/portal.db` (Docker volume). */
  DATABASE_URL: string;
  PORTAL_URL: string;
  MAIL_FROM: string;
  RESEND_API_URL: string;
  RESEND_API_KEY: string;
  /** 32 bytes, base64url. Only needed once someone turns on 2FA. */
  TOTP_ENC_KEY: string;
  /** When true, admins must enrol and use TOTP. Off for now (owner's decision, 2026-10-30). */
  REQUIRE_ADMIN_MFA: boolean;
  /**
   * Which header carries the visitor's real IP (used for throttling and the audit log).
   * `cloudflare` = `CF-Connecting-IP` (portal behind a Cloudflare proxy or tunnel),
   * `x-forwarded-for` = first hop of a local reverse proxy (Caddy/nginx), `none` = the socket.
   * Trusting a header the visitor can set themselves would let them dodge throttling, so pick
   * the one that matches the actual setup.
   */
  TRUSTED_PROXY: 'cloudflare' | 'x-forwarded-for' | 'none';
}

function read(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing environment variable ${name}`);
  return value;
}

let cached: PortalConfig | undefined;

export function getConfig(): PortalConfig {
  if (cached) return cached;
  const proxy = read('TRUSTED_PROXY', 'none');
  if (proxy !== 'cloudflare' && proxy !== 'x-forwarded-for' && proxy !== 'none') {
    throw new Error('TRUSTED_PROXY must be cloudflare, x-forwarded-for or none');
  }
  cached = {
    DATABASE_URL: read('DATABASE_URL', 'file:./data/portal.db'),
    PORTAL_URL: read('PORTAL_URL', 'http://localhost:4322').replace(/\/$/, ''),
    MAIL_FROM: read('MAIL_FROM', 'BIOCETAN Portal <no-reply@biocetan.ro>'),
    RESEND_API_URL: read('RESEND_API_URL', 'https://api.resend.com'),
    RESEND_API_KEY: read('RESEND_API_KEY', ''),
    TOTP_ENC_KEY: read('TOTP_ENC_KEY', ''),
    REQUIRE_ADMIN_MFA: read('REQUIRE_ADMIN_MFA', 'false') === 'true',
    TRUSTED_PROXY: proxy,
  };
  return cached;
}

/** The visitor's IP according to `TRUSTED_PROXY`. */
export function clientIp(
  config: PortalConfig,
  headers: Headers,
  socketAddress: string | undefined,
): string | null {
  if (config.TRUSTED_PROXY === 'cloudflare')
    return headers.get('cf-connecting-ip') ?? socketAddress ?? null;
  if (config.TRUSTED_PROXY === 'x-forwarded-for') {
    return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || socketAddress || null;
  }
  return socketAddress ?? null;
}
