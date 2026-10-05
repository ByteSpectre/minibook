import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import type { Language } from '@nail-crm/shared';
import { detectLanguage, resources, type Dictionary } from '@nail-crm/shared/i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Dictionary };
  }
}

const STORAGE_KEY = 'glow.language';

export function initialLanguage(telegramLanguage?: string | null): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ru' || stored === 'en') return stored;
  const fallback = (import.meta.env.VITE_DEFAULT_LANGUAGE as string | undefined) ?? 'ru';
  return detectLanguage(telegramLanguage ?? navigator.language ?? fallback);
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: 'ru',
  supportedLngs: ['ru', 'en'],
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function setLanguage(lang: Language): void {
  localStorage.setItem(STORAGE_KEY, lang);
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

/** Built-in Zod issues are localized; custom ones carry an i18n key (`validation.*`). */
z.config({
  customError: (issue) => {
    const t = i18n.t.bind(i18n);
    switch (issue.code) {
      case 'too_small':
        if (issue.origin === 'string') {
          return Number(issue.minimum) <= 1
            ? t('validation.required')
            : t('validation.tooShort', { min: Number(issue.minimum) });
        }
        if (issue.origin === 'array')
          return t('validation.minItems', { min: Number(issue.minimum) });
        return t('validation.tooSmall', { min: Number(issue.minimum) });
      case 'too_big':
        if (issue.origin === 'string')
          return t('validation.tooLong', { max: Number(issue.maximum) });
        return t('validation.tooBig', { max: Number(issue.maximum) });
      case 'invalid_type':
        return issue.input === undefined || issue.input === null || issue.input === ''
          ? t('validation.required')
          : t('validation.invalid');
      default:
        return undefined;
    }
  },
});

/** Translates `validation.*` keys produced by shared schemas. */
export function errorText(message?: string): string | undefined {
  if (!message) return undefined;
  return message.startsWith('validation.') || message.startsWith('errors.')
    ? (i18n.t(message as 'validation.invalid') as string)
    : message;
}

export default i18n;
