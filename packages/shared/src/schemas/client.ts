import { z } from 'zod';
import { LANGUAGES } from '../enums';
import { ageFromBirthday } from '../utils/time';
import {
  countryCodeSchema,
  idSchema,
  imageUrlSchema,
  isoDateSchema,
  isoDateTimeSchema,
  nameSchema,
  optionalImageUrlSchema,
  optionalUsernameSchema,
  phoneInputSchema,
} from './common';

export const authInitSchema = z.object({
  initData: z.string().min(1).max(8192),
});

export const devLoginSchema = z.object({
  telegramId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  firstName: z.string().max(64).optional(),
  lastName: z.string().max(64).optional(),
  username: z.string().max(64).optional(),
  languageCode: z.string().max(10).optional(),
  photoUrl: z.string().max(1024).optional(),
});

export const birthdaySchema = isoDateSchema.refine(
  (v) => {
    const age = ageFromBirthday(v);
    return age >= 7 && age <= 110;
  },
  { error: 'validation.birthday' },
);

export const clientOnboardingSchema = z.object({
  firstName: nameSchema,
  gender: z.enum(['MALE', 'FEMALE'], { error: 'validation.gender' }),
  birthday: birthdaySchema,
  phone: phoneInputSchema,
  phoneCountry: countryCodeSchema,
  username: optionalUsernameSchema,
  language: z.enum(LANGUAGES).optional(),
});
export type ClientOnboardingInput = z.input<typeof clientOnboardingSchema>;

export const clientProfilePatchSchema = z
  .object({
    firstName: nameSchema,
    gender: z.enum(['MALE', 'FEMALE', 'UNSPECIFIED']),
    birthday: birthdaySchema,
    phone: phoneInputSchema,
    phoneCountry: countryCodeSchema,
    username: optionalUsernameSchema,
    avatarUrl: optionalImageUrlSchema,
    slotAlertsEnabled: z.boolean(),
    broadcastEnabled: z.boolean(),
    language: z.enum(LANGUAGES),
  })
  .partial();
export type ClientProfilePatchInput = z.input<typeof clientProfilePatchSchema>;

export const languagePatchSchema = z.object({ language: z.enum(LANGUAGES) });

export const myMasterPatchSchema = z.object({
  notificationsEnabled: z.boolean(),
});

export const clientRescheduleSchema = z.object({ startAt: isoDateTimeSchema });

export const clientCancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  photos: z.array(imageUrlSchema).max(3).default([]),
});
export type ReviewCreateInput = z.input<typeof reviewCreateSchema>;

export const repeatAppointmentSchema = z.object({
  startAt: isoDateTimeSchema.optional(),
});

export const confirmVisitSchema = z.object({ appointmentId: idSchema });
