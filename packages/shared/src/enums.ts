export const ROLES = ['OWNER', 'MASTER', 'SALON', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'UNSPECIFIED'] as const;
export type Gender = (typeof GENDERS)[number];

export const SUB_STATUSES = ['TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'BANNED'] as const;
export type SubStatus = (typeof SUB_STATUSES)[number];

export const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that occupy time in the schedule. */
export const BLOCKING_APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED'] as const;

export const PROMO_TYPES = ['DISCOUNT_PERCENT', 'FREE_DAYS'] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

export const LOYALTY_TYPES = [
  'EVERY_N_VISIT',
  'REFERRAL',
  'CUMULATIVE',
  'FIRST_VISIT',
  'BIRTHDAY',
] as const;
export type LoyaltyType = (typeof LOYALTY_TYPES)[number];

export const INVITE_STATUSES = ['pending', 'accepted', 'declined', 'expired', 'revoked'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'waiting_for_capture',
  'succeeded',
  'canceled',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DAY_PERIOD_KEYS = ['morning', 'day', 'evening', 'night'] as const;
export type DayPeriodKey = (typeof DAY_PERIOD_KEYS)[number];

export const BROADCAST_SEGMENTS = [
  'all',
  'sleeping',
  'birthday',
  'service',
  'demographic',
  'manual',
] as const;
export type BroadcastSegment = (typeof BROADCAST_SEGMENTS)[number];

export const THEME_PRESETS = ['classic', 'minimal', 'liquid_glass', 'pink', 'dark'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const THEME_BG_TYPES = ['color', 'gradient', 'image'] as const;
export type ThemeBgType = (typeof THEME_BG_TYPES)[number];

export const FONT_FAMILIES = [
  'Inter',
  'Manrope',
  'Montserrat',
  'Nunito',
  'Playfair Display',
  'Comfortaa',
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const LANGUAGES = ['ru', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const TENANT_KINDS = ['master', 'salon'] as const;
export type TenantKind = (typeof TENANT_KINDS)[number];

export const FUNNEL_EVENTS = [
  'BOT_START',
  'APP_OPEN',
  'ONBOARDING_STARTED',
  'ONBOARDING_COMPLETED',
  'FIRST_APPOINTMENT',
  'SUBSCRIBED',
  'CHURNED',
] as const;
export type FunnelEventType = (typeof FUNNEL_EVENTS)[number];

/** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];
