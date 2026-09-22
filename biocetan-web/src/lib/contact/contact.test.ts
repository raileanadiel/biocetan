import { describe, expect, it, vi } from 'vitest';
import { validateContact } from './validate';
import { validateFiles } from './files';
import { buildAutoReply, buildInternalEmail, escapeHtml } from './email';
import { handleContact, type ContactEnv } from './handler';

const valid = {
  name: 'Ion Popescu',
  company: 'Agro Test SRL',
  email: 'Ion@Agro-Test.ro',
  product: 'rme',
  message: 'We need 20 tonnes of RME per month for agrochemical formulations.',
  consent: 'on',
};

describe('validateContact', () => {
  it('accepts the minimal quick form and normalises values', () => {
    const result = validateContact(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('ion@agro-test.ro');
      expect(result.value.locale).toBe('en');
      expect(result.value.phone).toBeUndefined();
    }
  });

  it('reports every missing required field', () => {
    const result = validateContact({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        name: 'required',
        company: 'required',
        email: 'required',
        product: 'required',
        message: 'required',
        consent: 'consent',
      });
    }
  });

  it.each([
    ['not-an-email', 'email'],
    ['a@b', 'email'],
    ['two words@x.com', 'email'],
  ])('rejects email %s', (email, code) => {
    const result = validateContact({ ...valid, email });
    expect(!result.ok && result.errors.email).toBe(code);
  });

  it('enforces the 20-character message minimum', () => {
    const result = validateContact({ ...valid, message: 'too short' });
    expect(!result.ok && result.errors.message).toBe('tooShort');
  });

  it('rejects unknown select values instead of trusting the client', () => {
    const result = validateContact({ ...valid, product: 'gold', country: 'ZZ', industry: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.product).toBe('invalid');
      expect(result.errors.country).toBe('invalid');
      expect(result.errors.industry).toBe('invalid');
    }
  });

  it('requires an explicit consent tick', () => {
    const result = validateContact({ ...valid, consent: undefined });
    expect(!result.ok && result.errors.consent).toBe('consent');
  });

  it('strips line breaks from single-line fields (header injection)', () => {
    const result = validateContact({ ...valid, name: 'Ion\r\nBcc: evil@x.com' });
    expect(result.ok && result.value.name).toBe('Ion Bcc: evil@x.com');
  });

  it('keeps line breaks in the message', () => {
    const result = validateContact({ ...valid, message: 'Line one is long enough.\nLine two.' });
    expect(result.ok && result.value.message).toContain('\n');
  });

  it('validates optional phone, volume and unit when present', () => {
    expect(
      validateContact({
        ...valid,
        phone: '+40 741 039 292',
        volume: '20',
        volumeUnit: 't-month',
        country: 'HU',
        industry: 'agrochemicals',
      }).ok,
    ).toBe(true);
    const bad = validateContact({ ...valid, phone: 'call me maybe' });
    expect(!bad.ok && bad.errors.phone).toBe('invalid');
  });
});

describe('validateFiles', () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  it('accepts a real PDF', () => {
    expect(validateFiles([{ name: 'tds.PDF', size: 1000, head: pdf }])).toBeNull();
  });
  it('rejects a disallowed extension', () => {
    expect(validateFiles([{ name: 'run.exe', size: 10 }])).toBe('fileType');
  });
  it('rejects a file whose content does not match its extension', () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(validateFiles([{ name: 'invoice.pdf', size: 10, head: exe }])).toBe('fileType');
  });
  it('rejects more than 3 files', () => {
    const f = { name: 'a.pdf', size: 1, head: pdf };
    expect(validateFiles([f, f, f, f])).toBe('fileCount');
  });
  it('rejects more than 10 MB in total', () => {
    const big = { name: 'a.pdf', size: 6 * 1024 * 1024, head: pdf };
    expect(validateFiles([big, big])).toBe('fileSize');
  });
});

