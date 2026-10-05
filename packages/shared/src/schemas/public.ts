import { z } from 'zod';
import { LIMITS } from '../constants';
import {
  countryCodeSchema,
  csvIdsSchema,
  idSchema,
  imageUrlSchema,
  isoDateSchema,
  isoDateTimeSchema,
  latitudeSchema,
  longitudeSchema,
  nameSchema,
  optionalUsernameSchema,
  paginationSchema,
  phoneInputSchema,
  queryBooleanSchema,
} from './common';

export const searchQuerySchema = paginationSchema.extend({
  categoryIds: csvIdsSchema.optional(),
  countryId: idSchema.optional(),
  cityId: idSchema.optional(),
  onlineNow: queryBooleanSchema.optional(),
  q: z.string().trim().max(64).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const mapQuerySchema = searchQuerySchema.omit({ page: true, pageSize: true });
export type MapQuery = z.infer<typeof mapQuerySchema>;

export const slotsQuerySchema = z.object({
  serviceIds: csvIdsSchema.pipe(z.array(idSchema).min(1).max(LIMITS.maxServicesPerBooking)),
  date: isoDateSchema,
});

export const availabilityQuerySchema = z.object({
  serviceIds: csvIdsSchema.pipe(z.array(idSchema).min(1).max(LIMITS.maxServicesPerBooking)),
  from: isoDateSchema,
  days: z.coerce.number().int().min(1).max(62).default(42),
});

export const quoteSchema = z.object({
  serviceIds: z.array(idSchema).min(1).max(LIMITS.maxServicesPerBooking),
  startAt: isoDateTimeSchema.optional(),
  referrerClientId: idSchema.optional(),
});
export type QuoteInput = z.input<typeof quoteSchema>;

export const bookingContactSchema = z.object({
  firstName: nameSchema,
  phone: phoneInputSchema,
  phoneCountry: countryCodeSchema.optional(),
  username: optionalUsernameSchema,
});
export type BookingContactInput = z.input<typeof bookingContactSchema>;

export const bookingCreateSchema = z.object({
  serviceIds: z.array(idSchema).min(1).max(LIMITS.maxServicesPerBooking),
  startAt: isoDateTimeSchema,
  comment: z.string().trim().max(1000).optional(),
  photos: z.array(imageUrlSchema).max(LIMITS.maxReferencePhotos).default([]),
  contact: bookingContactSchema,
  referrerClientId: idSchema.optional(),
});
export type BookingCreateInput = z.input<typeof bookingCreateSchema>;

export const geoPointSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
