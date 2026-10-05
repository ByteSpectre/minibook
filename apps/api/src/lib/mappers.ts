import {
  DEFAULT_THEME_PRESET,
  FONT_FAMILIES,
  THEME_BG_TYPES,
  THEME_PRESET_VALUES,
  THEME_PRESETS,
  toIsoDate,
  type AppointmentStatus,
  type BlockedScreenDto,
  type CategoryDto,
  type ClientAppointmentDto,
  type FontFamily,
  type LoyaltyRuleDto,
  type MasterAppointmentDto,
  type PromotionDto,
  type ReviewDto,
  type ServiceDto,
  type ThemeBgType,
  type ThemeDto,
  type ThemePreset,
} from '@nail-crm/shared';
import type { Prisma } from '../db/prisma';

type Decimalish = Prisma.Decimal | number | string | null | undefined;

export const num = (v: Decimalish): number => (v === null || v === undefined ? 0 : Number(v));
export const numOrNull = (v: Decimalish): number | null =>
  v === null || v === undefined ? null : Number(v);
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoDate = (d: Date | null | undefined): string | null => (d ? toIsoDate(d) : null);

export function toCategoryDto(c: {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  emoji: string | null;
  imageUrl: string | null;
}): CategoryDto {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameEn: c.nameEn,
    emoji: c.emoji,
    imageUrl: c.imageUrl,
  };
}

export function toServiceDto(s: {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: Decimalish;
  duration: number;
  categoryId: string | null;
  isActive: boolean;
  sortOrder: number;
}): ServiceDto {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    imageUrl: s.imageUrl,
    price: num(s.price),
    duration: s.duration,
    categoryId: s.categoryId,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
  };
}

interface ThemeRow {
  bgType: string;
  bgValue: string;
  btnBg: string;
  btnText: string;
  accent: string;
  cardBg: string;
  textColor: string;
  categoryBg: string | null;
  fontFamily: string;
  radius: number;
  blur: number;
  preset: string | null;
}

export function toThemeDto(t: ThemeRow | null | undefined): ThemeDto {
  if (!t) return { ...THEME_PRESET_VALUES[DEFAULT_THEME_PRESET], preset: DEFAULT_THEME_PRESET };
  const preset = (THEME_PRESETS as readonly string[]).includes(t.preset ?? '')
    ? (t.preset as ThemePreset)
    : null;
  return {
    bgType: (THEME_BG_TYPES as readonly string[]).includes(t.bgType)
      ? (t.bgType as ThemeBgType)
      : 'color',
    bgValue: t.bgValue,
    btnBg: t.btnBg,
    btnText: t.btnText,
    accent: t.accent,
    cardBg: t.cardBg,
    textColor: t.textColor,
    categoryBg: t.categoryBg,
    fontFamily: (FONT_FAMILIES as readonly string[]).includes(t.fontFamily)
      ? (t.fontFamily as FontFamily)
      : 'Inter',
    radius: t.radius,
    blur: t.blur,
    preset,
  };
}

export function themeDataForPreset(preset: ThemePreset) {
  const v = THEME_PRESET_VALUES[preset];
  return { ...v, preset };
}

export function toPromotionDto(p: {
  id: string;
  title: string;
  description: string | null;
  serviceId: string | null;
  discountPct: number;
  validFrom: Date;
  validTo: Date;
  daysOfWeek: number[];
  timeFrom: string | null;
  timeTo: string | null;
  isActive: boolean;
  service?: { name: string } | null;
}): PromotionDto {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    serviceId: p.serviceId,
    serviceName: p.service?.name ?? null,
    discountPct: p.discountPct,
    validFrom: p.validFrom.toISOString(),
    validTo: p.validTo.toISOString(),
    daysOfWeek: p.daysOfWeek,
    timeFrom: p.timeFrom,
    timeTo: p.timeTo,
    isActive: p.isActive,
  };
}

export function toReviewDto(r: {
  id: string;
  clientName: string;
  rating: number;
  comment: string | null;
  photos: string[];
  isPublished: boolean;
  createdAt: Date;
  appointmentId: string | null;
}): ReviewDto {
  return {
    id: r.id,
    clientName: r.clientName,
    rating: r.rating,
    comment: r.comment,
    photos: r.photos,
    isPublished: r.isPublished,
    createdAt: r.createdAt.toISOString(),
    appointmentId: r.appointmentId,
  };
}

export function toLoyaltyRuleDto(r: {
  id: string;
  type: LoyaltyRuleDto['type'];
  threshold: number | null;
  discountPct: number;
  isActive: boolean;
}): LoyaltyRuleDto {
  return {
    id: r.id,
    type: r.type,
    threshold: r.threshold,
    discountPct: r.discountPct,
    isActive: r.isActive,
  };
}

export const DEFAULT_BLOCKED_SCREEN: BlockedScreenDto = {
  title: 'Запись недоступна',
  text: 'К сожалению, вы не можете записаться к этому мастеру.',
  imageUrl: null,
  buttonText: null,
  buttonUrl: null,
};

