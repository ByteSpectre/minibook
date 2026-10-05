import { z } from 'zod';
import {
  applyPromoSchema,
  appointmentPatchSchema,
  APPOINTMENT_STATUSES,
  autoRenewSchema,
  broadcastCreateSchema,
  broadcastPreviewSchema,
  clientPatchSchema,
  createPaymentSchema,
  idSchema,
  imageUploadKinds,
  inviteByUsernameSchema,
  inviteLinkSchema,
  isoDateSchema,
  isoDateTimeSchema,
  masterAppointmentCreateSchema,
  masterOnboardingStepSchema,
  paginationSchema,
  promotionCreateSchema,
  promotionPatchSchema,
  remindClientSchema,
  salonOnboardingCompleteSchema,
  salonProfilePatchSchema,
  themePatchSchema,
  themePresetSchema,
} from '@nail-crm/shared';
import { forMaster } from '../db/tenant';
import { NotFoundError } from '../lib/errors';
import { defineRouter, handle, idParams, masterIdParams } from '../lib/http';
import { authenticate, getAuth, getSalon, requireSalon } from '../middleware/auth';
import {
  cancelSubscription,
  createSubscriptionPayment,
  getSubscription,
  listPayments,
  setAutoRenew,
} from '../services/billing/billing.service';
import { applyPromoCode } from '../services/billing/promo.service';
import { getAnalytics, getDashboard } from '../services/master/analytics.service';
import {
  createAppointmentByStaff,
  getAppointment,
  listAppointments,
  patchAppointment,
} from '../services/master/appointments.service';
import {
  getClientDetail,
  listClients,
  patchClient,
  remindClient,
} from '../services/master/clients.service';
import {
  createPromotion,
  deletePromotion,
  listBroadcasts,
  listPromotions,
  patchPromotion,
  previewBroadcast,
  sendBroadcast,
} from '../services/master/marketing.service';
import { listReviews } from '../services/master/moderation.service';
import {
  getOnboardingDraft,
  isSlugAvailable,
  saveOnboardingDraft,
} from '../services/master/onboarding.service';
import { getScheduleDay, getScheduleOverview } from '../services/master/schedule.service';
import {
  createInviteLink,
  inviteByUsername,
  listInvites,
  listSalonMasters,
  removeMasterFromSalon,
  revokeInvite,
} from '../services/salon/membership.service';
import {
  applySalonThemePreset,
  completeSalonOnboarding,
  getSalonProfile,
  getSalonTheme,
  listSalonServices,
  patchSalonProfile,
  patchSalonTheme,
} from '../services/salon/salon.service';
import { salonScope } from '../services/scope';
import { storeImage, uploadMiddleware } from '../services/storage.service';

export const salonRoutes = defineRouter('/api/salon');
salonRoutes.use(authenticate);

/** Salon-wide actions on behalf of one master require that master to be in the salon. */
function scopedMaster(req: Parameters<typeof getSalon>[0], masterId: string) {
  const t = getSalon(req);
  if (!t.masterIds.includes(masterId)) throw new NotFoundError();
  return t;
}

/* ───────────── Onboarding ───────────── */

salonRoutes.get(
  '/onboarding/draft',
  handle(
    {},
    async ({ req }) =>
      (await getOnboardingDraft(getAuth(req).userId, 'SALON')) ?? { step: 1, data: {} },
  ),
);
salonRoutes.post(
  '/onboarding/step',
  handle({ body: masterOnboardingStepSchema }, ({ req, body }) =>
    saveOnboardingDraft(getAuth(req).userId, 'SALON', body.step, body.data),
  ),
);
salonRoutes.get(
  '/onboarding/slug-check',
  handle(
    { query: z.object({ slug: z.string().trim().toLowerCase().min(1).max(64) }) },
    async ({ req, query }) => ({
      slug: query.slug,
      available: await isSlugAvailable(
        query.slug,
        getAuth(req).salonId ? { salonId: getAuth(req).salonId! } : undefined,
      ),
    }),
  ),
);
salonRoutes.post(
  '/onboarding/complete',
  handle({ body: salonOnboardingCompleteSchema, status: 201 }, ({ req, body }) =>
    completeSalonOnboarding(getAuth(req).userId, body),
  ),
);

/* ───────────── Profile & theme ───────────── */

