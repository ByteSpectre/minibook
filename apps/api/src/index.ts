import { buildApp, ensureBotReady, isVercel } from './bootstrap';
import { config, env } from './config';
import { startCron } from './cron';
import { prisma } from './db/prisma';
import { drainDeferred } from './lib/deferred';
import { logger } from './logger';

const { app, bot } = buildApp();

/** Vercel Express zero-config: default export becomes the serverless function. */
export default app;

void ensureBotReady(bot);

if (!isVercel) {
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(
      {
        port: env.PORT,
        host: '0.0.0.0',
        payments: config.paymentProvider,
        bot: bot ? env.BOT_MODE : 'mock',
        devAuth: config.devAuthEnabled,
      },
      'API listening',
    );
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    logger.fatal({ err, port: env.PORT }, 'Failed to bind API port');
    process.exit(1);
  });

  if (bot && env.BOT_MODE === 'polling') {
    void bot.start({
      allowed_updates: ['message', 'callback_query'],
      onStart: (me) => logger.info({ username: me.username }, 'Telegram bot polling started'),
    });
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
} else {
  logger.info(
    { bot: bot ? env.BOT_MODE : 'mock', publicApiUrl: config.publicApiUrl },
    'API ready on Vercel (webhook mode; in-process cron is off)',
  );
}