export function toBlockedScreenDto(
  b: {
    title: string;
    text: string;
    imageUrl: string | null;
    buttonText: string | null;
    buttonUrl: string | null;
  } | null,
): BlockedScreenDto {
  if (!b) return DEFAULT_BLOCKED_SCREEN;
  return {
    title: b.title,
    text: b.text,
    imageUrl: b.imageUrl,
    buttonText: b.buttonText,
    buttonUrl: b.buttonUrl,
  };
}

export const appointmentInclude = {
  services: true,
  client: {
    select: { id: true, firstName: true, phone: true, username: true, visitsCount: true },
  },
  master: { select: { id: true, name: true } },
} as const;

export interface AppointmentWithRelations {
  id: string;
  masterId: string;
  status: AppointmentStatus;
  startAt: Date;
  endAt: Date;
  price: Decimalish;
  originalPrice: Decimalish;
  discountPct: number | null;
  discountSource: string | null;
  clientComment: string | null;
  photos: string[];
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  clientConfirmedAt: Date | null;
  clientLate: boolean;
  createdBy: string;
  createdAt: Date;
  services: { id: string; serviceId: string; name: string; price: Decimalish; duration: number }[];
  client: {
    id: string;
    firstName: string | null;
    phone: string | null;
    username: string | null;
    visitsCount: number;
  };
  master: { id: string; name: string };
}

export function toMasterAppointmentDto(a: AppointmentWithRelations): MasterAppointmentDto {
  return {
    id: a.id,
    masterId: a.masterId,
    masterName: a.master.name,
    status: a.status,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    client: {
      id: a.client.id,
      firstName: a.client.firstName,
      phone: a.client.phone,
      username: a.client.username,
      visitsCount: a.client.visitsCount,
      isNew: a.client.visitsCount === 0,
    },
    services: a.services.map((s) => ({
      id: s.id,
      serviceId: s.serviceId,
      name: s.name,
      price: num(s.price),
      duration: s.duration,
    })),
    price: numOrNull(a.price),
    originalPrice: numOrNull(a.originalPrice),
    discountPct: a.discountPct,
    discountSource: a.discountSource,
    clientComment: a.clientComment,
    photos: a.photos,
    beforePhotoUrl: a.beforePhotoUrl,
    afterPhotoUrl: a.afterPhotoUrl,
    clientConfirmedAt: iso(a.clientConfirmedAt),
    clientLate: a.clientLate,
    createdBy: a.createdBy,
    createdAt: a.createdAt.toISOString(),
  };
}

export const clientAppointmentInclude = {
  services: true,
  review: true,
  master: {
    select: {
      id: true,
      slug: true,
      name: true,
      avatarUrl: true,
      address: true,
      latitude: true,
      longitude: true,
      username: true,
      timezone: true,
      currency: true,
    },
  },
} as const;

export interface ClientAppointmentRow {
  id: string;
  status: AppointmentStatus;
  startAt: Date;
  endAt: Date;
  price: Decimalish;
  originalPrice: Decimalish;
  discountPct: number | null;
  clientComment: string | null;
  photos: string[];
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  clientConfirmedAt: Date | null;
  services: { id: string; serviceId: string; name: string; price: Decimalish; duration: number }[];
  review: Parameters<typeof toReviewDto>[0] | null;
  master: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    username: string | null;
    timezone: string;
    currency: string;
  };
}

export function toClientAppointmentDto(
  a: ClientAppointmentRow,
  now: Date = new Date(),
): ClientAppointmentDto {
  const upcoming = a.startAt > now && (a.status === 'PENDING' || a.status === 'CONFIRMED');
  return {
    id: a.id,
    status: a.status,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    timezone: a.master.timezone,
    currency: a.master.currency,
    master: {
      id: a.master.id,
      slug: a.master.slug,
      name: a.master.name,
      avatarUrl: a.master.avatarUrl,
      address: a.master.address,
      latitude: a.master.latitude,
      longitude: a.master.longitude,
      username: a.master.username,
    },
    services: a.services.map((s) => ({
      id: s.id,
      serviceId: s.serviceId,
      name: s.name,
      price: num(s.price),
      duration: s.duration,
    })),
    price: numOrNull(a.price),
    originalPrice: numOrNull(a.originalPrice),
    discountPct: a.discountPct,
    comment: a.clientComment,
    photos: a.photos,
    beforePhotoUrl: a.beforePhotoUrl,
    afterPhotoUrl: a.afterPhotoUrl,
    clientConfirmedAt: iso(a.clientConfirmedAt),
    canCancel: upcoming,
    canReschedule: upcoming,
    canReview: a.status === 'COMPLETED' && !a.review,
    canRepeat:
      a.status === 'COMPLETED' || a.status === 'CANCELLED' || a.status === 'NO_SHOW' || !upcoming,
    review: a.review ? toReviewDto(a.review) : null,
  };
}
