import { z } from 'zod';
import { idSchema } from '@nail-crm/shared';
import { defineRouter, handle } from '../lib/http';
import { authenticate, getAuth } from '../middleware/auth';
import { acceptInvite, declineInvite, previewInvite } from '../services/salon/membership.service';

/** Join-salon links (`startapp=join_salon_<salonId>_<code>`), for new and existing masters. */
export const invitesRoutes = defineRouter('/api/invites');
invitesRoutes.use(authenticate);

const inviteParams = z.object({ salonId: idSchema, code: z.string().trim().min(6).max(32) });

invitesRoutes.get(
  '/:salonId/:code',
  handle({ params: inviteParams }, ({ req, params }) =>
    previewInvite(getAuth(req).userId, params.salonId, params.code),
  ),
);
invitesRoutes.post(
  '/:salonId/:code/accept',
  handle({ params: inviteParams }, ({ req, params }) =>
    acceptInvite(getAuth(req).userId, params.salonId, params.code),
  ),
);
invitesRoutes.post(
  '/:salonId/:code/decline',
  handle({ params: inviteParams }, async ({ req, params }) => {
    await declineInvite(getAuth(req).userId, params.salonId, params.code);
    return { ok: true };
  }),
);
