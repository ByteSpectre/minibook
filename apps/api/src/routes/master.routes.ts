import { z } from 'zod';
import {
  applyPromoSchema,
  appointmentPatchSchema,
  appointmentPhotosSchema,
  APPOINTMENT_STATUSES,
  autoRenewSchema,
  blacklistCreateSchema,
  blockedScreenSchema,
  broadcastCreateSchema,
  broadcastPreviewSchema,
  clientCreateSchema,
  clientPatchSchema,
  createPaymentSchema,
  csvIdsSchema,
  exportLinkSchema,
  idSchema,
  imageUploadKinds,
  isoDateSchema,
  isoDateTimeSchema,
  loyaltyRuleCreateSchema,
  loyaltyRulePatchSchema,
  masterAppointmentCreateSchema,
  masterOnboardingCompleteSchema,
  masterOnboardingStepSchema,
  masterProfilePatchSchema,
  onlineOpenSchema,
  paginationSchema,
  promotionCreateSchema,
  promotionPatchSchema,
  remindClientSchema,
  reorderSchema,
  reviewPatchSchema,
  serviceCreateSchema,
  servicePatchSchema,
  settingsPatchSchema,
  themePatchSchema,
  themePresetSchema,
  timeBlockCreateSchema,
  weeklyScheduleSchema,
} from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { defineRouter, handle, idParams } from '../lib/http';
import { addDays, localDay } from '../lib/time';
import { authenticate, getAuth, getMaster, requireMaster } from '../middleware/auth';
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
  setAppointmentPhotos,
} from '../services/master/appointments.service';
import {
  createService,
  deleteService,
  listMasterCategories,
  listServices,
  patchService,
  reorderServices,
  setMasterCategories,
} from '../services/master/catalog.service';
import {
  createClient,
  getClientDetail,
  listClients,
  patchClient,
  remindClient,
} from '../services/master/clients.service';
import { exportLink } from '../services/master/export.service';
import {
  createLoyaltyRule,
  createPromotion,
  deleteLoyaltyRule,
  deletePromotion,
  listBroadcasts,
  listLoyaltyRules,
  listPromotions,
  patchLoyaltyRule,
  patchPromotion,
  previewBroadcast,
  sendBroadcast,
} from '../services/master/marketing.service';
import {
  addToBlacklist,
  deleteReview,
  getBlockedScreen,
  listBlacklist,
  listReviews,
  putBlockedScreen,
  removeFromBlacklist,
  setReviewPublished,
} from '../services/master/moderation.service';
import {
  completeMasterOnboarding,
  getOnboardingDraft,
  isSlugAvailable,
  saveOnboardingDraft,
} from '../services/master/onboarding.service';
import {
  applyThemePreset,
  closeOnline,
  getMasterProfile,
  getShare,
  getTheme,
  openOnline,
  patchMasterProfile,
  patchTheme,
} from '../services/master/profile.service';
import {
  createTimeBlock,
  deleteTimeBlock,
  getScheduleDay,
  getScheduleOverview,
  getSettings,
  getWeeklySchedule,
  listTimeBlocks,
  patchSettings,
  putWeeklySchedule,
} from '../services/master/schedule.service';
import { leaveSalon } from '../services/salon/membership.service';
import { masterScope } from '../services/scope';
import { getDaySlots } from '../services/slots.service';
import { storeImage, uploadMiddleware } from '../services/storage.service';

export const masterRoutes = defineRouter('/api/master');
masterRoutes.use(authenticate);

const slugQuery = z.object({ slug: z.string().trim().toLowerCase().min(1).max(64) });

/* ───────────── Onboarding (the master profile doesn't exist yet) ───────────── */

masterRoutes.get(
  '/onboarding/draft',
  handle(
    {},
    async ({ req }) =>
      (await getOnboardingDraft(getAuth(req).userId, 'MASTER')) ?? { step: 1, data: {} },
  ),
);
masterRoutes.post(
  '/onboarding/step',
  handle({ body: masterOnboardingStepSchema }, async ({ req, body }) =>
    saveOnboardingDraft(getAuth(req).userId, 'MASTER', body.step, body.data),
  ),
);
masterRoutes.get(
  '/onboarding/slug-check',
  handle({ query: slugQuery }, async ({ req, query }) => ({
    slug: query.slug,
    available: await isSlugAvailable(
      query.slug,
      getAuth(req).masterId ? { masterId: getAuth(req).masterId! } : undefined,
    ),
  })),
);
masterRoutes.post(
  '/onboarding/complete',
  handle({ body: masterOnboardingCompleteSchema, status: 201 }, async ({ req, body }) =>
    completeMasterOnboarding(getAuth(req).userId, body),
  ),
);

