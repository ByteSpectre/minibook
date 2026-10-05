import { z } from 'zod';
import { config, env } from '../config';
import { AppError } from '../lib/errors';
import { defineRouter, handle } from '../lib/http';
import { isYooKassaIp } from '../lib/ip';
import { logger } from '../logger';
import {
  handleYooKassaNotification,
  verifyWebhookToken,
} from '../services/billing/billing.service';
import { yooNotificationSchema } from '../services/billing/yookassa';

export const webhookRoutes = defineRouter('/api/webhooks');

/**
 * YooKassa does not sign notifications, so three checks are combined:
 *  1. source IP must be in YooKassa's published ranges;
 *  2. `?token=` must equal HMAC-SHA256(YOOKASSA_WEBHOOK_SECRET, shop id) — timing-safe;
 *  3. payment objects are re-fetched from the YooKassa API before any state change.
 */
webhookRoutes.post(
  '/yookassa',
  handle({ query: z.object({ token: z.string().max(128).optional() }) }, async ({ req, query }) => {
    const ip = req.ip;
    const skipIp = env.YOOKASSA_SKIP_IP_CHECK && !config.isProd;
    if (!skipIp && !isYooKassaIp(ip)) {
      logger.warn({ ip }, 'YooKassa webhook from unknown IP');
      throw new AppError(403, 'forbidden', 'Forbidden');
    }
    if (!verifyWebhookToken(query.token)) {
      logger.warn({ ip }, 'YooKassa webhook with invalid token');
      throw new AppError(403, 'forbidden', 'Forbidden');
    }
    const notification = yooNotificationSchema.parse(req.body);
    await handleYooKassaNotification(notification);
    return { ok: true };
  }),
);
