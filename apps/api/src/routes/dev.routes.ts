import { z } from 'zod';
import { config } from '../config';
import { AppError } from '../lib/errors';
import { defineRouter, handle } from '../lib/http';
import { clearOutbox, getOutbox } from '../services/notifications/notifier';
import { runJobByName, JOB_NAMES } from '../cron/jobs';
import { completeMockPayment } from '../services/billing/billing.service';

/** Local tooling: mock bot outbox, mock checkout and manual cron triggers. Disabled in production. */
export const devRoutes = defineRouter('/api/dev');

devRoutes.use((_req, _res, next) => {
  if (config.isProd) throw new AppError(404, 'notFound', 'Not found');
  next();
});

devRoutes.get(
  '/outbox',
  handle({}, () => getOutbox()),
);

devRoutes.delete(
  '/outbox',
  handle({}, () => {
    clearOutbox();
    return { ok: true };
  }),
);

devRoutes.post(
  '/cron/:job',
  handle({ params: z.object({ job: z.enum(JOB_NAMES) }) }, async ({ params }) => ({
    job: params.job,
    result: await runJobByName(params.job),
  })),
);

devRoutes.post(
  '/mock-payments/:id/:outcome',
  handle(
    { params: z.object({ id: z.string().min(1), outcome: z.enum(['succeed', 'cancel']) }) },
    async ({ params }) => {
      if (config.paymentProvider !== 'mock')
        throw new AppError(404, 'notFound', 'Mock payments are disabled');
      return completeMockPayment(params.id, params.outcome === 'succeed');
    },
  ),
);