/* ───────────── Profile ───────────── */

masterRoutes.get(
  '/profile',
  requireMaster('any'),
  handle({}, ({ req }) => getMasterProfile(getMaster(req))),
);
masterRoutes.patch(
  '/profile',
  requireMaster('write'),
  handle({ body: masterProfilePatchSchema }, ({ req, body }) =>
    patchMasterProfile(getMaster(req), body),
  ),
);
masterRoutes.get(
  '/categories',
  requireMaster('read'),
  handle({}, ({ req }) => listMasterCategories(getMaster(req).db)),
);
masterRoutes.put(
  '/categories',
  requireMaster('write'),
  handle({ body: z.object({ categoryIds: z.array(idSchema).min(1).max(12) }) }, ({ req, body }) =>
    setMasterCategories(getMaster(req).db, getMaster(req).masterId, body.categoryIds),
  ),
);
masterRoutes.post(
  '/salon/leave',
  requireMaster('any'),
  handle({}, async ({ req }) => {
    await leaveSalon(getMaster(req).masterId);
    return { ok: true };
  }),
);

/* ───────────── Subscription (available on every status) ───────────── */

masterRoutes.get(
  '/subscription',
  requireMaster('any'),
  handle({}, ({ req }) => getSubscription('master', getMaster(req).masterId)),
);
masterRoutes.post(
  '/subscription/create-payment',
  requireMaster('any'),
  handle({ body: createPaymentSchema }, ({ req, body }) =>
    createSubscriptionPayment('master', getMaster(req).masterId, { autoRenew: body.autoRenew }),
  ),
);
masterRoutes.post(
  '/subscription/cancel',
  requireMaster('any'),
  handle({}, ({ req }) => cancelSubscription('master', getMaster(req).masterId)),
);
masterRoutes.post(
  '/subscription/auto-renew',
  requireMaster('any'),
  handle({ body: autoRenewSchema }, ({ req, body }) =>
    setAutoRenew('master', getMaster(req).masterId, body.enabled),
  ),
);
masterRoutes.post(
  '/subscription/apply-promo',
  requireMaster('any'),
  handle({ body: applyPromoSchema }, ({ req, body }) =>
    applyPromoCode('master', getMaster(req).masterId, body.code),
  ),
);
masterRoutes.get(
  '/subscription/payments',
  requireMaster('any'),
  handle({}, ({ req }) => listPayments('master', getMaster(req).masterId)),
);

/* ───────────── Theme & uploads ───────────── */

masterRoutes.get(
  '/theme',
  requireMaster('read'),
  handle({}, ({ req }) => getTheme(getMaster(req))),
);
masterRoutes.patch(
  '/theme',
  requireMaster('write'),
  handle({ body: themePatchSchema }, ({ req, body }) => patchTheme(getMaster(req), body)),
);
masterRoutes.post(
  '/theme/preset',
  requireMaster('write'),
  handle({ body: themePresetSchema }, ({ req, body }) =>
    applyThemePreset(getMaster(req), body.preset),
  ),
);
masterRoutes.post(
  '/upload',
  requireMaster('write'),
  uploadMiddleware,
  handle(
    { query: z.object({ kind: z.enum(imageUploadKinds).default('service') }), status: 201 },
    ({ req, query }) => storeImage(req.file, query.kind, `m-${getMaster(req).masterId}`),
  ),
);

/* ───────────── Services ───────────── */

