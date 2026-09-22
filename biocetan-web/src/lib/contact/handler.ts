import { FILE_LIMITS } from './constants';
import { buildAutoReply, buildInternalEmail } from './email';
import { validateFiles, type FileErrorCode } from './files';
import { validateContact, type FieldErrors, type RawForm } from './validate';

/** Minimal shape of a Cloudflare KV namespace, so this module stays platform-agnostic. */
export interface KVLike {
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface ContactEnv {
  /** Cloudflare Turnstile secret. Cloudflare's public test secret works for local dev. */
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  /** Verified sender, e.g. `BIOCETAN Website <no-reply@biocetan.ro>`. */
  CONTACT_FROM?: string;
  /** Where leads go. Defaults to office@biocetan.ro. */
  CONTACT_TO?: string;
  /** Optional KV binding: keeps a 90-day backup copy of every lead (no attachments). */
  LEADS?: KVLike;
  /** Overrides for tests / local mocks. */
  RESEND_API_URL?: string;
  TURNSTILE_VERIFY_URL?: string;
}

export interface Deps {
  fetch: typeof fetch;
  now: () => Date;
  uuid: () => string;
}

export type ApiCode =
  'validation' | 'captcha' | 'origin' | 'config' | 'delivery' | 'invalid' | FileErrorCode;

export type ApiResponse = { ok: true } | { ok: false; code: ApiCode; errors?: FieldErrors };

const DEFAULT_TO = 'office@biocetan.ro';
const BACKUP_TTL_SECONDS = 60 * 60 * 24 * 90;
/** Attachments plus form fields; anything larger is rejected before parsing. */
const MAX_BODY_BYTES = FILE_LIMITS.maxTotalBytes + 512 * 1024;

const FIELDS = [
  'name',
  'company',
  'email',
  'product',
  'message',
  'consent',
  'phone',
  'country',
  'industry',
  'volume',
  'volumeUnit',
  'locale',
  'source',
  'utm',
] as const;

function json(body: ApiResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function verifyTurnstile(
  token: string,
  env: ContactEnv,
  fetcher: typeof fetch,
): Promise<boolean> {
  const url =
    env.TURNSTILE_VERIFY_URL ?? 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  try {
    const response = await fetcher(url, {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY ?? '', response: token }),
    });
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error('turnstile: verification request failed', error);
    return false;
  }
}

async function sendMail(
  env: ContactEnv,
  fetcher: typeof fetch,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetcher(`${env.RESEND_API_URL ?? 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) console.error(`mail: provider responded ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error('mail: request failed', error);
    return false;
  }
}

/**
 * POST handler for the contact form. Order matters:
 * cheap checks first, Turnstile only after the fields are valid (so a validation error does
 * not burn the visitor's token), backup before mail (so a mail failure never loses a lead).
 */
export async function handleContact(
  request: Request,
  env: ContactEnv,
  deps: Partial<Deps> = {},
): Promise<Response> {
  const fetcher = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());

  const origin = request.headers.get('origin');
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === new URL(request.url).host;
    } catch {
      /* malformed origin → rejected below */
    }
    if (!sameHost) return json({ ok: false, code: 'origin' }, 403);
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return json({ ok: false, code: 'fileSize' }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, code: 'invalid' }, 400);
  }

  // Honeypot: bots fill every field. Pretend success so they learn nothing.
  if (String(form.get('website') ?? '').trim() !== '') return json({ ok: true });

  if (!env.RESEND_API_KEY || !env.CONTACT_FROM || !env.TURNSTILE_SECRET_KEY) {
    console.error('contact: missing RESEND_API_KEY, CONTACT_FROM or TURNSTILE_SECRET_KEY');
    return json({ ok: false, code: 'config' }, 500);
  }

  const raw: RawForm = {};
  for (const field of FIELDS) {
    const value = form.get(field);
    raw[field] = typeof value === 'string' ? value : undefined;
  }
  const result = validateContact(raw);
  if (!result.ok) return json({ ok: false, code: 'validation', errors: result.errors }, 400);
  const input = result.value;

  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  const fileInfo = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      size: file.size,
      head: new Uint8Array(await file.slice(0, 8).arrayBuffer()),
    })),
  );
  const fileError = validateFiles(fileInfo);
  if (fileError) return json({ ok: false, code: fileError }, fileError === 'fileSize' ? 413 : 400);

  const token = form.get('cf-turnstile-response');
  if (typeof token !== 'string' || !token || !(await verifyTurnstile(token, env, fetcher))) {
    return json({ ok: false, code: 'captcha' }, 400);
  }

  const receivedAt = now();
  const fileNames = files.map((f) => f.name);

  if (env.LEADS) {
    try {
      await env.LEADS.put(
        `lead:${receivedAt.toISOString()}:${uuid()}`,
        JSON.stringify({ ...input, files: fileNames, receivedAt: receivedAt.toISOString() }),
        { expirationTtl: BACKUP_TTL_SECONDS },
      );
    } catch (error) {
      console.error('contact: backup write failed', error);
    }
  }

  const internal = buildInternalEmail(input, {
    fileNames,
    receivedAt,
    detectedCountry: request.headers.get('cf-ipcountry') ?? undefined,
  });
  const attachments = await Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: toBase64(new Uint8Array(await file.arrayBuffer())),
    })),
  );

  const delivered = await sendMail(env, fetcher, {
    from: env.CONTACT_FROM,
    to: [env.CONTACT_TO ?? DEFAULT_TO],
    reply_to: input.email,
    subject: internal.subject,
    html: internal.html,
    text: internal.text,
    ...(attachments.length && { attachments }),
  });
  if (!delivered) return json({ ok: false, code: 'delivery' }, 502);

  // The confirmation is a courtesy; its failure must not turn a delivered lead into an error.
  const reply = buildAutoReply(input, fileNames);
  await sendMail(env, fetcher, {
    from: env.CONTACT_FROM,
    to: [input.email],
    reply_to: env.CONTACT_TO ?? DEFAULT_TO,
    subject: reply.subject,
    html: reply.html,
    text: reply.text,
  });

  return json({ ok: true });
}
