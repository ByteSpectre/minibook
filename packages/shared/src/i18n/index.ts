import { LANGUAGES, type Language } from '../enums';
import { en } from './en';
import { ru, type Dictionary } from './ru';

export { ru, en };
export type { Dictionary };
export type { DeepDict } from './types';

export const resources = {
  ru: { translation: ru },
  en: { translation: en },
} as const;

export const DEFAULT_LANGUAGE: Language = 'ru';

/** Maps a Telegram `language_code` (e.g. `ru`, `en-US`, `uk`) to a supported UI language. */
export function detectLanguage(code?: string | null): Language {
  if (!code) return DEFAULT_LANGUAGE;
  const base = code.toLowerCase().split(/[-_]/)[0] ?? '';
  if ((LANGUAGES as readonly string[]).includes(base)) return base as Language;
  // Russian is the de-facto second language across CIS locales.
  if (['uk', 'be', 'kk', 'uz', 'ky', 'hy', 'az', 'tg', 'tk'].includes(base)) return 'ru';
  return 'en';
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function dateLocaleTag(lang: Language): string {
  return lang === 'ru' ? 'ru-RU' : 'en-GB';
}
