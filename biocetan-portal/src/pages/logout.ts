import type { APIRoute } from 'astro';
import { audit } from '../server/audit';
import { SESSION_COOKIE, revokeSession } from '../server/auth/session';

// POST only (the header's logout button is a form), so a link or image on another site can't
// log users out; Astro's origin check rejects cross-site posts.
export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  const { auth, deps } = locals;
  if (auth) {
    await revokeSession(deps, auth.session.id);
    await audit(deps, {
      actor: auth.viewer,
      action: 'auth.logout',
      entityType: 'user',
      entityId: auth.user.id,
      companyId: auth.user.companyId,
    });
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/login?n=loggedOut');
};

export const GET: APIRoute = ({ redirect }) => redirect('/');
