// Local stand-in for the Resend API so the contact form can be tested end to end without credentials.
// Usage: node scripts/mock-resend.mjs   (then set RESEND_API_URL=http://127.0.0.1:8899 in .dev.vars)
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const port = Number(process.env.PORT ?? 8899);
const log = process.env.MOCK_RESEND_LOG;

createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let mail = {};
    try {
      mail = JSON.parse(body);
    } catch {
      /* ignore */
    }
    const summary = {
      path: req.url,
      auth: req.headers.authorization ? 'Bearer …' : 'missing',
      from: mail.from,
      to: mail.to,
      reply_to: mail.reply_to,
      subject: mail.subject,
      attachments: (mail.attachments ?? []).map(
        (a) => `${a.filename} (${Math.round((a.content.length * 3) / 4)} bytes)`,
      ),
      text: mail.text,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (log) appendFileSync(log, JSON.stringify(summary) + '\n');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'mock-' + Date.now() }));
  });
}).listen(port, '127.0.0.1', () =>
  console.log(`mock Resend listening on http://127.0.0.1:${port}`),
);
