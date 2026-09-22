import { useTranslations } from '../../i18n';
import { site } from '../../config/site';
import type { ContactInput } from './validate';

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function countryName(code: string | undefined, locale: 'en' | 'ro'): string {
  if (!code) return '';
  if (code === 'OTHER') return locale === 'ro' ? 'Altă țară' : 'Other';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const UNIT_LABEL = { 't-month': 't / month', 't-year': 't / year', 'one-off': 'one-off' } as const;

/** The notification the sales team receives. English: staff-facing, whatever language the lead uses. */
export function buildInternalEmail(
  input: ContactInput,
  meta: { fileNames: string[]; receivedAt: Date; detectedCountry?: string },
): BuiltEmail {
  const t = useTranslations('en');
  const product = t(`form.options.product.${input.product}`);
  const country = countryName(input.country, 'en') || meta.detectedCountry || '';
  const volume = input.volume
    ? `${input.volume}${input.volumeUnit ? ` ${UNIT_LABEL[input.volumeUnit]}` : ''}`
    : '';

  const rows: [string, string][] = [
    ['Company', input.company],
    ['Contact', input.name],
    ['Email', input.email],
    ['Phone', input.phone ?? ''],
    ['Country', country],
    ['Industry', input.industry ? t(`form.options.industry.${input.industry}`) : ''],
    ['Product / service', product],
    ['Estimated volume', volume],
    ['Attachments', meta.fileNames.join(', ')],
    ['Language', input.locale.toUpperCase()],
    ['Sent from', input.source],
    ['Campaign (UTM)', input.utm ?? ''],
    ['Received', meta.receivedAt.toISOString()],
  ];
  const filled = rows.filter(([, value]) => value);

  const subject = `[RFQ] ${product} — ${input.company}${country ? ` (${country})` : ''}`.slice(
    0,
    200,
  );

  const text = [
    ...filled.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    input.message,
    '',
    'Reply to this email to answer the sender directly.',
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2a37;line-height:1.5">
<h2 style="margin:0 0 12px;color:#002746">New quote request</h2>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
${filled
  .map(
    ([label, value]) =>
      `<tr><td style="border-bottom:1px solid #d8e3df;color:#5b6b7a;white-space:nowrap">${escapeHtml(label)}</td><td style="border-bottom:1px solid #d8e3df"><strong>${escapeHtml(value)}</strong></td></tr>`,
  )
  .join('\n')}
</table>
<h3 style="margin:20px 0 6px;color:#002746">Message</h3>
<p style="white-space:pre-wrap;margin:0">${escapeHtml(input.message)}</p>
<p style="margin-top:24px;font-size:12px;color:#5b6b7a">Reply to this email to answer the sender directly.</p>
</body></html>`;

  return { subject, html, text };
}

/** Confirmation copy sent to the visitor, in the language they used on the site. */
export function buildAutoReply(input: ContactInput, fileNames: string[]): BuiltEmail {
  const t = useTranslations(input.locale);
  const greeting = t('email.autoreply.greeting').replace('{name}', input.name);

  const summary: [string, string][] = [
    [t('email.autoreply.product'), t(`form.options.product.${input.product}`)],
    [t('email.autoreply.message'), input.message],
    ...(fileNames.length
      ? ([[t('email.autoreply.files'), fileNames.join(', ')]] as [string, string][])
      : []),
  ];

  const signature = [
    site.legalName,
    `${site.address.street}, ${site.address.city}, ${site.address.county}`,
    `${site.phone.display} · ${site.email}`,
  ];

  const text = [
    greeting,
    '',
    t('email.autoreply.intro'),
    '',
    ...summary.map(([label, value]) => `${label}: ${value}`),
    '',
    t('email.autoreply.closing'),
    '',
    ...signature,
  ].join('\n');

  const html = `<!doctype html><html lang="${input.locale}"><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2a37;line-height:1.5">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(t('email.autoreply.intro'))}</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;background:#f2f8f6;border-radius:6px">
${summary
  .map(
    ([label, value]) =>
      `<tr><td style="vertical-align:top;color:#5b6b7a;white-space:nowrap">${escapeHtml(label)}</td><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
  )
  .join('\n')}
</table>
<p>${escapeHtml(t('email.autoreply.closing'))}</p>
<p style="color:#5b6b7a;font-size:13px">${signature.map(escapeHtml).join('<br>')}</p>
</body></html>`;

  return { subject: t('email.autoreply.subject'), html, text };
}