salonRoutes.get(
  '/profile',
  requireSalon('any'),
  handle({}, ({ req }) => getSalonProfile(getSalon(req))),
);
salonRoutes.patch(
  '/profile',
  requireSalon('write'),
  handle({ body: salonProfilePatchSchema }, ({ req, body }) =>
    patchSalonProfile(getSalon(req), body),
  ),
);
salonRoutes.get(
  '/theme',
  requireSalon('read'),
  handle({}, ({ req }) => getSalonTheme(getSalon(req))),
);
salonRoutes.patch(
  '/theme',
  requireSalon('write'),
  handle({ body: themePatchSchema }, ({ req, body }) => patchSalonTheme(getSalon(req), body)),
);
salonRoutes.post(
  '/theme/preset',
  requireSalon('write'),
  handle({ body: themePresetSchema }, ({ req, body }) =>
    applySalonThemePreset(getSalon(req), body.preset),
  ),
);
salonRoutes.post(
  '/upload',
  requireSalon('write'),
  uploadMiddleware,
  handle(
    { query: z.object({ kind: z.enum(imageUploadKinds).default('avatar') }), status: 201 },
    ({ req, query }) => storeImage(req.file, query.kind, `s-${getSalon(req).salonId}`),
  ),
);

/* ───────────── Masters & invites ───────────── */

salonRoutes.get(
  '/masters',
  requireSalon('read'),
  handle({}, ({ req }) => listSalonMasters(getSalon(req))),
);
salonRoutes.post(
  '/masters/invite-by-username',
  requireSalon('write'),
  handle({ body: inviteByUsernameSchema, status: 201 }, ({ req, body }) =>
    inviteByUsername(getSalon(req), body.username),
  ),
);
salonRoutes.post(
  '/masters/invite-link',
  requireSalon('write'),
  handle({ body: inviteLinkSchema, status: 201 }, ({ req, body }) =>
    createInviteLink(getSalon(req), body.ttlDays),
  ),
);
salonRoutes.delete(
  '/masters/:masterId',
  requireSalon('any'),
  handle({ params: masterIdParams }, async ({ req, params }) => {
    await removeMasterFromSalon(getSalon(req), params.masterId);
    return { ok: true };
  }),
);
salonRoutes.get(
  '/masters/:masterId/schedule',
  requireSalon('read'),
  handle(
    { params: masterIdParams, query: z.object({ date: isoDateSchema }) },
    ({ req, params, query }) => {
      const t = scopedMaster(req, params.masterId);
      return getScheduleDay(salonScope(t), query.date, params.masterId);
    },
  ),
);
salonRoutes.get(
  '/invites',
  requireSalon('read'),
  handle({}, ({ req }) => listInvites(getSalon(req))),
);
salonRoutes.delete(
  '/invites/:id',
  requireSalon('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await revokeInvite(getSalon(req), params.id);
    return { ok: true };
  }),
);

/* ───────────── Subscription ───────────── */

salonRoutes.get(
  '/subscription',
  requireSalon('any'),
  handle({}, ({ req }) => getSubscription('salon', getSalon(req).salonId)),
);
salonRoutes.post(
  '/subscription/create-payment',
  requireSalon('any'),
  handle({ body: createPaymentSchema }, ({ req, body }) =>
    createSubscriptionPayment('salon', getSalon(req).salonId, { autoRenew: body.autoRenew }),
  ),
);
salonRoutes.post(
  '/subscription/cancel',
  requireSalon('any'),
  handle({}, ({ req }) => cancelSubscription('salon', getSalon(req).salonId)),
);
salonRoutes.post(
  '/subscription/auto-renew',
  requireSalon('any'),
  handle({ body: autoRenewSchema }, ({ req, body }) =>
    setAutoRenew('salon', getSalon(req).salonId, body.enabled),
  ),
);
salonRoutes.post(
  '/subscription/apply-promo',
  requireSalon('any'),
  handle({ body: applyPromoSchema }, ({ req, body }) =>
    applyPromoCode('salon', getSalon(req).salonId, body.code),
  ),
);
salonRoutes.get(
  '/subscription/payments',
  requireSalon('any'),
  handle({}, ({ req }) => listPayments('salon', getSalon(req).salonId)),
);

/* ───────────── Shared schedule, appointments & clients ───────────── */

const masterFilter = z.object({ masterId: idSchema.optional() });

