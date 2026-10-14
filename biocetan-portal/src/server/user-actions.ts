/**
 * The POST actions shared by the company page and the admins page: invite, resend invitation,
 * disable, re-enable. `scope` pins which users the page manages, so a user id posted from the
 * wrong page is ignored rather than acted on.
 */
import type { TranslationKey } from '../i18n';
import { getUser, inviteUser, parseInviteForm, sendInvitation, setUserDisabled } from './accounts';
import type { Deps, Viewer } from './context';
import type { FieldErrors } from './validation';
import { errorCode, field } from './web';

export type Scope = { role: 'client'; companyId: string } | { role: 'admin' };

export interface ActionResult {
  notice?: { key: TranslationKey; vars?: Record<string, string> };
  failure?: string;
  errors: FieldErrors;
  values: { name: string; email: string; phone: string; locale: string };
}

export async function handleUserAction(
  deps: Deps,
  viewer: Viewer,
  form: FormData,
  scope: Scope,
): Promise<ActionResult> {
  const values = {
    name: field(form, 'name'),
    email: field(form, 'email'),
    phone: field(form, 'phone'),
    locale: field(form, 'locale') || 'ro',
  };
  const result: ActionResult = { errors: {}, values };
  const intent = field(form, 'intent');

  try {
    if (intent === 'invite') {
      const parsed = parseInviteForm(form, scope);
      result.errors = parsed.errors;
      if (!parsed.value) return result;
      const user = await inviteUser(deps, viewer, parsed.value);
      result.notice = { key: 'admin.inviteSent', vars: { email: user.email } };
      result.values = { name: '', email: '', phone: '', locale: values.locale };
      return result;
    }

    const user = await getUser(deps, viewer, field(form, 'userId'));
    const inScope =
      user &&
      (scope.role === 'admin'
        ? user.role === 'admin'
        : user.role === 'client' && user.companyId === scope.companyId);
    if (!user || !inScope) {
      result.failure = 'notFound';
      return result;
    }
    if (intent === 'resend') {
      await sendInvitation(deps, viewer, user);
      result.notice = { key: 'admin.inviteSent', vars: { email: user.email } };
    } else if (intent === 'disable' || intent === 'enable') {
      await setUserDisabled(deps, viewer, user.id, intent === 'disable');
      result.notice = { key: intent === 'disable' ? 'admin.userDisabled' : 'admin.userEnabled' };
    } else {
      result.failure = 'invalidInput';
    }
  } catch (e) {
    result.failure = errorCode(e);
  }
  return result;
}
