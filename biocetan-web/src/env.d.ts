interface ImportMetaEnv {
  /** "true" only on the production deployment; anything else emits noindex + Disallow. */
  readonly PUBLIC_ALLOW_INDEXING?: string;
  /** Cloudflare Turnstile site key (public). Cloudflare's test key 1x00000000000000000000AA works locally. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
