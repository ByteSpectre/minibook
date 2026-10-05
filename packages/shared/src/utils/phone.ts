import {
  type CountryCode,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';

const LANGUAGE_DEFAULT_COUNTRY: Record<string, CountryCode> = {
  ru: 'RU',
  be: 'BY',
  kk: 'KZ',
  uz: 'UZ',
  ky: 'KG',
  hy: 'AM',
  ka: 'GE',
  az: 'AZ',
  uk: 'UA',
  sr: 'RS',
  tr: 'TR',
  de: 'DE',
  en: 'US',
};

export function toCountryCode(value?: string | null): CountryCode | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  return isSupportedCountry(upper) ? upper : undefined;
}

/**
 * Picks a default phone country from a locale such as `ru`, `en-GB` or `kk-KZ`.
 * Region subtags win over the language mapping.
 */
export function defaultCountryForLocale(locale?: string | null): CountryCode {
  if (!locale) return 'RU';
  const [language, region] = locale.replace('_', '-').split('-');
  const fromRegion = toCountryCode(region);
  if (fromRegion) return fromRegion;
  return LANGUAGE_DEFAULT_COUNTRY[(language ?? '').toLowerCase()] ?? 'RU';
}

/** Normalizes a phone number to E.164 (`+79991234567`). Returns `null` when invalid. */
export function normalizePhone(raw?: string | null, defaultCountry?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, toCountryCode(defaultCountry) ?? 'RU');
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function formatPhone(e164?: string | null): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

export function phoneCountryOf(e164?: string | null): CountryCode | undefined {
  if (!e164) return undefined;
  return parsePhoneNumberFromString(e164)?.country;
}

export function callingCodeOf(country: string): string {
  const code = toCountryCode(country);
  return code ? `+${getCountryCallingCode(code)}` : '';
}

/** Converts an ISO 3166-1 alpha-2 code into its emoji flag. */
export function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return '🏳️';
  const base = 0x1f1e6;
  const upper = code.toUpperCase();
  return String.fromCodePoint(base + (upper.charCodeAt(0) - 65), base + (upper.charCodeAt(1) - 65));
}
