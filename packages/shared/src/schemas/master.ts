import { z } from 'zod';
import {
  APPOINTMENT_STATUSES,
  BROADCAST_SEGMENTS,
  FONT_FAMILIES,
  LOYALTY_TYPES,
  THEME_BG_TYPES,
  THEME_PRESETS,
} from '../enums';
import { EVENING_REMINDER_TIMES, LIMITS, SLOT_STEPS } from '../constants';
import { toMinutes } from '../utils/time';
import {
  countryCodeSchema,
  hhmmSchema,
  httpUrlSchema,
  idSchema,
  imageUrlSchema,
  isoDateSchema,
  isoDateTimeSchema,
  latitudeSchema,
  longitudeSchema,
  moneySchema,
  nameSchema,
  optionalImageUrlSchema,
  optionalUsernameSchema,
  percentSchema,
  phoneInputSchema,
  slugSchema,
} from './common';
import { birthdaySchema } from './client';

const intervalSchema = z
  .object({ start: hhmmSchema, end: hhmmSchema })
  .refine((v) => toMinutes(v.end) > toMinutes(v.start), { error: 'validation.interval' });

export const weeklyScheduleSchema = z.object({
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(1).max(7),
        isWorking: z.boolean(),
        intervals: z.array(intervalSchema).max(4),
      }),
    )
    .max(7),
});
export type WeeklyScheduleInput = z.input<typeof weeklyScheduleSchema>;

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional().nullable(),
  imageUrl: optionalImageUrlSchema,
  price: moneySchema,
  duration: z.number().int().min(5).max(720),
  categoryId: idSchema.optional().nullable(),
  isActive: z.boolean().optional(),
});
export type ServiceCreateInput = z.input<typeof serviceCreateSchema>;
export const servicePatchSchema = serviceCreateSchema.partial();

export const reorderSchema = z.object({ ids: z.array(idSchema).min(1).max(300) });

export const firstServiceSchema = serviceCreateSchema.omit({ isActive: true });

const geoFields = {
  address: z.string().trim().max(256).optional().nullable(),
  latitude: latitudeSchema.optional().nullable(),
  longitude: longitudeSchema.optional().nullable(),
};

export const masterOnboardingStepSchema = z.object({
  step: z.number().int().min(1).max(8),
  data: z.record(z.string(), z.unknown()),
});

export const joinSalonRefSchema = z.object({ salonId: idSchema, code: z.string().min(6).max(32) });

export const masterOnboardingCompleteSchema = z.object({
  name: z.string().trim().min(2).max(64),
  slug: slugSchema,
  username: optionalUsernameSchema,
  channelUsername: optionalUsernameSchema,
  categoryIds: z.array(idSchema).min(1, { error: 'validation.categories' }).max(12),
  countryId: idSchema,
  cityId: idSchema,
  ...geoFields,
  firstService: firstServiceSchema,
  schedule: weeklyScheduleSchema.optional(),
  avatarUrl: optionalImageUrlSchema,
  themePreset: z.enum(THEME_PRESETS).optional(),
  referrerMasterId: idSchema.optional(),
  joinSalon: joinSalonRefSchema.optional(),
});
export type MasterOnboardingInput = z.input<typeof masterOnboardingCompleteSchema>;

export const masterProfilePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(64),
    slug: slugSchema,
    username: optionalUsernameSchema,
    channelUsername: optionalUsernameSchema,
    avatarUrl: optionalImageUrlSchema,
    rules: z.string().trim().max(3000).nullable(),
    countryId: idSchema,
    cityId: idSchema,
    ...geoFields,
    categoryIds: z.array(idSchema).min(1).max(12),
    autoConfirm: z.boolean(),
    allowMultiService: z.boolean(),
    postVisitMessage: z.string().trim().max(1000).nullable(),
  })
  .partial();
export type MasterProfilePatchInput = z.input<typeof masterProfilePatchSchema>;

