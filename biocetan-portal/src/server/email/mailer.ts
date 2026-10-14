/**
 * Transactional email through Resend (same verified domain as the public site). Locally,
 * RESEND_API_URL points at scripts/mock-resend.mjs, which prints the mail instead of sending it.
 */
export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(
  env: Env,
  mail: Mail,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.error('mail: RESEND_API_KEY is not set');
    return false;
  }
  try {
    const response = await fetcher(`${env.RESEND_API_URL}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo && { reply_to: mail.replyTo }),
      }),
    });
    if (!response.ok) {
      console.error('mail: provider rejected the message', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('mail: request failed', error);
    return false;
  }
}
