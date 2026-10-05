import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import { default as helmet } from 'helmet';
import { pinoHttp } from 'pino-http';
import { config, env } from './config';
import { errorHandler, NotFoundError } from './lib/errors';
import { logger } from './logger';
import { adminRoutes } from './routes/admin.routes';
import { authRoutes } from './routes/auth.routes';
import { clientRoutes } from './routes/client.routes';
import { devRoutes } from './routes/dev.routes';
import { geoRoutes } from './routes/geo.routes';
import { invitesRoutes } from './routes/invites.routes';
import { masterRoutes } from './routes/master.routes';
import { miscRoutes } from './routes/misc.routes';
import { publicRoutes } from './routes/public.routes';
import { salonRoutes } from './routes/salon.routes';
import { searchRoutes } from './routes/search.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { getMockPayment } from './services/billing/billing.service';
import { uploadDir } from './services/storage.service';

export function createApp(extra?: (app: Express) => void): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  app.use(
    helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }),
  );
  app.use(
    cors({
      origin: (origin, cb) =>
        cb(null, !origin || config.corsOrigins.includes(origin) || !config.isProd),
      credentials: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  if (!config.isTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  if (env.RATE_LIMIT_ENABLED && !config.isTest) {
    app.use(
      '/api/',
      rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
    );
    app.use(
      '/api/auth/',
      rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }),
    );
    app.use(
      /^\/api\/public\/[^/]+\/appointments$/,
      rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }),
    );
  }

  app.use(
    '/uploads',
    express.static(uploadDir, { maxAge: '30d', immutable: true, fallthrough: false }),
  );

  for (const r of [
    miscRoutes,
    geoRoutes,
    authRoutes,
    clientRoutes,
    searchRoutes,
    publicRoutes,
    invitesRoutes,
    masterRoutes,
    salonRoutes,
    adminRoutes,
    webhookRoutes,
    devRoutes,
  ]) {
    app.use(r.basePath, r.router);
  }

  if (!config.isProd) {
    app.get('/api/dev/mock-payments/:id', async (req, res) => {
      res.json(await getMockPayment(req.params.id));
    });
  }

  extra?.(app);

  app.use('/api', () => {
    throw new NotFoundError('Route not found');
  });
  app.use(errorHandler);
  return app;
}