export const settingsPatchSchema = z
  .object({
    slotStep: z
      .number()
      .int()
      .refine((v) => (SLOT_STEPS as readonly number[]).includes(v), { error: 'validation.slotStep' }),
    bufferMinutes: z.number().int().min(0).max(120),
    minLeadMinutes: z.number().int().min(0).max(2880),
    bookingHorizonDays: z.number().int().min(1).max(LIMITS.maxBookingHorizonDays),
    morningEnabled: z.boolean(),
    morningStart: hhmmSchema,
    morningEnd: hhmmSchema,
    dayEnabled: z.boolean(),
    dayStart: hhmmSchema,
    dayEnd: hhmmSchema,
    eveningEnabled: z.boolean(),
    eveningStart: hhmmSchema,
    eveningEnd: hhmmSchema,
    nightEnabled: z.boolean(),
    nightStart: hhmmSchema,
    nightEnd: hhmmSchema,
    dailyReminderEnabled: z.boolean(),
    dailyReminderTime: z.enum(EVENING_REMINDER_TIMES),
    dailyReminderSendEmpty: z.boolean(),
    morningSummaryEnabled: z.boolean(),
    slotAlertsEnabled: z.boolean(),
    onlineDurationHours: z.number().int().min(1).max(LIMITS.onlineOpenMaxHours),
  })
  .partial();
export type SettingsPatchInput = z.input<typeof settingsPatchSchema>;

export const timeBlockCreateSchema = z
  .object({
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    reason: z.string().trim().max(200).optional().nullable(),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), { error: 'validation.interval' });

export const newClientSchema = z.object({
  firstName: nameSchema,
  phone: phoneInputSchema.optional(),
  phoneCountry: countryCodeSchema.optional(),
  username: optionalUsernameSchema,
});

export const masterAppointmentCreateSchema = z
  .object({
    clientId: idSchema.optional(),
    newClient: newClientSchema.optional(),
    serviceIds: z.array(idSchema).min(1).max(LIMITS.maxServicesPerBooking),
    startAt: isoDateTimeSchema,
    comment: z.string().trim().max(1000).optional(),
    price: moneySchema.optional(),
    status: z.enum(['PENDING', 'CONFIRMED']).optional(),
    force: z.boolean().optional(),
  })
  .refine((v) => !!v.clientId || !!v.newClient, { error: 'validation.client' });
export type MasterAppointmentCreateInput = z.input<typeof masterAppointmentCreateSchema>;

export const appointmentPatchSchema = z
  .object({
    status: z.enum(APPOINTMENT_STATUSES),
    startAt: isoDateTimeSchema,
    price: moneySchema,
    clientLate: z.boolean(),
    cancelReason: z.string().trim().max(500),
  })
  .partial();
export type AppointmentPatchInput = z.input<typeof appointmentPatchSchema>;

export const appointmentPhotosSchema = z.object({
  beforePhotoUrl: optionalImageUrlSchema,
  afterPhotoUrl: optionalImageUrlSchema,
});

export const clientCreateSchema = newClientSchema.extend({
  gender: z.enum(['MALE', 'FEMALE', 'UNSPECIFIED']).optional(),
  birthday: birthdaySchema.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export const clientPatchSchema = clientCreateSchema.partial();
export type ClientPatchInput = z.input<typeof clientPatchSchema>;

export const remindClientSchema = z.object({
  text: z.string().trim().max(1000).optional(),
});

export const reviewPatchSchema = z.object({ isPublished: z.boolean() });

export const blacklistCreateSchema = z
  .object({
    username: optionalUsernameSchema,
    phone: phoneInputSchema.optional().nullable(),
    phoneCountry: countryCodeSchema.optional(),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .refine((v) => !!v.username || !!v.phone, { error: 'validation.blacklistTarget' });
export type BlacklistCreateInput = z.input<typeof blacklistCreateSchema>;

export const blockedScreenSchema = z.object({
  title: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(600),
  imageUrl: optionalImageUrlSchema,
  buttonText: z.string().trim().max(40).optional().nullable(),
  buttonUrl: httpUrlSchema.optional().nullable(),
});
export type BlockedScreenInput = z.input<typeof blockedScreenSchema>;

export const loyaltyRuleCreateSchema = z
  .object({
    type: z.enum(LOYALTY_TYPES),
    threshold: z.number().int().min(1).max(365).optional().nullable(),
    discountPct: percentSchema.max(90),
    isActive: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'EVERY_N_VISIT' && (!v.threshold || v.threshold < 2)) {
      ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'validation.thresholdN' });
    }
    if (v.type === 'CUMULATIVE' && !v.threshold) {
      ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'validation.thresholdN' });
    }
    if (v.type === 'BIRTHDAY' && v.threshold && v.threshold > 31) {
      ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'validation.birthdayWindow' });
    }
  });
