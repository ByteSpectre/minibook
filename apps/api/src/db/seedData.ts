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

export const COUNTRIES: {
  code: string;
  name: string;
  nameEn: string;
  cities: { name: string; nameEn: string; timezone: string; lat: number; lng: number }[];
}[] = [
  {
    code: 'RU',
    name: 'Россия',
    nameEn: 'Russia',
    cities: [
      { name: 'Москва', nameEn: 'Moscow', timezone: 'Europe/Moscow', lat: 55.7558, lng: 37.6173 },
      {
        name: 'Санкт-Петербург',
        nameEn: 'Saint Petersburg',
        timezone: 'Europe/Moscow',
        lat: 59.9343,
        lng: 30.3351,
      },
      { name: 'Казань', nameEn: 'Kazan', timezone: 'Europe/Moscow', lat: 55.7961, lng: 49.1064 },
      {
        name: 'Нижний Новгород',
        nameEn: 'Nizhny Novgorod',
        timezone: 'Europe/Moscow',
        lat: 56.2965,
        lng: 43.9361,
      },
      {
        name: 'Краснодар',
        nameEn: 'Krasnodar',
        timezone: 'Europe/Moscow',
        lat: 45.0355,
        lng: 38.9753,
      },
      { name: 'Сочи', nameEn: 'Sochi', timezone: 'Europe/Moscow', lat: 43.5855, lng: 39.7231 },
      {
        name: 'Ростов-на-Дону',
        nameEn: 'Rostov-on-Don',
        timezone: 'Europe/Moscow',
        lat: 47.2357,
        lng: 39.7015,
      },
      { name: 'Самара', nameEn: 'Samara', timezone: 'Europe/Samara', lat: 53.1959, lng: 50.1002 },
      {
        name: 'Екатеринбург',
        nameEn: 'Yekaterinburg',
        timezone: 'Asia/Yekaterinburg',
        lat: 56.8389,
        lng: 60.6057,
      },
      {
        name: 'Новосибирск',
        nameEn: 'Novosibirsk',
        timezone: 'Asia/Novosibirsk',
        lat: 55.0084,
        lng: 82.9357,
      },
      {
        name: 'Владивосток',
        nameEn: 'Vladivostok',
        timezone: 'Asia/Vladivostok',
        lat: 43.1155,
        lng: 131.8855,
      },
    ],
  },
  {
    code: 'KZ',
    name: 'Казахстан',
    nameEn: 'Kazakhstan',
    cities: [
      { name: 'Алматы', nameEn: 'Almaty', timezone: 'Asia/Almaty', lat: 43.2389, lng: 76.8897 },
      { name: 'Астана', nameEn: 'Astana', timezone: 'Asia/Almaty', lat: 51.1694, lng: 71.4491 },
    ],
  },
  {
    code: 'BY',
    name: 'Беларусь',
    nameEn: 'Belarus',
    cities: [
      { name: 'Минск', nameEn: 'Minsk', timezone: 'Europe/Minsk', lat: 53.9006, lng: 27.559 },
    ],
  },
  {
    code: 'UZ',
    name: 'Узбекистан',
    nameEn: 'Uzbekistan',
    cities: [
      {
        name: 'Ташкент',
        nameEn: 'Tashkent',
        timezone: 'Asia/Tashkent',
        lat: 41.2995,
        lng: 69.2401,
      },
    ],
  },
  {
    code: 'KG',
    name: 'Кыргызстан',
    nameEn: 'Kyrgyzstan',
    cities: [
      { name: 'Бишкек', nameEn: 'Bishkek', timezone: 'Asia/Bishkek', lat: 42.8746, lng: 74.5698 },
    ],
  },
  {
    code: 'AM',
    name: 'Армения',
    nameEn: 'Armenia',
    cities: [
      { name: 'Ереван', nameEn: 'Yerevan', timezone: 'Asia/Yerevan', lat: 40.1792, lng: 44.4991 },
    ],
  },
  {
    code: 'GE',
    name: 'Грузия',
    nameEn: 'Georgia',
    cities: [
      { name: 'Тбилиси', nameEn: 'Tbilisi', timezone: 'Asia/Tbilisi', lat: 41.7151, lng: 44.8271 },
      { name: 'Батуми', nameEn: 'Batumi', timezone: 'Asia/Tbilisi', lat: 41.6168, lng: 41.6367 },
    ],
  },
  {
    code: 'RS',
    name: 'Сербия',
    nameEn: 'Serbia',
    cities: [
      {
        name: 'Белград',
        nameEn: 'Belgrade',
        timezone: 'Europe/Belgrade',
        lat: 44.7866,
        lng: 20.4489,
      },
    ],
  },
  {
    code: 'TR',
    name: 'Турция',
    nameEn: 'Türkiye',
    cities: [
      {
        name: 'Стамбул',
        nameEn: 'Istanbul',
        timezone: 'Europe/Istanbul',
        lat: 41.0082,
        lng: 28.9784,
      },
      {
        name: 'Анталья',
        nameEn: 'Antalya',
        timezone: 'Europe/Istanbul',
        lat: 36.8969,
        lng: 30.7133,
      },
    ],
  },
  {
    code: 'AE',
    name: 'ОАЭ',
    nameEn: 'UAE',
    cities: [
      { name: 'Дубай', nameEn: 'Dubai', timezone: 'Asia/Dubai', lat: 25.2048, lng: 55.2708 },
    ],
  },
  {
    code: 'CY',
    name: 'Кипр',
    nameEn: 'Cyprus',
    cities: [
      {
        name: 'Лимассол',
        nameEn: 'Limassol',
        timezone: 'Asia/Nicosia',
        lat: 34.7071,
        lng: 33.0226,
      },
    ],
  },
];

export const CLIENT_NAMES_F = [
  'Анна',
  'Мария',
  'Екатерина',
  'Ольга',
  'Наталья',
  'Елена',
  'Татьяна',
  'Юлия',
  'Виктория',
  'Полина',
  'Алина',
  'Дарья',
  'Ксения',
  'Софья',
  'Вероника',
  'Алёна',
];
export const CLIENT_NAMES_M = ['Андрей', 'Дмитрий', 'Максим', 'Илья', 'Артём'];
