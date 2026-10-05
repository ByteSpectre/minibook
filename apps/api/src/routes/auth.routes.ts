import { authInitSchema, devLoginSchema, languagePatchSchema } from '@nail-crm/shared';
import { config, env } from '../config';
import { AppError, unauthorized } from '../lib/errors';
import { defineRouter, handle } from '../lib/http';
import { InitDataError, validateInitData } from '../lib/telegram';
import { authenticate, getAuth } from '../middleware/auth';
import {
  buildAuthContext,
  buildMe,
  fromInitDataUser,
  issueSession,
  loginWithTelegram,
  setUserLanguage,
} from '../services/auth.service';

export const authRoutes = defineRouter('/api/auth');

authRoutes.post(
  '/init',
  handle({ body: authInitSchema }, async ({ body }) => {
    if (!env.BOT_TOKEN) throw new AppError(503, 'botNotConfigured', 'BOT_TOKEN is not configured');
    try {
      const data = validateInitData(body.initData, env.BOT_TOKEN, env.INIT_DATA_MAX_AGE);
      return await loginWithTelegram(fromInitDataUser(data.user));
    } catch (err) {
      if (err instanceof InitDataError) throw unauthorized(err.message);
      throw err;
    }
  }),
);

authRoutes.post(
  '/dev-login',
  handle({ body: devLoginSchema }, async ({ body }) => {
    if (!config.devAuthEnabled) throw new AppError(403, 'devAuthDisabled', 'Dev login is disabled');
    return loginWithTelegram({
      id: body.telegramId,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      username: body.username ?? null,
      languageCode: body.languageCode ?? 'ru',
      photoUrl: body.photoUrl ?? null,
    });
  }),
);

authRoutes.post(
  '/refresh',
  authenticate,
  handle({}, async ({ req }) => issueSession(getAuth(req).userId)),
);

authRoutes.get(
  '/me',
  authenticate,
  handle({}, async ({ req }) => buildMe(await buildAuthContext(getAuth(req).userId))),
);

authRoutes.patch(
  '/language',
  authenticate,
  handle({ body: languagePatchSchema }, async ({ req, body }) => {
    await setUserLanguage(getAuth(req).userId, body.language);
    return { ok: true };
  }),
);
