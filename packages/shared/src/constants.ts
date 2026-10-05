import type { DayPeriodKey, FontFamily, ThemeBgType, ThemePreset } from './enums';

export const APP_NAME = 'Glow';

/**
 * Fallback values only. The API resolves the real prices from env / platform settings /
 * A/B experiments, and the Mini App always displays what the API returns.
 */
export const BILLING_DEFAULTS = {
  masterPriceRub: 449,
  salonPriceRub: 1249,
  trialDays: 14,
  periodDays: 30,
  referralBonusDays: 14,
} as const;

export const LIMITS = {
  maxReferencePhotos: 5,
  maxReviewPhotos: 3,
  maxServicesPerBooking: 5,
  maxUploadBytes: 10 * 1024 * 1024,
  broadcastsPerDayPerMaster: 1,
  marketingMessagesPerHourPerClient: 1,
  slotAlertsPerHourPerClient: 1,
  slotAlertsPerDayPerClient: 3,
  slotAlertMinLeadMinutes: 120,
  sleepingClientDays: 60,
  onlineOpenMaxHours: 12,
  inviteTtlDays: 7,
  maxBookingHorizonDays: 120,
  searchPageSize: 20,
  mapMaxPoints: 500,
} as const;

export const SLOT_STEPS = [5, 10, 15, 20, 30, 60] as const;

export interface DayPeriodDefinition {
  key: DayPeriodKey;
  emoji: string;
  start: string;
  end: string;
}

export const DEFAULT_DAY_PERIODS: readonly DayPeriodDefinition[] = [
  { key: 'night', emoji: '🌙', start: '00:00', end: '07:00' },
  { key: 'morning', emoji: '🌅', start: '07:00', end: '12:00' },
  { key: 'day', emoji: '☀️', start: '12:00', end: '18:00' },
  { key: 'evening', emoji: '🌆', start: '18:00', end: '24:00' },
];

export const DAY_PERIOD_EMOJI: Record<DayPeriodKey, string> = {
  morning: '🌅',
  day: '☀️',
  evening: '🌆',
  night: '🌙',
};

/** Allowed evening summary times (18:00–22:00, 30-minute grid). */
export const EVENING_REMINDER_TIMES = [
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
] as const;

export interface ThemeValues {
  bgType: ThemeBgType;
  bgValue: string;
  btnBg: string;
  btnText: string;
  accent: string;
  cardBg: string;
  textColor: string;
  categoryBg: string | null;
  fontFamily: FontFamily;
  radius: number;
  blur: number;
}

export const THEME_PRESET_VALUES: Record<ThemePreset, ThemeValues> = {
  classic: {
    bgType: 'color',
    bgValue: '#f6f1ee',
    btnBg: '#1f1b1d',
    btnText: '#ffffff',
    accent: '#b4235a',
    cardBg: 'rgba(255,255,255,0.86)',
    textColor: '#1f1b1d',
    categoryBg: '#f3e6ea',
    fontFamily: 'Inter',
    radius: 14,
    blur: 0,
  },
  minimal: {
    bgType: 'color',
    bgValue: '#ffffff',
    btnBg: '#111111',
    btnText: '#ffffff',
    accent: '#111111',
    cardBg: 'rgba(244,244,245,0.95)',
    textColor: '#111111',
    categoryBg: '#f4f4f5',
    fontFamily: 'Manrope',
    radius: 8,
    blur: 0,
  },
  liquid_glass: {
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 45%, #fbc2eb 100%)',
    btnBg: 'rgba(255,255,255,0.45)',
    btnText: '#1d1d1f',
    accent: '#5b5bd6',
    cardBg: 'rgba(255,255,255,0.38)',
    textColor: '#1d1d1f',
    categoryBg: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter',
    radius: 24,
    blur: 20,
  },
  pink: {
    bgType: 'gradient',
    bgValue: 'linear-gradient(160deg, #fff0f6 0%, #ffd6e8 55%, #ffc2d9 100%)',
    btnBg: '#e5487f',
    btnText: '#ffffff',
    accent: '#e5487f',
    cardBg: 'rgba(255,255,255,0.72)',
    textColor: '#3b1a2a',
    categoryBg: '#ffe3ee',
    fontFamily: 'Nunito',
    radius: 20,
    blur: 12,
  },
  dark: {
    bgType: 'color',
    bgValue: '#0e0e12',
    btnBg: '#f4f4f6',
    btnText: '#0e0e12',
    accent: '#c19bff',
    cardBg: 'rgba(255,255,255,0.07)',
    textColor: '#f4f4f6',
    categoryBg: 'rgba(255,255,255,0.08)',
    fontFamily: 'Inter',
    radius: 16,
    blur: 14,
  },
};

export const DEFAULT_THEME_PRESET: ThemePreset = 'liquid_glass';

export const RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'blocked',
  'book',
  'booking',
  'client',
  'dev',
  'expired',
  'help',
  'join',
  'm',
  'master',
  'onboarding',
  'pay',
  'public',
  's',
  'salon',
  'search',
  'settings',
  'start',
  'support',
  'uploads',
] as const;

/** Currency by ISO country code; masters' prices are shown in the local currency. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  RU: 'RUB',
  BY: 'BYN',
  KZ: 'KZT',
  UZ: 'UZS',
  KG: 'KGS',
  AM: 'AMD',
  GE: 'GEL',
  AZ: 'AZN',
  RS: 'RSD',
  TR: 'TRY',
  AE: 'AED',
  TH: 'THB',
  ID: 'IDR',
  CY: 'EUR',
  ME: 'EUR',
  DE: 'EUR',
  US: 'USD',
  GB: 'GBP',
};

export const YOOKASSA_IP_RANGES = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11/32',
  '77.75.156.35/32',
  '77.75.154.128/25',
  '2a02:5180::/32',
] as const;
