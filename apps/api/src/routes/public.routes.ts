import { z } from 'zod';
import {
  availabilityQuerySchema,
  bookingCreateSchema,
  paginationSchema,
  quoteSchema,
  slotsQuerySchema,
} from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { NotFoundError } from '../lib/errors';
import { defineRouter, handle, slugParams } from '../lib/http';
import { authenticate, getAuth, requireClientProfile } from '../middleware/auth';
import { loadUserAtMaster } from '../services/blacklist.service';
import { createClientBooking } from '../services/booking.service';
import { computeQuote } from '../services/pricing.service';
import {
  checkAccess,
  getPublicPage,
  getPublicReviews,
  requirePublicMaster,
} from '../services/public.service';
import { getAvailability, getDaySlots } from '../services/slots.service';
import { storeImage, uploadMiddleware } from '../services/storage.service';

export const publicRoutes = defineRouter('/api/public');
publicRoutes.use(authenticate);

const uploadQuery = z.object({
  kind: z.enum(['reference', 'review', 'avatar']).default('reference'),
});

publicRoutes.post(
  '/upload',
  uploadMiddleware,
  handle({ query: uploadQuery, status: 201 }, async ({ req, query }) =>
    storeImage(req.file, query.kind, `u-${getAuth(req).userId}`),
  ),
);

publicRoutes.get(
  '/:slug',
  handle({ params: slugParams }, async ({ req, params }) =>
    getPublicPage(params.slug, getAuth(req).userId),
  ),
);

publicRoutes.get(
  '/:slug/reviews',
  handle({ params: slugParams, query: paginationSchema }, async ({ params, query }) =>
    getPublicReviews(params.slug, query.page, query.pageSize),
  ),
);

publicRoutes.get(
  '/:slug/slots',
  handle({ params: slugParams, query: slotsQuerySchema }, async ({ req, params, query }) => {
    const master = await requirePublicMaster(params.slug, getAuth(req).userId);
    return (await getDaySlots(master.id, query.serviceIds, query.date)).response;
  }),
);

publicRoutes.get(
  '/:slug/availability',
  handle({ params: slugParams, query: availabilityQuerySchema }, async ({ req, params, query }) => {
    const master = await requirePublicMaster(params.slug, getAuth(req).userId);
    return getAvailability(master.id, query.serviceIds, query.from, query.days);
  }),
);

publicRoutes.post(
  '/:slug/check-access',
  handle({ params: slugParams }, async ({ req, params }) =>
    checkAccess(params.slug, getAuth(req).userId),
  ),
);

publicRoutes.post(
  '/:slug/quote',
  handle({ params: slugParams, body: quoteSchema }, async ({ req, params, body }) => {
    const userId = getAuth(req).userId;
    const master = await requirePublicMaster(params.slug, userId);
    const ctx = await loadUserAtMaster(userId, master.id);
    const quote = await computeQuote(
      master.id,
      body.serviceIds,
      body.startAt ? new Date(body.startAt) : null,
      {
        clientId: ctx.client?.id ?? null,
        birthday: ctx.client?.birthday ?? ctx.profile?.birthday ?? null,
        referrerClientId: ctx.client ? null : (body.referrerClientId ?? null),
      },
    );
    const { services: _services, discountSourceKey: _key, ...response } = quote;
    return response;
  }),
);

publicRoutes.post(
  '/:slug/appointments',
  requireClientProfile,
  handle(
    { params: slugParams, body: bookingCreateSchema, status: 201 },
    async ({ req, params, body }) => {
      const exists = await prisma.master.count({ where: { slug: params.slug } });
      if (!exists) throw new NotFoundError();
      return createClientBooking(getAuth(req).userId, params.slug, body);
    },
  ),
);
