/**
 * Transactional emails, RO + EN. Plain, table-free HTML with inline styles (what email clients
 * render reliably) plus a text part. Every interpolated value is HTML-escaped.
 */
import { useTranslations } from '../../i18n';
import type { Locale } from '../db/schema';

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(
  locale: Locale,
  paragraphs: string[],
  button: { label: string; href: string },
  after: string[],
) {
  const t = useTranslations(locale);
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2a37">${escapeHtml(text)}</p>`;
  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;padding:24px;background:#f2f8f6;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d8e3df;border-radius:8px;padding:32px">
<p style="margin:0 0 24px;font-size:22px;font-weight:800;font-style:italic;letter-spacing:-0.5px"><span style="color:#458517">BIO</span><span style="color:#082666">CETAN</span> <span style="font-size:13px;font-style:normal;font-weight:600;color:#5b6b7a">${escapeHtml(t('meta.portalName'))}</span></p>
${paragraphs.map(p).join('\n')}
<p style="margin:24px 0"><a href="${escapeHtml(button.href)}" style="display:inline-block;background:#458517;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px">${escapeHtml(button.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5b6b7a">${escapeHtml(t('email.linkFallback'))}<br><span style="word-break:break-all">${escapeHtml(button.href)}</span></p>
${after.map(p).join('\n')}
<p style="margin:24px 0 0;font-size:12px;color:#5b6b7a">BIOCETAN S.R.L. · Str. Letea Mare nr. 44, Săcueni, Bihor, România · office@biocetan.ro</p>
</div></body></html>`;
  const text = [
    ...paragraphs,
    `${button.label}: ${button.href}`,
    ...after,
    '—',
    'BIOCETAN S.R.L. · office@biocetan.ro',
  ].join('\n\n');
  return { html, text };
}

export function inviteEmail(
  locale: Locale,
  vars: { name: string; inviter: string; link: string },
): RenderedMail {
  const t = useTranslations(locale);
  const { html, text } = layout(
    locale,
    [t('email.greeting', { name: vars.name }), t('email.invite.body', { inviter: vars.inviter })],
    { label: t('email.invite.button'), href: vars.link },
    [t('email.invite.expiry'), t('email.notYou')],
  );
  return { subject: t('email.invite.subject'), html, text };
}

export function resetEmail(locale: Locale, vars: { name: string; link: string }): RenderedMail {
  const t = useTranslations(locale);
  const { html, text } = layout(
    locale,
    [t('email.greeting', { name: vars.name }), t('email.reset.body')],
    { label: t('email.reset.button'), href: vars.link },
    [t('email.reset.expiry'), t('email.reset.ignore')],
  );
  return { subject: t('email.reset.subject'), html, text };
}
