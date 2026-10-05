export const CATEGORIES = [
  { slug: 'manicure', name: 'Маникюр', nameEn: 'Manicure', emoji: '💅' },
  { slug: 'pedicure', name: 'Педикюр', nameEn: 'Pedicure', emoji: '🦶' },
  { slug: 'makeup', name: 'Макияж', nameEn: 'Makeup', emoji: '💄' },
  { slug: 'brows', name: 'Брови', nameEn: 'Brows', emoji: '✨' },
  { slug: 'lashes', name: 'Ресницы', nameEn: 'Lashes', emoji: '👁️' },
  { slug: 'haircut', name: 'Стрижки', nameEn: 'Haircuts', emoji: '✂️' },
  { slug: 'coloring', name: 'Окрашивание', nameEn: 'Hair coloring', emoji: '🎨' },
  { slug: 'tattoo', name: 'Тату', nameEn: 'Tattoo', emoji: '🖋️' },
  { slug: 'piercing', name: 'Пирсинг', nameEn: 'Piercing', emoji: '💎' },
  { slug: 'massage', name: 'Массаж', nameEn: 'Massage', emoji: '💆' },
  { slug: 'cosmetology', name: 'Косметология', nameEn: 'Cosmetology', emoji: '🧴' },
  { slug: 'depilation', name: 'Депиляция', nameEn: 'Hair removal', emoji: '🌸' },
  { slug: 'barber', name: 'Барбер', nameEn: 'Barber', emoji: '💈' },
] as const;

import { CITIES_BY_COUNTRY } from './seedCities';

const COUNTRY_META = [
  { code: 'RU', name: 'Россия', nameEn: 'Russia' },
  { code: 'KZ', name: 'Казахстан', nameEn: 'Kazakhstan' },
  { code: 'BY', name: 'Беларусь', nameEn: 'Belarus' },
  { code: 'UZ', name: 'Узбекистан', nameEn: 'Uzbekistan' },
  { code: 'KG', name: 'Кыргызстан', nameEn: 'Kyrgyzstan' },
  { code: 'AM', name: 'Армения', nameEn: 'Armenia' },
  { code: 'GE', name: 'Грузия', nameEn: 'Georgia' },
  { code: 'RS', name: 'Сербия', nameEn: 'Serbia' },
  { code: 'TR', name: 'Турция', nameEn: 'Türkiye' },
  { code: 'AE', name: 'ОАЭ', nameEn: 'UAE' },
  { code: 'CY', name: 'Кипр', nameEn: 'Cyprus' },
] as const;

export const COUNTRIES: {
  code: string;
  name: string;
  nameEn: string;
  cities: { name: string; nameEn: string; timezone: string; lat: number; lng: number }[];
}[] = COUNTRY_META.map((country) => ({
  ...country,
  cities: (CITIES_BY_COUNTRY[country.code] ?? []).map(({ name, nameEn, timezone, lat, lng }) => ({
    name,
    nameEn,
    timezone,
    lat,
    lng,
  })),
}));
