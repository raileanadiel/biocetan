// Cloudflare Pages Function → POST /api/contact
// All logic lives in src/lib/contact/handler.ts (unit-tested); this file only wires it to Pages.
import { handleContact, type ContactEnv } from '../../src/lib/contact/handler';

interface Context {
  request: Request;
  env: ContactEnv;
}

export const onRequestPost = ({ request, env }: Context): Promise<Response> =>
  handleContact(request, env);

// Any other method.
export const onRequest = (): Response =>
  new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
