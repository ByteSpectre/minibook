import type { Express } from 'express';
import { webhookCallback } from 'grammy';
import { createApp } from './app';
import type { Bot } from 'grammy';
import { configureBot, createBot } from './bot/bot';
import { config, env } from './config';
import { logger } from './logger';
import { setNotifier, TelegramNotifier } from './services/notifications/notifier';

export const isVercel = process.env.VERCEL === '1';

let botInit: Promise<void> | null = null;

/** Build the Express app (webhook mounted when BOT_MODE=webhook). */
export function buildApp(): { app: Express; bot: Bot | null } {
  const bot = config.botEnabled ? createBot(env.BOT_TOKEN) : null;

  const app = createApp((express) => {
    if (bot && env.BOT_MODE === 'webhook') {
      express.post(
        '/api/bot/webhook',
        webhookCallback(bot, 'express', { secretToken: env.BOT_WEBHOOK_SECRET || undefined }),
      );
    }
  });

  return { app, bot };
}

/** Configure notifier, bot commands, and Telegram webhook (idempotent). */
export function ensureBotReady(bot: Bot | null): Promise<void> {
  if (!bot) {
    logger.warn('BOT_TOKEN is empty: using the mock bot (see GET /api/dev/outbox)');
    return Promise.resolve();
  }
  if (!botInit) {
    botInit = (async () => {
      setNotifier(new TelegramNotifier(bot.api));
      await configureBot(bot).catch((err: unknown) =>
        logger.warn({ err }, 'Failed to configure bot commands'),
      );
      if (env.BOT_MODE === 'webhook') {
        await bot.api.setWebhook(`${config.publicApiUrl}/api/bot/webhook`, {
          secret_token: env.BOT_WEBHOOK_SECRET || undefined,
          allowed_updates: ['message', 'callback_query'],
        });
        logger.info(
          { url: `${config.publicApiUrl}/api/bot/webhook` },
          'Telegram webhook registered',
        );
      }
    })().catch((err: unknown) => {
      logger.error({ err }, 'Bot bootstrap failed');
      botInit = null;
    });
  }
  return botInit ?? Promise.resolve();
}