describe('email templates', () => {
  const parsed = validateContact({
    ...valid,
    product: 'toll',
    country: 'HU',
    locale: 'ro',
    source: '/ro/',
  });
  if (!parsed.ok) throw new Error('fixture invalid');
  const input = parsed.value;

  it('escapes HTML in user content', () => {
    expect(escapeHtml('<script>"x"&')).toBe('&lt;script&gt;&quot;x&quot;&amp;');
    const mail = buildInternalEmail(
      { ...input, company: '<b>Evil</b>' },
      { fileNames: [], receivedAt: new Date() },
    );
    expect(mail.html).not.toContain('<b>Evil</b>');
    expect(mail.html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
  });

  it('builds a scannable internal subject', () => {
    const mail = buildInternalEmail(input, {
      fileNames: ['a.pdf'],
      receivedAt: new Date('2026-01-01'),
    });
    expect(mail.subject).toBe('[RFQ] Toll manufacturing — Agro Test SRL (Hungary)');
    expect(mail.text).toContain('Attachments: a.pdf');
  });

  it("writes the auto-reply in the visitor's language", () => {
    const mail = buildAutoReply(input, []);
    expect(mail.subject).toContain('Am primit solicitarea');
    expect(mail.text).toContain('Ion Popescu');
    expect(mail.text).toContain('Prelucrare la façon');
  });
});

describe('handleContact', () => {
  const env: ContactEnv = {
    TURNSTILE_SECRET_KEY: 'secret',
    RESEND_API_KEY: 're_test',
    CONTACT_FROM: 'BIOCETAN Website <no-reply@biocetan.ro>',
  };

  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

  function request(
    fields: Record<string, string>,
    opts: { files?: File[]; headers?: Record<string, string> } = {},
  ) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    for (const file of opts.files ?? []) body.append('files', file);
    return new Request('https://www.biocetan.ro/api/contact', {
      method: 'POST',
      body,
      headers: { origin: 'https://www.biocetan.ro', ...opts.headers },
    });
  }

  /** fetch mock: Turnstile succeeds, Resend accepts. */
  function makeFetch(overrides: { turnstile?: boolean; resendStatus?: number } = {}) {
    return vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes('siteverify')) {
        return new Response(JSON.stringify({ success: overrides.turnstile ?? true }));
      }
      return new Response('{}', { status: overrides.resendStatus ?? 200 });
    }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  }

  type FetchCall = [string | URL | Request, RequestInit | undefined];
  /** Parsed JSON bodies of the mails sent through the mocked provider. */
  function mailBodies(fetcher: { mock: { calls: unknown[][] } }) {
    return (fetcher.mock.calls as FetchCall[])
      .filter(([url]) => String(url).includes('/emails'))
      .map(([, init]) => JSON.parse(String(init?.body)));
  }

  const good = { ...valid, 'cf-turnstile-response': 'token', locale: 'en', source: '/contact/' };

  it('delivers a valid lead: internal mail + auto-reply, reply-to set to the visitor', async () => {
    const fetcher = makeFetch();
    const res = await handleContact(request(good), env, { fetch: fetcher });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [internal, reply] = mailBodies(fetcher);
    expect(mailBodies(fetcher)).toHaveLength(2);
    expect(internal.to).toEqual(['office@biocetan.ro']);
    expect(internal.reply_to).toBe('ion@agro-test.ro');
    expect(internal.subject).toContain('[RFQ] RME');
    expect(reply.to).toEqual(['ion@agro-test.ro']);
  });

  it('forwards attachments as base64', async () => {
    const fetcher = makeFetch();
    const file = new File([pdfBytes], 'spec.pdf', { type: 'application/pdf' });
    const res = await handleContact(request(good, { files: [file] }), env, { fetch: fetcher });
    expect(res.status).toBe(200);
    const [internal] = mailBodies(fetcher);
    expect(internal.attachments).toEqual([
      { filename: 'spec.pdf', content: btoa(String.fromCharCode(...pdfBytes)) },
    ]);
  });

  it('rejects a spoofed attachment', async () => {
    const fetcher = makeFetch();
    const fake = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], 'invoice.pdf', {
      type: 'application/pdf',
    });
    const res = await handleContact(request(good, { files: [fake] }), env, { fetch: fetcher });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('fileType');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns field errors and does not spend the Turnstile token', async () => {
    const fetcher = makeFetch();
    const res = await handleContact(request({ ...good, email: 'nope' }), env, { fetch: fetcher });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; errors: Record<string, string> };
    expect(body.code).toBe('validation');
    expect(body.errors.email).toBe('email');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a failed Turnstile check and sends nothing', async () => {
    const fetcher = makeFetch({ turnstile: false });
    const res = await handleContact(request(good), env, { fetch: fetcher });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('captcha');
    expect(mailBodies(fetcher)).toHaveLength(0);
  });

  it('rejects a missing Turnstile token', async () => {
    const { 'cf-turnstile-response': _omit, ...withoutToken } = good;
    const res = await handleContact(request(withoutToken), env, { fetch: makeFetch() });
    expect(((await res.json()) as { code: string }).code).toBe('captcha');
  });

  it('silently accepts honeypot submissions without sending anything', async () => {
    const fetcher = makeFetch();
    const res = await handleContact(request({ ...good, website: 'http://spam.example' }), env, {
      fetch: fetcher,
    });
    expect(res.status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects cross-origin posts', async () => {
    const res = await handleContact(
      request(good, { headers: { origin: 'https://evil.example' } }),
      env,
      { fetch: makeFetch() },
    );
    expect(res.status).toBe(403);
  });

  it('fails closed when secrets are missing', async () => {
    const res = await handleContact(
      request(good),
      { ...env, TURNSTILE_SECRET_KEY: undefined },
      { fetch: makeFetch() },
    );
    expect(res.status).toBe(500);
    expect(((await res.json()) as { code: string }).code).toBe('config');
  });

  it('reports delivery failure when the mail provider rejects, but still backs the lead up first', async () => {
    const put = vi.fn(async () => {});
    const res = await handleContact(
      request(good),
      { ...env, LEADS: { put } },
      { fetch: makeFetch({ resendStatus: 500 }), uuid: () => 'id-1' },
    );
    expect(res.status).toBe(502);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, value, options] = put.mock.calls[0] as unknown as [
      string,
      string,
      { expirationTtl: number },
    ];
    expect(key).toMatch(/^lead:.+:id-1$/);
    expect(JSON.parse(value).email).toBe('ion@agro-test.ro');
    expect(options.expirationTtl).toBe(60 * 60 * 24 * 90);
  });

  it('still succeeds when only the auto-reply fails', async () => {
    let mailCount = 0;
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('siteverify'))
        return new Response(JSON.stringify({ success: true }));
      mailCount += 1;
      return new Response('{}', { status: mailCount === 1 ? 200 : 500 });
    }) as unknown as typeof fetch;
    const res = await handleContact(request(good), env, { fetch: fetcher });
    expect(res.status).toBe(200);
  });
});
