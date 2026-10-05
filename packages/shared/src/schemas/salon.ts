import { z } from 'zod';
import { THEME_PRESETS } from '../enums';
import {
  idSchema,
  latitudeSchema,
  longitudeSchema,
  optionalImageUrlSchema,
  optionalUsernameSchema,
  slugSchema,
  usernameSchema,
} from './common';
import { masterAppointmentCreateSchema } from './master';

export const salonOnboardingCompleteSchema = z.object({
  name: z.string().trim().min(2).max(64),
  slug: slugSchema,
  username: optionalUsernameSchema,
  channelUsername: optionalUsernameSchema,
  categoryIds: z.array(idSchema).min(1, { error: 'validation.categories' }).max(12),
  countryId: idSchema,
  cityId: idSchema,
  address: z.string().trim().max(256).optional().nullable(),
  latitude: latitudeSchema.optional().nullable(),
  longitude: longitudeSchema.optional().nullable(),
  avatarUrl: optionalImageUrlSchema,
  themePreset: z.enum(THEME_PRESETS).optional(),
});
export type SalonOnboardingInput = z.input<typeof salonOnboardingCompleteSchema>;

export const salonProfilePatchSchema = salonOnboardingCompleteSchema
  .omit({ themePreset: true })
  .extend({ rules: z.string().trim().max(3000).nullable() })
  .partial();
export type SalonProfilePatchInput = z.input<typeof salonProfilePatchSchema>;

export const inviteByUsernameSchema = z.object({ username: usernameSchema });

export const inviteLinkSchema = z.object({
  ttlDays: z.number().int().min(1).max(30).optional(),
});

export const inviteResponseSchema = z.object({
  salonId: idSchema,
  code: z.string().trim().min(6).max(32),
});

export const salonAppointmentCreateSchema = masterAppointmentCreateSchema.and(
  z.object({ masterId: idSchema }),
);