masterRoutes.get(
  '/services',
  requireMaster('read'),
  handle({}, ({ req }) => listServices(getMaster(req).db)),
);
masterRoutes.post(
  '/services',
  requireMaster('write'),
  handle({ body: serviceCreateSchema, status: 201 }, ({ req, body }) =>
    createService(getMaster(req).db, getMaster(req).masterId, body),
  ),
);
masterRoutes.post(
  '/services/reorder',
  requireMaster('write'),
  handle({ body: reorderSchema }, ({ req, body }) => reorderServices(getMaster(req).db, body.ids)),
);
masterRoutes.patch(
  '/services/:id',
  requireMaster('write'),
  handle({ params: idParams, body: servicePatchSchema }, ({ req, params, body }) =>
    patchService(getMaster(req).db, params.id, body),
  ),
);
masterRoutes.delete(
  '/services/:id',
  requireMaster('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await deleteService(getMaster(req).db, params.id);
    return { ok: true };
  }),
);

/* ───────────── Schedule & settings ───────────── */

masterRoutes.get(
  '/schedule/weekly',
  requireMaster('read'),
  handle({}, ({ req }) => getWeeklySchedule(getMaster(req).db)),
);
masterRoutes.put(
  '/schedule/weekly',
  requireMaster('write'),
  handle({ body: weeklyScheduleSchema }, ({ req, body }) =>
    putWeeklySchedule(getMaster(req).db, getMaster(req).masterId, body),
  ),
);
masterRoutes.get(
  '/schedule/day',
  requireMaster('read'),
  handle({ query: z.object({ date: isoDateSchema }) }, ({ req, query }) =>
    getScheduleDay(masterScope(getMaster(req)), query.date),
  ),
);
masterRoutes.get(
  '/schedule/overview',
  requireMaster('read'),
  handle(
    {
      query: z.object({
        from: isoDateSchema,
        days: z.coerce.number().int().min(1).max(62).default(42),
      }),
    },
    ({ req, query }) => getScheduleOverview(masterScope(getMaster(req)), query.from, query.days),
  ),
);
masterRoutes.get(
  '/slots',
  requireMaster('read'),
  handle(
    {
      query: z.object({
        serviceIds: csvIdsSchema.pipe(z.array(idSchema).min(1)),
        date: isoDateSchema,
      }),
    },
    async ({ req, query }) =>
      (await getDaySlots(getMaster(req).masterId, query.serviceIds, query.date)).response,
  ),
);
masterRoutes.get(
  '/settings',
  requireMaster('read'),
  handle({}, ({ req }) => getSettings(getMaster(req).db, getMaster(req).masterId)),
);
masterRoutes.patch(
  '/settings',
  requireMaster('write'),
  handle({ body: settingsPatchSchema }, ({ req, body }) =>
    patchSettings(getMaster(req).db, getMaster(req).masterId, body),
  ),
);
masterRoutes.get(
  '/time-blocks',
  requireMaster('read'),
  handle(
    { query: z.object({ from: isoDateTimeSchema.optional(), to: isoDateTimeSchema.optional() }) },
    ({ req, query }) => {
      const from = query.from ? new Date(query.from) : addDays(new Date(), -1);
      const to = query.to ? new Date(query.to) : addDays(new Date(), 60);
      return listTimeBlocks(getMaster(req).db, from, to);
    },
  ),
);
masterRoutes.post(
  '/time-blocks',
  requireMaster('write'),
  handle({ body: timeBlockCreateSchema, status: 201 }, ({ req, body }) =>
    createTimeBlock(getMaster(req).db, getMaster(req).masterId, body),
  ),
);
masterRoutes.delete(
  '/time-blocks/:id',
  requireMaster('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await deleteTimeBlock(getMaster(req).db, params.id);
    return { ok: true };
  }),
);

/* ───────────── Appointments ───────────── */

const appointmentsQuery = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  clientId: idSchema.optional(),
});