salonRoutes.get(
  '/schedule/day',
  requireSalon('read'),
  handle({ query: masterFilter.extend({ date: isoDateSchema }) }, ({ req, query }) =>
    getScheduleDay(salonScope(getSalon(req)), query.date, query.masterId),
  ),
);
salonRoutes.get(
  '/schedule/overview',
  requireSalon('read'),
  handle(
    {
      query: masterFilter.extend({
        from: isoDateSchema,
        days: z.coerce.number().int().min(1).max(62).default(42),
      }),
    },
    ({ req, query }) =>
      getScheduleOverview(salonScope(getSalon(req)), query.from, query.days, query.masterId),
  ),
);
salonRoutes.get(
  '/appointments',
  requireSalon('read'),
  handle(
    {
      query: masterFilter.extend({
        from: isoDateTimeSchema.optional(),
        to: isoDateTimeSchema.optional(),
        status: z.enum(APPOINTMENT_STATUSES).optional(),
        clientId: idSchema.optional(),
      }),
    },
    ({ req, query }) =>
      listAppointments(salonScope(getSalon(req)), {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        status: query.status,
        clientId: query.clientId,
        masterId: query.masterId,
      }),
  ),
);
salonRoutes.post(
  '/appointments',
  requireSalon('write'),
  handle(
    { body: masterAppointmentCreateSchema.and(z.object({ masterId: idSchema })), status: 201 },
    ({ req, body }) => {
      const t = scopedMaster(req, body.masterId);
      return createAppointmentByStaff(salonScope(t), body.masterId, body, 'salon');
    },
  ),
);
salonRoutes.get(
  '/appointments/:id',
  requireSalon('read'),
  handle({ params: idParams }, ({ req, params }) =>
    getAppointment(salonScope(getSalon(req)), params.id),
  ),
);
salonRoutes.patch(
  '/appointments/:id',
  requireSalon('write'),
  handle({ params: idParams, body: appointmentPatchSchema }, ({ req, params, body }) =>
    patchAppointment(salonScope(getSalon(req)), params.id, body, 'salon'),
  ),
);
salonRoutes.get(
  '/clients',
  requireSalon('read'),
  handle(
    {
      query: paginationSchema.extend({
        q: z.string().trim().max(64).optional(),
        filter: z.enum(['all', 'sleeping', 'birthday', 'new', 'blacklisted']).default('all'),
        masterId: idSchema.optional(),
      }),
    },
    ({ req, query }) => listClients(salonScope(getSalon(req)), query),
  ),
);
salonRoutes.get(
  '/clients/:id',
  requireSalon('read'),
  handle({ params: idParams }, ({ req, params }) =>
    getClientDetail(salonScope(getSalon(req)), params.id),
  ),
);
salonRoutes.patch(
  '/clients/:id',
  requireSalon('write'),
  handle({ params: idParams, body: clientPatchSchema }, ({ req, params, body }) =>
    patchClient(salonScope(getSalon(req)), params.id, body),
  ),
);
salonRoutes.post(
  '/clients/:id/remind',
  requireSalon('write'),
  handle({ params: idParams, body: remindClientSchema }, ({ req, params, body }) =>
    remindClient(salonScope(getSalon(req)), params.id, body.text),
  ),
);
salonRoutes.get(
  '/services',
  requireSalon('read'),
  handle({}, ({ req }) => listSalonServices(getSalon(req))),
);
salonRoutes.get(
  '/reviews',
  requireSalon('read'),
  handle({}, ({ req }) => listReviews(getSalon(req).db)),
);

/* ───────────── Analytics ───────────── */

salonRoutes.get(
  '/dashboard',
  requireSalon('read'),
  handle({}, ({ req }) => getDashboard(salonScope(getSalon(req)))),
);
salonRoutes.get(
  '/analytics',
  requireSalon('read'),
  handle(
    { query: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }) },
    ({ req, query }) => getAnalytics(salonScope(getSalon(req)), query.days),
  ),
);

/* ───────────── Promotions & broadcasts on behalf of a salon master ───────────── */

salonRoutes.get(
  '/promotions',
  requireSalon('read'),
  handle({}, ({ req }) => listPromotions(getSalon(req).db)),
);
salonRoutes.post(
  '/promotions',
  requireSalon('write'),
  handle(
    { body: promotionCreateSchema.and(z.object({ masterId: idSchema })), status: 201 },
    ({ req, body }) => {
      const t = scopedMaster(req, body.masterId);
      return createPromotion(forMaster(body.masterId), body.masterId, t.salon.timezone, body);
    },
  ),
);
salonRoutes.patch(
  '/promotions/:id',
  requireSalon('write'),
  handle({ params: idParams, body: promotionPatchSchema }, ({ req, params, body }) =>
    patchPromotion(getSalon(req).db, getSalon(req).salon.timezone, params.id, body),
  ),
);
salonRoutes.delete(
  '/promotions/:id',
  requireSalon('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await deletePromotion(getSalon(req).db, params.id);
    return { ok: true };
  }),
);
salonRoutes.get(
  '/broadcasts',
  requireSalon('read'),
  handle({}, ({ req }) => listBroadcasts(getSalon(req).db)),
);
salonRoutes.post(
  '/broadcasts/preview',
  requireSalon('read'),
  handle(
    { body: broadcastPreviewSchema.and(z.object({ masterId: idSchema })) },
    ({ req, body }) => {
      const t = scopedMaster(req, body.masterId);
      return previewBroadcast(forMaster(body.masterId), t.salon.timezone, body);
    },
  ),
);
salonRoutes.post(
  '/broadcasts',
  requireSalon('write'),
  handle(
    { body: broadcastCreateSchema.and(z.object({ masterId: idSchema })), status: 201 },
    ({ req, body }) => {
      const t = scopedMaster(req, body.masterId);
      return sendBroadcast(forMaster(body.masterId), body.masterId, t.salon.timezone, body);
    },
  ),
);
