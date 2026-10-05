import { z } from 'zod';
import {
  adminListQuerySchema,
  categoryUpsertSchema,
  cityUpsertSchema,
  countryUpsertSchema,
  experimentUpsertSchema,
  idSchema,
  paginationSchema,
  platformSettingsPatchSchema,
  promoCodeUpsertSchema,
  tenantActionSchema,
} from '@nail-crm/shared';
import { defineRouter, handle, idParams } from '../lib/http';
import { authenticate, requireOwner } from '../middleware/auth';
import {
  adminListCategories,
  adminListCities,
  adminListCountries,
  deleteCategory,
  deleteCity,
  deleteCountry,
  deleteExperiment,
  deletePromoCode,
  getAdminSettings,
  getAdminStats,
  getFunnel,
  listAdminPayments,
  listExperiments,
  listPromoCodes,
  listTenants,
  tenantAction,
  updatePlatformSettings,
  upsertCategory,
  upsertCity,
  upsertCountry,
  upsertExperiment,
  upsertPromoCode,
} from '../services/admin.service';
import { sendWeeklyDigest } from '../cron/jobs';

export const adminRoutes = defineRouter('/api/admin');
adminRoutes.use(authenticate, requireOwner);

adminRoutes.get(
  '/stats',
  handle({}, () => getAdminStats()),
);
adminRoutes.get(
  '/funnel',
  handle({}, () => getFunnel()),
);

adminRoutes.get(
  '/masters',
  handle({ query: adminListQuerySchema }, ({ query }) => listTenants('master', query)),
);
adminRoutes.post(
  '/masters/:id/action',
  handle({ params: idParams, body: tenantActionSchema }, ({ params, body }) =>
    tenantAction('master', params.id, body),
  ),
);
adminRoutes.get(
  '/salons',
  handle({ query: adminListQuerySchema }, ({ query }) => listTenants('salon', query)),
);
adminRoutes.post(
  '/salons/:id/action',
  handle({ params: idParams, body: tenantActionSchema }, ({ params, body }) =>
    tenantAction('salon', params.id, body),
  ),
);

adminRoutes.get(
  '/payments',
  handle(
    { query: paginationSchema.extend({ status: z.string().max(32).optional() }) },
    ({ query }) => listAdminPayments(query),
  ),
);

adminRoutes.get(
  '/categories',
  handle({}, () => adminListCategories()),
);
adminRoutes.post(
  '/categories',
  handle({ body: categoryUpsertSchema, status: 201 }, ({ body }) => upsertCategory(null, body)),
);
adminRoutes.patch(
  '/categories/:id',
  handle({ params: idParams, body: categoryUpsertSchema }, ({ params, body }) =>
    upsertCategory(params.id, body),
  ),
);
adminRoutes.delete(
  '/categories/:id',
  handle({ params: idParams }, async ({ params }) => {
    await deleteCategory(params.id);
    return { ok: true };
  }),
);

adminRoutes.get(
  '/countries',
  handle({}, () => adminListCountries()),
);
adminRoutes.post(
  '/countries',
  handle({ body: countryUpsertSchema, status: 201 }, ({ body }) => upsertCountry(null, body)),
);
adminRoutes.patch(
  '/countries/:id',
  handle({ params: idParams, body: countryUpsertSchema }, ({ params, body }) =>
    upsertCountry(params.id, body),
  ),
);
adminRoutes.delete(
  '/countries/:id',
  handle({ params: idParams }, async ({ params }) => {
    await deleteCountry(params.id);
    return { ok: true };
  }),
);

adminRoutes.get(
  '/cities',
  handle({ query: z.object({ countryId: idSchema.optional() }) }, ({ query }) =>
    adminListCities(query.countryId),
  ),
);
adminRoutes.post(
  '/cities',
  handle({ body: cityUpsertSchema, status: 201 }, ({ body }) => upsertCity(null, body)),
);
adminRoutes.patch(
  '/cities/:id',
  handle({ params: idParams, body: cityUpsertSchema }, ({ params, body }) =>
    upsertCity(params.id, body),
  ),
);
adminRoutes.delete(
  '/cities/:id',
  handle({ params: idParams }, async ({ params }) => {
    await deleteCity(params.id);
    return { ok: true };
  }),
);

adminRoutes.get(
  '/promo-codes',
  handle({}, () => listPromoCodes()),
);
adminRoutes.post(
  '/promo-codes',
  handle({ body: promoCodeUpsertSchema, status: 201 }, ({ body }) => upsertPromoCode(null, body)),
);
adminRoutes.patch(
  '/promo-codes/:id',
  handle({ params: idParams, body: promoCodeUpsertSchema }, ({ params, body }) =>
    upsertPromoCode(params.id, body),
  ),
);
adminRoutes.delete(
  '/promo-codes/:id',
  handle({ params: idParams }, async ({ params }) => {
    await deletePromoCode(params.id);
    return { ok: true };
  }),
);

adminRoutes.get(
  '/experiments',
  handle({}, () => listExperiments()),
);
adminRoutes.post(
  '/experiments',
  handle({ body: experimentUpsertSchema, status: 201 }, ({ body }) => upsertExperiment(null, body)),
);
adminRoutes.patch(
  '/experiments/:id',
  handle({ params: idParams, body: experimentUpsertSchema }, ({ params, body }) =>
    upsertExperiment(params.id, body),
  ),
);
adminRoutes.delete(
  '/experiments/:id',
  handle({ params: idParams }, async ({ params }) => {
    await deleteExperiment(params.id);
    return { ok: true };
  }),
);

adminRoutes.get(
  '/settings',
  handle({}, () => getAdminSettings()),
);
adminRoutes.patch(
  '/settings',
  handle({ body: platformSettingsPatchSchema }, async ({ body }) => {
    await updatePlatformSettings(body);
    return getAdminSettings();
  }),
);

adminRoutes.post(
  '/digest/send',
  handle({}, async () => ({ sent: await sendWeeklyDigest(new Date(), true) })),
);
