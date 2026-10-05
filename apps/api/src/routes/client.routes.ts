import {
  clientCancelSchema,
  clientOnboardingSchema,
  clientProfilePatchSchema,
  clientRescheduleSchema,
  myMasterPatchSchema,
  repeatAppointmentSchema,
  reviewCreateSchema,
} from '@nail-crm/shared';
import { defineRouter, handle, idParams, masterIdParams } from '../lib/http';
import { toReviewDto } from '../lib/mappers';
import { authenticate, getAuth, requireClientProfile } from '../middleware/auth';
import {
  cancelAppointmentByClient,
  completeClientOnboarding,
  confirmVisit,
  getClientProfile,
  getMyAppointments,
  getMyMasters,
  patchClientProfile,
  patchMyMaster,
  repeatBooking,
  repeatPreview,
  rescheduleAppointmentByClient,
  reviewAppointment,
} from '../services/client.service';

export const clientRoutes = defineRouter('/api/client');
clientRoutes.use(authenticate);

clientRoutes.get(
  '/profile',
  handle({}, async ({ req }) => getClientProfile(getAuth(req).userId)),
);

clientRoutes.patch(
  '/profile',
  handle({ body: clientProfilePatchSchema }, async ({ req, body }) =>
    patchClientProfile(getAuth(req).userId, body),
  ),
);

clientRoutes.post(
  '/onboarding/complete',
  handle({ body: clientOnboardingSchema }, async ({ req, body }) =>
    completeClientOnboarding(getAuth(req).userId, body),
  ),
);

clientRoutes.get(
  '/my-masters',
  handle({}, async ({ req }) => getMyMasters(getAuth(req).userId)),
);

clientRoutes.patch(
  '/my-masters/:masterId',
  handle({ params: masterIdParams, body: myMasterPatchSchema }, async ({ req, params, body }) => {
    await patchMyMaster(getAuth(req).userId, params.masterId, body.notificationsEnabled);
    return { ok: true };
  }),
);

clientRoutes.get(
  '/my-appointments',
  handle({}, async ({ req }) => getMyAppointments(getAuth(req).userId)),
);

clientRoutes.post(
  '/appointments/:id/cancel',
  handle({ params: idParams, body: clientCancelSchema }, async ({ req, params, body }) => {
    await cancelAppointmentByClient(params.id, { userId: getAuth(req).userId }, body.reason);
    return { ok: true };
  }),
);

clientRoutes.post(
  '/appointments/:id/reschedule',
  handle({ params: idParams, body: clientRescheduleSchema }, async ({ req, params, body }) =>
    rescheduleAppointmentByClient(params.id, getAuth(req).userId, body.startAt),
  ),
);

clientRoutes.post(
  '/appointments/:id/confirm',
  handle({ params: idParams }, async ({ req, params }) => ({
    ok: await confirmVisit(params.id, { userId: getAuth(req).userId }),
  })),
);

clientRoutes.get(
  '/appointments/:id/repeat',
  handle({ params: idParams }, async ({ req, params }) =>
    repeatPreview(getAuth(req).userId, params.id),
  ),
);

clientRoutes.post(
  '/appointments/:id/repeat',
  requireClientProfile,
  handle({ params: idParams, body: repeatAppointmentSchema }, async ({ req, params, body }) =>
    repeatBooking(getAuth(req).userId, params.id, body.startAt),
  ),
);

clientRoutes.post(
  '/appointments/:id/review',
  handle(
    { params: idParams, body: reviewCreateSchema, status: 201 },
    async ({ req, params, body }) =>
      toReviewDto(await reviewAppointment(getAuth(req).userId, params.id, body)),
  ),
);
