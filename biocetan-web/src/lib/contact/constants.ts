/**
 * Shared by the browser script, the server handler and the tests, so the two sides
 * of the contact form can never disagree about what is valid.
 */

export const PRODUCT_VALUES = [
  'rme',
  'sfme',
  'sme',
  'custom-ester',
  'custom-formulation',
  'agro-carrier',
  'mwf-e',
  'road-clean',
  'asphalt-release',
  'form-release',
  'process-solvent',
  'toll',
  'pilot',
  'logistics',
  'documentation',
  'visit',
  'other',
] as const;

export const INDUSTRY_VALUES = [
  'agrochemicals',
  'coatings',
  'lubricants',
  'metalworking',
  'cleaners',
  'polymers',
  'chemicals',
  'soil',
  'construction',
  'other',
] as const;

export const VOLUME_UNITS = ['t-month', 't-year', 'one-off'] as const;

/** Target markets first (plan §2), then the rest of Europe. `OTHER` covers everything else. */
export const COUNTRY_CODES = [
  'RO',
  'HU',
  'AT',
  'CZ',
  'SK',
  'PL',
  'DE',
  'BG',
  'BE',
  'HR',
  'CY',
  'DK',
  'EE',
  'FI',
  'FR',
  'GR',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PT',
  'SI',
  'ES',
  'SE',
  'GB',
  'CH',
  'NO',
  'RS',
  'UA',
  'MD',
  'TR',
  'BA',
  'MK',
  'AL',
  'ME',
  'OTHER',
] as const;

export const LOCALES = ['en', 'ro'] as const;

export const LIMITS = {
  name: { min: 2, max: 100 },
  company: { min: 2, max: 150 },
  email: { max: 254 },
  message: { min: 20, max: 5000 },
  phone: { min: 5, max: 30 },
  volume: { max: 100 },
  source: { max: 200 },
  utm: { max: 300 },
} as const;

export const FILE_LIMITS = {
  maxFiles: 3,
  /** Total across all attachments (plan §6). */
  maxTotalBytes: 10 * 1024 * 1024,
  extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
} as const;

export type ProductValue = (typeof PRODUCT_VALUES)[number];
export type IndustryValue = (typeof INDUSTRY_VALUES)[number];
export type VolumeUnit = (typeof VOLUME_UNITS)[number];
export type CountryCode = (typeof COUNTRY_CODES)[number];
export type ContactLocale = (typeof LOCALES)[number];
