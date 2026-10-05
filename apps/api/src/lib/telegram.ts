import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  photo_url: z.string().optional(),
  is_premium: z.boolean().optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;

export interface ValidatedInitData {
  user: TelegramUser;
  authDate: Date;
  startParam: string | null;
  queryId: string | null;
}

export class InitDataError extends Error {}

/**
 * Validates Mini App `initData` as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * secret = HMAC_SHA256(key = "WebAppData", data = bot_token);
 * hash   = hex(HMAC_SHA256(key = secret, data = data_check_string)).
 */
export function validateInitData(
  raw: string,
  botToken: string,
  maxAgeSeconds: number,
  now: Date = new Date(),
): ValidatedInitData {
  if (!botToken) throw new InitDataError('Bot token is not configured');
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new InitDataError('Missing hash');

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const actual = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new InitDataError('Invalid signature');
  }

  const authDateSeconds = Number(params.get('auth_date'));
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    throw new InitDataError('Missing auth_date');
  }
  const ageSeconds = now.getTime() / 1000 - authDateSeconds;
  if (ageSeconds > maxAgeSeconds) throw new InitDataError('initData expired');

  const userRaw = params.get('user');
  if (!userRaw) throw new InitDataError('Missing user');
  let userJson: unknown;
  try {
    userJson = JSON.parse(userRaw);
  } catch {
    throw new InitDataError('Malformed user');
  }
  const user = telegramUserSchema.safeParse(userJson);
  if (!user.success) throw new InitDataError('Malformed user');

  return {
    user: user.data,
    authDate: new Date(authDateSeconds * 1000),
    startParam: params.get('start_param'),
    queryId: params.get('query_id'),
  };
}

/** Builds a signed initData string. Used by tests and local tooling only. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}
