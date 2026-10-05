import { z } from 'zod';
import { PROMO_TYPES } from '../enums';
import { idSchema, isoDateSchema, optionalImageUrlSchema, slugSchema } from './common';

const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const categoryUpsertSchema = z.object({
  name: z.string().trim().min(1).max(64),
  nameEn: z.string().trim().max(64).optional().nullable(),
  slug: slugSchema,
  emoji: z.string().trim().max(8).optional().nullable(),
  imageUrl: optionalImageUrlSchema,
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});
export type CategoryUpsertInput = z.input<typeof categoryUpsertSchema>;

export const countryUpsertSchema = z.object({
  name: z.string().trim().min(1).max(64),
  nameEn: z.string().trim().max(64).optional().nullable(),
  code: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase()),
  flag: z.string().trim().max(8).optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});
export type CountryUpsertInput = z.input<typeof countryUpsertSchema>;

export const cityUpsertSchema = z.object({
  name: z.string().trim().min(1).max(64),
  nameEn: z.string().trim().max(64).optional().nullable(),
  countryId: idSchema,
  timezone: z.string().trim().refine(isValidTimezone, { error: 'validation.timezone' }),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});
export type CityUpsertInput = z.input<typeof cityUpsertSchema>;

export const promoCodeUpsertSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9_-]+$/.test(v), { error: 'validation.promoCode' }),
    type: z.enum(PROMO_TYPES),
    value: z.number().int().min(1).max(365),
    maxUsages: z.number().int().min(1).max(1_000_000).optional().nullable(),
    expiresAt: isoDateSchema.optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.type !== 'DISCOUNT_PERCENT' || v.value <= 100, {
    error: 'validation.percent',
    path: ['value'],
  });
export type PromoCodeUpsertInput = z.input<typeof promoCodeUpsertSchema>;

export const experimentVariantSchema = z.object({
  priceRub: z.number().int().min(1).max(100000).optional(),
  paywallTitle: z.string().trim().max(120).optional(),
  paywallText: z.string().trim().max(600).optional(),
});
export type ExperimentVariant = z.infer<typeof experimentVariantSchema>;

export const experimentUpsertSchema = z.object({
  name: z.string().trim().min(2).max(80),
  hypothesis: z.string().trim().max(1000).optional().nullable(),
  variantA: experimentVariantSchema,
  variantB: experimentVariantSchema,
  splitPercent: z.number().int().min(0).max(100).default(50),
  isActive: z.boolean().optional(),
});
export type ExperimentUpsertInput = z.input<typeof experimentUpsertSchema>;

export const tenantActionSchema = z
  .object({
    action: z.enum(['ban', 'unban', 'extend']),
    reason: z.string().trim().max(300).optional(),
    days: z.number().int().min(1).max(3650).optional(),
  })
  .refine((v) => v.action !== 'extend' || !!v.days, { error: 'validation.days', path: ['days'] });
export type TenantActionInput = z.input<typeof tenantActionSchema>;

export const platformSettingsPatchSchema = z
  .object({
    masterPriceRub: z.number().int().min(1).max(100000),
    salonPriceRub: z.number().int().min(1).max(100000),
    trialDays: z.number().int().min(0).max(90),
    referralBonusDays: z.number().int().min(0).max(90),
    weeklyDigestEnabled: z.boolean(),
  })
  .partial();
export type PlatformSettingsPatchInput = z.input<typeof platformSettingsPatchSchema>;

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(64).optional(),
  status: z.enum(['TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'BANNED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