export type LoyaltyRuleInput = z.input<typeof loyaltyRuleCreateSchema>;
export const loyaltyRulePatchSchema = z.object({
  threshold: z.number().int().min(1).max(365).optional().nullable(),
  discountPct: percentSchema.max(90).optional(),
  isActive: z.boolean().optional(),
});

const promotionBase = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  serviceId: idSchema.optional().nullable(),
  discountPct: percentSchema.max(90),
  validFrom: isoDateSchema,
  validTo: isoDateSchema,
  daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  timeFrom: hhmmSchema.optional().nullable(),
  timeTo: hhmmSchema.optional().nullable(),
  isActive: z.boolean().optional(),
});
export const promotionCreateSchema = promotionBase.refine((v) => v.validTo >= v.validFrom, {
  error: 'validation.interval',
});
export type PromotionInput = z.input<typeof promotionCreateSchema>;
export const promotionPatchSchema = promotionBase.partial();

export const broadcastParamsSchema = z.object({
  serviceId: idSchema.optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  ageFrom: z.number().int().min(0).max(120).optional(),
  ageTo: z.number().int().min(0).max(120).optional(),
  clientIds: z.array(idSchema).max(2000).optional(),
});

export const broadcastPreviewSchema = z.object({
  segment: z.enum(BROADCAST_SEGMENTS),
  params: broadcastParamsSchema.default({}),
});
export type BroadcastPreviewInput = z.input<typeof broadcastPreviewSchema>;

export const broadcastCreateSchema = broadcastPreviewSchema.extend({
  text: z.string().trim().min(1).max(3500),
  imageUrl: optionalImageUrlSchema,
  promotionId: idSchema.optional(),
});
export type BroadcastCreateInput = z.input<typeof broadcastCreateSchema>;

export const onlineOpenSchema = z.object({
  hours: z.number().int().min(1).max(LIMITS.onlineOpenMaxHours).optional(),
});

const colorSchema = z.string().trim().min(3).max(300);

export const themePatchSchema = z
  .object({
    bgType: z.enum(THEME_BG_TYPES),
    bgValue: z.string().trim().min(3).max(1024),
    btnBg: colorSchema,
    btnText: colorSchema,
    accent: colorSchema,
    cardBg: colorSchema,
    textColor: colorSchema,
    categoryBg: colorSchema.nullable(),
    fontFamily: z.enum(FONT_FAMILIES),
    radius: z.number().int().min(0).max(32),
    blur: z.number().int().min(0).max(40),
  })
  .partial();
export type ThemePatchInput = z.input<typeof themePatchSchema>;

export const themePresetSchema = z.object({ preset: z.enum(THEME_PRESETS) });

export const exportLinkSchema = z.object({
  entity: z.enum(['clients', 'appointments', 'all']),
});

export const imageUploadKinds = [
  'avatar',
  'service',
  'category',
  'theme',
  'blocked',
  'broadcast',
  'appointment',
  'reference',
  'review',
] as const;
export type ImageUploadKind = (typeof imageUploadKinds)[number];

export const geoSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const imageListSchema = z.array(imageUrlSchema);
