/** Input rules shared by every form. Pages show `errors.<code>` for a failed field. */
import { LOCALES, type Locale } from './db/schema';

export type FieldErrors = Record<string, string>;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

// The most common choices that pass a 12-character minimum. Length matters far more than
// composition rules (NIST SP 800-63B), so there are no "must contain a digit" rules.
const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  'qwertyuiopas',
  'qwerty123456',
  'password1234',
  'password12345',
  'passwordpassword',
  'parola123456',
  'parolaparola',
  'administrator',
  'iloveyou1234',
  'biocetan1234',
  'biocetan2026',
  'biocetanbiocetan',
  'aaaaaaaaaaaa',
  '111111111111',
  '000000000000',
]);

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Returns an error code, or null if the password is acceptable. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN) return 'passwordTooShort';
  if (password.length > PASSWORD_MAX) return 'passwordTooLong';
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || new Set(lower).size < 4) return 'passwordCommon';
  const localPart = normalizeEmail(email).split('@')[0] ?? '';
  if (localPart.length >= 4 && lower.includes(localPart)) return 'passwordContainsEmail';
  return null;
}

export function parseLocale(value: unknown, fallback: Locale = 'ro'): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : fallback;
}

/** ISO 3166-1 alpha-2 codes (officially assigned). Names come from Intl.DisplayNames. */
export const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR ' +
  'BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ ' +
  'EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW ' +
  'GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY ' +
  'KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV ' +
  'MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY ' +
  'QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG ' +
  'TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

export function isCountryCode(value: string): boolean {
  return COUNTRY_CODES.includes(value);
}

export function countryOptions(locale: Locale): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

/** Trims and caps free text; empty becomes null. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === '' ? null : trimmed;
}
