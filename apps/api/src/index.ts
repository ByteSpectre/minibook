import 'dotenv/config';
import { webhookCallback } from 'grammy';
import { createApp } from './app';
import { configureBot, createBot } from './bot/bot';
import { config, env } from './config';
import { startCron } from './cron';
import { prisma } from './db/prisma';
import { drainDeferred } from './lib/deferred';
import { logger } from './logger';
import { setNotifier, TelegramNotifier } from './services/notifications/notifier';

async function main(): Promise<void> {
  const bot = config.botEnabled ? createBot(env.BOT_TOKEN) : null;

  const app = createApp((express) => {
    if (bot && env.BOT_MODE === 'webhook') {
      express.post(
        '/api/bot/webhook',
        webhookCallback(bot, 'express', { secretToken: env.BOT_WEBHOOK_SECRET || undefined }),
      );
    }
  });

  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        payments: config.paymentProvider,
        bot: bot ? env.BOT_MODE : 'mock',
        devAuth: config.devAuthEnabled,
      },
      'API listening',
    );
  });

  if (bot) {
    setNotifier(new TelegramNotifier(bot.api));
    await configureBot(bot).catch((err: unknown) =>
      logger.warn({ err }, 'Failed to configure bot commands'),
    );
    if (env.BOT_MODE === 'webhook') {
      await bot.api.setWebhook(`${config.publicApiUrl}/api/bot/webhook`, {
        secret_token: env.BOT_WEBHOOK_SECRET || undefined,
        allowed_updates: ['message', 'callback_query'],
      });
      logger.info('Telegram webhook registered');
    } else {
      void bot.start({
        allowed_updates: ['message', 'callback_query'],
        onStart: (me) => logger.info({ username: me.username }, 'Telegram bot polling started'),
      });
    }
  } else {
    logger.warn('BOT_TOKEN is empty: using the mock bot (see GET /api/dev/outbox)');
  }

  const stopCron = env.CRON_ENABLED ? startCron() : () => undefined;

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    stopCron();
    server.close();
    if (bot && env.BOT_MODE === 'polling') await bot.stop().catch(() => undefined);
    await drainDeferred();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
