import {
  validateContact,
  type ErrorCode,
  type FieldErrors,
  type RawForm,
} from '../lib/contact/validate';
import { validateFiles, type FileErrorCode } from '../lib/contact/files';

interface Messages {
  errors: Record<ErrorCode | FileErrorCode, string>;
  status: Record<string, string>;
  labels: { submit: string; sending: string; verifying: string };
  limits: Record<string, number>;
}

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance?: 'always' | 'execute' | 'interaction-only';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ): string;
  reset(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileLoader: Promise<TurnstileApi> | undefined;

/** Loaded on first interaction only, so visitors who never touch a form never contact Cloudflare. */
function loadTurnstile(): Promise<TurnstileApi> {
  turnstileLoader ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => reject(new Error('turnstile'));
    document.head.append(script);
  });
  return turnstileLoader;
}

function track(event: string, props?: Record<string, string>) {
  window.plausible?.(event, props ? { props } : undefined);
}

const FIELD_ORDER = [
  'name',
  'company',
  'email',
  'product',
  'message',
  'phone',
  'country',
  'industry',
  'volume',
  'volumeUnit',
  'files',
  'consent',
] as const;

function initForm(form: HTMLFormElement) {
  const root = form.closest<HTMLElement>('[data-contact-form-root]')!;
  const messages: Messages = JSON.parse(form.querySelector('[data-messages]')!.textContent ?? '{}');
  const siteKey = form.dataset.turnstileKey ?? '';
  const statusEl = form.querySelector<HTMLElement>('[data-status]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const submitLabel = submit.querySelector<HTMLElement>('[data-label]');
  const success = root.querySelector<HTMLElement>('[data-success]')!;
  const successText = root.querySelector<HTMLElement>('[data-success-text]')!;
  const details = form.querySelector('details');

  // --- context: source page, campaign, prefill from ?product= / ?industry= -------------------
  const params = new URLSearchParams(location.search);
  (form.elements.namedItem('source') as HTMLInputElement).value = location.pathname;
  (form.elements.namedItem('utm') as HTMLInputElement).value = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
  ]
    .map((key) => params.get(key))
    .filter(Boolean)
    .join('/');
  for (const key of ['product', 'industry'] as const) {
    const select = form.elements.namedItem(key);
    const wanted = params.get(key);
    if (
      select instanceof HTMLSelectElement &&
      wanted &&
      [...select.options].some((o) => o.value === wanted)
    ) {
      select.value = wanted;
      if (key === 'industry' && details) details.open = true;
    }
  }

  // --- Turnstile ---------------------------------------------------------------------------
  let widgetId: string | undefined;
  let token = '';
  let tokenWaiters: Array<(t: string) => void> = [];
  const gotToken = (value: string) => {
    token = value;
    tokenWaiters.splice(0).forEach((resolve) => resolve(value));
  };

  async function ensureTurnstile() {
    if (!siteKey || widgetId) return;
    try {
      const api = await loadTurnstile();
      widgetId = api.render(form.querySelector<HTMLElement>('[data-turnstile]')!, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: gotToken,
        'expired-callback': () => (token = ''),
        'error-callback': () => (token = ''),
      });
    } catch {
      /* surfaced at submit time as a captcha error */
    }
  }
  form.addEventListener('focusin', () => void ensureTurnstile(), { once: true });

  function waitForToken(ms: number): Promise<string> {
    if (token) return Promise.resolve(token);
    return new Promise((resolve) => {
      tokenWaiters.push(resolve);
      setTimeout(() => resolve(token), ms);
    });
  }

  // --- errors ------------------------------------------------------------------------------
  const wrapper = (name: string) => form.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const controlOf = (name: string) =>
    wrapper(name)?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea') ?? null;
  const errorElOf = (name: string) =>
    wrapper(name)?.querySelector<HTMLElement>('.field-error') ?? null;

  function setError(name: string, code: ErrorCode | FileErrorCode) {
    const el = errorElOf(name);
    const control = controlOf(name);
    if (!el || !control) return;
    el.textContent = messages.errors[code].replace('{min}', String(messages.limits[name] ?? ''));
    el.hidden = false;
    control.setAttribute('aria-invalid', 'true');
  }

  function clearErrors() {
    form.querySelectorAll<HTMLElement>('.field-error').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    statusEl.textContent = '';
    statusEl.classList.remove('text-danger');
  }

  function showStatus(text: string, isError = true) {
    statusEl.textContent = text;
    statusEl.classList.toggle('text-danger', isError);
  }

  function showErrors(errors: Partial<Record<string, ErrorCode | FileErrorCode>>) {
    for (const [name, code] of Object.entries(errors)) if (code) setError(name, code);
    const first = FIELD_ORDER.find((name) => errors[name]);
    if (first) {
      const control = controlOf(first);
      const inDetails = control?.closest('details');
      if (inDetails) inDetails.open = true;
      control?.focus();
    }
  }

  // Clear a field's error as soon as the visitor edits it.
  form.addEventListener('input', (event) => {
    const field = (event.target as HTMLElement).closest<HTMLElement>('[data-field]');
    const error = field?.querySelector<HTMLElement>('.field-error');
    if (error && !error.hidden) {
      error.hidden = true;
      (event.target as HTMLElement).removeAttribute('aria-invalid');
    }
  });

  // --- attachments ---------------------------------------------------------------------------
  function fileProblem(): FileErrorCode | null {
    const input = controlOf('files') as HTMLInputElement | null;
    return input?.files
      ? validateFiles([...input.files].map((f) => ({ name: f.name, size: f.size })))
      : null;
  }
  controlOf('files')?.addEventListener('change', () => {
    const problem = fileProblem();
    if (problem) setError('files', problem);
  });

  // --- submit ------------------------------------------------------------------------------
  function busy(on: boolean, label?: string) {
    submit.disabled = on;
    submit.setAttribute('aria-busy', String(on));
    if (submitLabel) submitLabel.textContent = label ?? messages.labels.submit;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();

    const data = new FormData(form);
    const raw: RawForm = {};
    for (const [key, value] of data.entries()) if (typeof value === 'string') raw[key] = value;

    const result = validateContact(raw);
    const errors: Partial<Record<string, ErrorCode | FileErrorCode>> = result.ok
      ? {}
      : { ...result.errors };
    const fileError = fileProblem();
    if (fileError) errors.files = fileError;

    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      showStatus(messages.status.validation);
      return;
    }

    busy(true, messages.labels.sending);
    try {
      if (siteKey) {
        await ensureTurnstile();
        if (!token) busy(true, messages.labels.verifying);
        const value = await waitForToken(15000);
        if (!value) {
          showStatus(messages.status.captcha);
          return;
        }
        data.set('cf-turnstile-response', value);
      }

      const response = await fetch(form.action, { method: 'POST', body: data });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        errors?: FieldErrors;
      };

      if (response.ok && body.ok) {
        track('form_submit', { product: raw.product ?? '', locale: form.dataset.locale ?? '' });
        successText.textContent = messages.status.success.replace('{email}', raw.email ?? '');
        form.hidden = true;
        success.hidden = false;
        success.focus();
        return;
      }

      // The token is single-use once redeemed; get a fresh one for the next attempt.
      if (body.code !== 'validation' && widgetId) {
        token = '';
        window.turnstile?.reset(widgetId);
      }
      if (body.code === 'validation' && body.errors) {
        showErrors(body.errors);
        showStatus(messages.status.validation);
      } else if (
        body.code === 'fileCount' ||
        body.code === 'fileSize' ||
        body.code === 'fileType'
      ) {
        showErrors({ files: body.code });
        showStatus(messages.errors[body.code]);
      } else {
        showStatus(messages.status[body.code ?? 'delivery'] ?? messages.status.delivery);
      }
    } catch {
      showStatus(messages.status.network);
    } finally {
      busy(false);
    }
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    form.reset();
    clearErrors();
    success.hidden = true;
    form.hidden = false;
    controlOf('name')?.focus();
  });

  let started = false;
  form.addEventListener('focusin', () => {
    if (!started) {
      started = true;
      track('form_start');
    }
  });
}

export function initContactForms() {
  document.querySelectorAll<HTMLFormElement>('form[data-contact-form]').forEach(initForm);
}
