import en from './en.json';
import ro from './ro.json';
import type { Locale } from '../server/db/schema';

type Dictionary = typeof en;

type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];

/** Every dotted key in the English dictionary, e.g. `login.title`. */
export type TranslationKey = Paths<Dictionary>;

// Typing `ro` as Dictionary makes a missing or extra key in ro.json a type error (`npm run check`).
const dictionaries: Record<Locale, Dictionary> = { en, ro };

function lookup(dictionary: unknown, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** `{name}` placeholders are replaced from `vars`; values are not HTML-escaped here. */
export function useTranslations(locale: Locale): Translate {
  return (key, vars) => {
    const value = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key);
    if (value === undefined) throw new Error(`Missing translation: ${key}`);
    return vars ? value.replace(/\{(\w+)\}/g, (m, name) => String(vars[name] ?? m)) : value;
  };
}

/** Best guess for logged-out pages: explicit choice (cookie), else the browser's languages. */
export function detectLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (cookieValue === 'ro' || cookieValue === 'en') return cookieValue;
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('ro') || first === '' ? 'ro' : 'en';
}

export const LOCALE_COOKIE = 'portal_lang';
