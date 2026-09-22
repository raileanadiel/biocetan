import en from './en.json';
import ro from './ro.json';
import { defaultLocale, type Locale } from './config';

type Dictionary = typeof en;

type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];

/** Every dotted key in the English dictionary, e.g. `nav.products`. */
export type TranslationKey = Paths<Dictionary>;

// Typing `ro` as Dictionary makes a missing/extra key in ro.json a compile error.
const dictionaries: Record<Locale, Dictionary> = { en, ro };

function lookup(dictionary: unknown, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function useTranslations(locale: Locale) {
  return (key: TranslationKey): string => {
    const value = lookup(dictionaries[locale], key) ?? lookup(dictionaries[defaultLocale], key);
    if (value === undefined) throw new Error(`Missing translation: ${key}`);
    return value;
  };
}
