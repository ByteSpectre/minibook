import { z } from 'zod';
import { HHMM_RE, isValidIsoDate } from '../utils/time';
import { isValidSlug, normalizeUsername, USERNAME_RE } from '../utils/text';

export const idSchema = z.string().trim().min(1).max(64);

export const hhmmSchema = z.string().regex(HHMM_RE, { error: 'validation.time' });

export const isoDateSchema = z
  .string()
  .refine((v) => isValidIsoDate(v), { error: 'validation.date' });

export const isoDateTimeSchema = z.iso.datetime({ offset: true, error: 'validation.dateTime' });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => isValidSlug(v), { error: 'validation.slug' });

/** Accepts `@name`, `name` or `t.me/name`; stores lowercase without `@`. */
export const usernameSchema = z
  .string()
  .trim()
  .transform((v) => normalizeUsername(v) ?? '')
  .refine((v) => USERNAME_RE.test(v), { error: 'validation.username' });

export const optionalUsernameSchema = z
  .string()
  .trim()
  .max(64)
  .optional()
  .nullable()
  .transform((v) => normalizeUsername(v ?? null))
  .refine((v) => v === null || USERNAME_RE.test(v), { error: 'validation.username' });

/** Raw phone input; normalized to E.164 on the server with the selected country. */
export const phoneInputSchema = z
  .string()
  .trim()
  .min(5, { error: 'validation.phone' })
  .max(32, { error: 'validation.phone' });

export const countryCodeSchema = z
  .string()
  .trim()
  .length(2)
  .transform((v) => v.toUpperCase());

/** Absolute http(s) URL or a path served by the API storage driver. */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(1024)
  .refine((v) => /^https?:\/\//.test(v) || v.startsWith('/uploads/'), {
    error: 'validation.url',
  });

export const optionalImageUrlSchema = imageUrlSchema.nullable().optional();

export const httpUrlSchema = z
  .string()
  .trim()
  .max(1024)
  .refine((v) => /^https?:\/\//.test(v) || /^tg:\/\//.test(v), { error: 'validation.url' });

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/** `?ids=a,b,c` → `['a','b','c']`. */
export const csvIdsSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v),
  z.array(idSchema).max(20),
);

export const queryBooleanSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v === 'true' || v === '1' : v),
  z.boolean(),
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const moneySchema = z.number().min(0).max(10_000_000);

export const percentSchema = z.number().int().min(1).max(100);

export const nameSchema = z.string().trim().min(1, { error: 'validation.required' }).max(64);
