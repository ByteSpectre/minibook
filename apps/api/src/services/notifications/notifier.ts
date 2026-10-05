import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { type Api, InputFile } from 'grammy';
import type { InlineKeyboardButton } from 'grammy/types';
import type { DevOutboxMessage } from '@nail-crm/shared';
import { config, env } from '../../config';
import { absoluteUrl, miniAppLink, webAppUrl } from '../../lib/links';
import { logger } from '../../logger';

export interface MessageButton {
  text: string;
  /** Opens the Mini App: as a web_app button over HTTPS, otherwise as a t.me deep link. */
  app?: { path: string; startParam?: string };
  url?: string;
  callbackData?: string;
}

export interface OutgoingMessage {
  chatId: bigint | string;
  text: string;
  /** Absolute URL or `/uploads/...` path. */
  photo?: string | null;
  buttons?: MessageButton[][];
  kind: string;
}

export interface Notifier {
  send(message: OutgoingMessage): Promise<boolean>;
}

const OUTBOX_LIMIT = 300;
const outbox: DevOutboxMessage[] = [];
let outboxSeq = 0;

export function getOutbox(): DevOutboxMessage[] {
  return [...outbox].reverse();
}

export function clearOutbox(): void {
  outbox.length = 0;
}

function recordOutbox(message: OutgoingMessage): void {
  outboxSeq += 1;
  outbox.push({
    id: String(outboxSeq),
    chatId: message.chatId.toString(),
    text: message.text,
    photo: message.photo ? absoluteUrl(message.photo) : null,
    buttons: (message.buttons ?? []).map((row) =>
      row.map((b) => ({
        text: b.text,
        url: b.url ?? (b.app ? resolveAppUrl(b.app) : undefined),
        callbackData: b.callbackData,
        webAppUrl: b.app ? webAppUrl(b.app.path) : undefined,
      })),
    ),
    sentAt: new Date().toISOString(),
    kind: message.kind,
  });
  if (outbox.length > OUTBOX_LIMIT) outbox.shift();
}

function resolveAppUrl(app: { path: string; startParam?: string }): string {
  return app.startParam ? miniAppLink(app.startParam) : miniAppLink();
}

export function toKeyboard(
  buttons: MessageButton[][] | undefined,
): InlineKeyboardButton[][] | undefined {
  if (!buttons || buttons.length === 0) return undefined;
  return buttons.map((row) =>
    row.map((b): InlineKeyboardButton => {
      if (b.callbackData) return { text: b.text, callback_data: b.callbackData };
      if (b.app) {
        return config.webAppIsHttps
          ? { text: b.text, web_app: { url: webAppUrl(b.app.path) } }
          : { text: b.text, url: resolveAppUrl(b.app) };
      }
      return { text: b.text, url: b.url ?? miniAppLink() };
    }),
  );
}

/** Logs messages and keeps them in an in-memory outbox (GET /api/dev/outbox). */
export class MockNotifier implements Notifier {
  async send(message: OutgoingMessage): Promise<boolean> {
    recordOutbox(message);
    logger.info(
      { kind: message.kind, chatId: message.chatId.toString() },
      `[mock-bot] ${message.text.replace(/\n+/g, ' ⏎ ').slice(0, 160)}`,
    );
    return true;
  }
}

export class TelegramNotifier implements Notifier {
  constructor(private readonly api: Api) {}

  async send(message: OutgoingMessage): Promise<boolean> {
    if (!config.isProd) recordOutbox(message);
    const chatId = message.chatId.toString();
    const reply_markup = toKeyboard(message.buttons);
    try {
      if (message.photo) {
        const photo = await this.resolvePhoto(message.photo);
        if (photo) {
          await this.api.sendPhoto(chatId, photo, {
            caption: message.text.slice(0, 1024),
            parse_mode: 'HTML',
            reply_markup: reply_markup ? { inline_keyboard: reply_markup } : undefined,
          });
          return true;
        }
      }
      await this.api.sendMessage(chatId, message.text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: reply_markup ? { inline_keyboard: reply_markup } : undefined,
      });
      return true;
    } catch (err) {
      logger.warn({ err, kind: message.kind, chatId }, 'Telegram send failed');
      return false;
    }
  }

  private async resolvePhoto(photo: string): Promise<string | InputFile | null> {
    if (photo.startsWith('/uploads/') && env.STORAGE_DRIVER === 'local') {
      const file = path.resolve(env.UPLOAD_DIR, photo.slice('/uploads/'.length));
      try {
        return new InputFile(await readFile(file));
      } catch {
        return null;
      }
    }
    return absoluteUrl(photo);
  }
}

let current: Notifier = new MockNotifier();

export function setNotifier(notifier: Notifier): void {
  current = notifier;
}

export function getNotifier(): Notifier {
  return current;
}

export async function sendMessage(message: OutgoingMessage): Promise<boolean> {
  return current.send(message);
}