masterRoutes.get(
  '/appointments',
  requireMaster('read'),
  handle({ query: appointmentsQuery }, ({ req, query }) =>
    listAppointments(masterScope(getMaster(req)), {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      status: query.status,
      clientId: query.clientId,
    }),
  ),
);
masterRoutes.post(
  '/appointments',
  requireMaster('write'),
  handle({ body: masterAppointmentCreateSchema, status: 201 }, ({ req, body }) =>
    createAppointmentByStaff(masterScope(getMaster(req)), getMaster(req).masterId, body, 'master'),
  ),
);
masterRoutes.get(
  '/appointments/:id',
  requireMaster('read'),
  handle({ params: idParams }, ({ req, params }) =>
    getAppointment(masterScope(getMaster(req)), params.id),
  ),
);
masterRoutes.patch(
  '/appointments/:id',
  requireMaster('write'),
  handle({ params: idParams, body: appointmentPatchSchema }, ({ req, params, body }) =>
    patchAppointment(masterScope(getMaster(req)), params.id, body, 'master'),
  ),
);
masterRoutes.put(
  '/appointments/:id/photos',
  requireMaster('write'),
  handle({ params: idParams, body: appointmentPhotosSchema }, ({ req, params, body }) =>
    setAppointmentPhotos(masterScope(getMaster(req)), params.id, body),
  ),
);

/* ───────────── Clients ───────────── */

const clientsQuery = paginationSchema.extend({
  q: z.string().trim().max(64).optional(),
  filter: z.enum(['all', 'sleeping', 'birthday', 'new', 'blacklisted']).default('all'),
});

masterRoutes.get(
  '/clients',
  requireMaster('read'),
  handle({ query: clientsQuery }, ({ req, query }) =>
    listClients(masterScope(getMaster(req)), query),
  ),
);
masterRoutes.post(
  '/clients',
  requireMaster('write'),
  handle({ body: clientCreateSchema, status: 201 }, ({ req, body }) =>
    createClient(masterScope(getMaster(req)), getMaster(req).masterId, body),
  ),
);
masterRoutes.get(
  '/clients/:id',
  requireMaster('read'),
  handle({ params: idParams }, ({ req, params }) =>
    getClientDetail(masterScope(getMaster(req)), params.id),
  ),
);
masterRoutes.patch(
  '/clients/:id',
  requireMaster('write'),
  handle({ params: idParams, body: clientPatchSchema }, ({ req, params, body }) =>
    patchClient(masterScope(getMaster(req)), params.id, body),
  ),
);
masterRoutes.post(
  '/clients/:id/remind',
  requireMaster('write'),
  handle({ params: idParams, body: remindClientSchema }, ({ req, params, body }) =>
    remindClient(masterScope(getMaster(req)), params.id, body.text),
  ),
);

/* ───────────── Reviews ───────────── */

masterRoutes.get(
  '/reviews',
  requireMaster('read'),
  handle({}, ({ req }) => listReviews(getMaster(req).db)),
);
masterRoutes.patch(
  '/reviews/:id',
  requireMaster('write'),
  handle({ params: idParams, body: reviewPatchSchema }, ({ req, params, body }) =>
    setReviewPublished(getMaster(req).db, params.id, body.isPublished),
  ),
);
masterRoutes.delete(
  '/reviews/:id',
  requireMaster('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await deleteReview(getMaster(req).db, params.id);
    return { ok: true };
  }),
);

/* ───────────── Dashboard & analytics ───────────── */

masterRoutes.get(
  '/dashboard',
  requireMaster('read'),
  handle({}, ({ req }) => getDashboard(masterScope(getMaster(req)))),
);
masterRoutes.get(
  '/analytics',
  requireMaster('read'),
  handle(
    { query: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }) },
    ({ req, query }) => getAnalytics(masterScope(getMaster(req)), query.days),
  ),
);

/* ───────────── Blacklist ───────────── */

masterRoutes.get(
  '/blacklist',
  requireMaster('read'),
  handle({}, ({ req }) => listBlacklist(getMaster(req).db)),
);
masterRoutes.post(
  '/blacklist',
  requireMaster('write'),
  handle({ body: blacklistCreateSchema, status: 201 }, ({ req, body }) =>
    addToBlacklist(getMaster(req).db, getMaster(req).masterId, body),
  ),
);
masterRoutes.get(
  '/blacklist/screen',
  requireMaster('read'),
  handle({}, ({ req }) => getBlockedScreen(getMaster(req).db, getMaster(req).masterId)),
);
masterRoutes.put(
  '/blacklist/screen',
  requireMaster('write'),
  handle({ body: blockedScreenSchema }, ({ req, body }) =>
    putBlockedScreen(getMaster(req).db, getMaster(req).masterId, body),
  ),
);
masterRoutes.delete(
  '/blacklist/:id',
  requireMaster('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await removeFromBlacklist(getMaster(req).db, params.id);
    return { ok: true };
  }),
);

