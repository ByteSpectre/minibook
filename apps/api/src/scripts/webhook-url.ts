import { config, env } from '../config';
import { webhookToken } from '../services/billing/billing.service';

if (!env.YOOKASSA_WEBHOOK_SECRET) {
  console.error('YOOKASSA_WEBHOOK_SECRET is empty — set it in apps/api/.env first.');
  process.exit(1);
}

console.info(`${config.publicApiUrl}/api/webhooks/yookassa?token=${webhookToken()}`);
console.info(
  'Paste this URL into YooKassa → Integration → HTTP notifications (events: payment.succeeded, payment.canceled, refund.succeeded).',
);
