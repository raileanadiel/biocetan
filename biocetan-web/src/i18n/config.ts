/** Keep `locales` in sync with the `i18n` block in astro.config.mjs. */
export const locales = ['en', 'ro'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeMeta: Record<
  Locale,
  { label: string; name: string; hreflang: string; ogLocale: string }
> = {
  en: { label: 'EN', name: 'English', hreflang: 'en', ogLocale: 'en_GB' },
  ro: { label: 'RO', name: 'Română', hreflang: 'ro', ogLocale: 'ro_RO' },
};