/* ───────────── Loyalty ───────────── */

masterRoutes.get(
  '/loyalty-rules',
  requireMaster('read'),
  handle({}, ({ req }) => listLoyaltyRules(getMaster(req).db)),
);
masterRoutes.post(
  '/loyalty-rules',
  requireMaster('write'),
  handle({ body: loyaltyRuleCreateSchema, status: 201 }, ({ req, body }) =>
    createLoyaltyRule(getMaster(req).db, getMaster(req).masterId, body),
  ),
);
masterRoutes.patch(
  '/loyalty-rules/:id',
  requireMaster('write'),
  handle({ params: idParams, body: loyaltyRulePatchSchema }, ({ req, params, body }) =>
    patchLoyaltyRule(getMaster(req).db, params.id, body),
  ),
);
masterRoutes.delete(
  '/loyalty-rules/:id',
  requireMaster('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await deleteLoyaltyRule(getMaster(req).db, params.id);
    return { ok: true };
  }),
);

/* ───────────── Promotions ───────────── */

masterRoutes.get(
  '/promotions',
  requireMaster('read'),
  handle({}, ({ req }) => listPromotions(getMaster(req).db)),
);
masterRoutes.post(
  '/promotions',
  requireMaster('write'),
  handle({ body: promotionCreateSchema, status: 201 }, ({ req, body }) =>
    createPromotion(
      getMaster(req).db,
      getMaster(req).masterId,
      getMaster(req).master.timezone,
      body,
    ),
  ),
);
masterRoutes.patch(
  '/promotions/:id',
  requireMaster('write'),
  handle({ params: idParams, body: promotionPatchSchema }, ({ req, params, body }) =>
    patchPromotion(getMaster(req).db, getMaster(req).master.timezone, params.id, body),
  ),
);
masterRoutes.delete(
  '/promotions/:id',
  requireMaster('write'),
  handle({ params: idParams }, async ({ req, params }) => {
    await deletePromotion(getMaster(req).db, params.id);
    return { ok: true };
  }),
);

/* ───────────── Broadcasts ───────────── */

masterRoutes.get(
  '/broadcasts',
  requireMaster('read'),
  handle({}, ({ req }) => listBroadcasts(getMaster(req).db)),
);
masterRoutes.post(
  '/broadcasts/preview',
  requireMaster('read'),
  handle({ body: broadcastPreviewSchema }, ({ req, body }) =>
    previewBroadcast(getMaster(req).db, getMaster(req).master.timezone, body),
  ),
);
masterRoutes.post(
  '/broadcasts',
  requireMaster('write'),
  handle({ body: broadcastCreateSchema, status: 201 }, ({ req, body }) =>
    sendBroadcast(getMaster(req).db, getMaster(req).masterId, getMaster(req).master.timezone, body),
  ),
);

/* ───────────── Online ("available now") ───────────── */

masterRoutes.post(
  '/online/open',
  requireMaster('write'),
  handle({ body: onlineOpenSchema }, ({ req, body }) => openOnline(getMaster(req), body.hours)),
);
masterRoutes.post(
  '/online/close',
  requireMaster('write'),
  handle({}, ({ req }) => closeOnline(getMaster(req))),
);

/* ───────────── QR & share ───────────── */

masterRoutes.get(
  '/qr',
  requireMaster('read'),
  handle({}, async ({ req }) => {
    const t = getMaster(req);
    const m = await prisma.master.findUniqueOrThrow({
      where: { id: t.masterId },
      select: { avatarUrl: true },
    });
    return getShare(t, m.avatarUrl);
  }),
);

/* ───────────── Export (available on every status, including BANNED) ───────────── */

masterRoutes.post(
  '/export/link',
  requireMaster('export'),
  handle({ body: exportLinkSchema }, ({ req, body }) => ({
    url: exportLink(getMaster(req).masterId, body.entity === 'all' ? 'appointments' : body.entity),
    today: localDay(new Date(), getMaster(req).master.timezone),
  })),
);
