import i18next, { type TFunction } from 'i18next';
import { escapeHtml, type Language } from '@nail-crm/shared';
import { resources, type Dictionary } from '@nail-crm/shared/i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Dictionary };
  }
}

const instance = i18next.createInstance();

void instance.init({
  resources,
  lng: 'ru',
  fallbackLng: 'ru',
  supportedLngs: ['ru', 'en'],
  initAsync: false,
  interpolation: {
    // Bot messages use Telegram HTML; user-provided values must be escaped.
    escapeValue: true,
    escape: escapeHtml,
  },
});

export type Translator = TFunction;

export function tr(lang: Language | string | null | undefined): Translator {
  return instance.getFixedT(lang === 'en' ? 'en' : 'ru');
}

export function langOf(value: string | null | undefined): Language {
  return value === 'en' ? 'en' : 'ru';
}
