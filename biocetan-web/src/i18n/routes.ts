import { defaultLocale, type Locale } from './config';

/**
 * The v1 sitemap (IMPLEMENTATION_PLAN.md §4.1). Slugs are shared by all locales.
 * A page's content lives in src/views/<Id>.astro (e.g. Home.astro); until that file
 * exists the route renders src/views/_Stub.astro.
 */
export const pages = [
  { id: 'home', slug: '' },
  { id: 'products', slug: 'products' },
  { id: 'services', slug: 'services' },
  { id: 'applications', slug: 'applications' },
  { id: 'technology', slug: 'technology' },
  { id: 'quality', slug: 'quality' },
  { id: 'facility', slug: 'facility-logistics' },
  { id: 'about', slug: 'about' },
  { id: 'contact', slug: 'contact' },
  { id: 'privacy', slug: 'privacy' },
  { id: 'terms', slug: 'terms' },
  { id: 'cookies', slug: 'cookies' },
] as const;

export type PageId = (typeof pages)[number]['id'];

/** Header links, in order. Contact is the header CTA, not a link. */
export const mainNav = [
  'products',
  'services',
  'applications',
  'technology',
  'quality',
  'facility',
  'about',
] as const satisfies readonly PageId[];

export const legalNav = ['privacy', 'terms', 'cookies'] as const satisfies readonly PageId[];

/** Site-relative URL with trailing slash: `/`, `/products/`, `/ro/products/`. */
export function pathFor(id: PageId, locale: Locale): string {
  const page = pages.find((p) => p.id === id);
  if (!page) throw new Error(`Unknown page id: ${id}`);
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${prefix}/${page.slug ? `${page.slug}/` : ''}`;
}
