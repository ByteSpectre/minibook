import 'dotenv/config';
import { z } from 'zod';
import { BILLING_DEFAULTS } from '@nail-crm/shared';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4420),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  PUBLIC_API_URL: z.string().default('http://localhost:4420'),
  WEB_APP_URL: z.string().default('http://localhost:5420'),
  CORS_ORIGINS: z.string().default('http://localhost:5420'),

  DATABASE_URL: z.string().min(1),

  BOT_TOKEN: z.string().default(''),
  BOT_USERNAME: z.string().default('glow_beauty_bot'),
  MINI_APP_SHORT_NAME: z.string().default(''),
  BOT_MODE: z.enum(['polling', 'webhook', 'off']).default('polling'),
  BOT_WEBHOOK_SECRET: z.string().default(''),
  PLATFORM_OWNER_TELEGRAM_ID: z.string().default(''),
  PLATFORM_TIMEZONE: z.string().default('Europe/Moscow'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_TTL: z.string().default('7d'),
  INIT_DATA_MAX_AGE: z.coerce.number().int().positive().default(86400),
  DEV_AUTH_ENABLED: bool.default(false),

  MASTER_PRICE_RUB: z.coerce.number().int().positive().default(BILLING_DEFAULTS.masterPriceRub),
  SALON_PRICE_RUB: z.coerce.number().int().positive().default(BILLING_DEFAULTS.salonPriceRub),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(BILLING_DEFAULTS.trialDays),
  SUBSCRIPTION_PERIOD_DAYS: z.coerce.number().int().positive().default(BILLING_DEFAULTS.periodDays),
  REFERRAL_BONUS_DAYS: z.coerce.number().int().min(0).default(BILLING_DEFAULTS.referralBonusDays),
  AUTOPAY_DAYS_BEFORE: z.coerce.number().int().min(0).max(10).default(1),

  YOOKASSA_SHOP_ID: z.string().default(''),
  YOOKASSA_SECRET_KEY: z.string().default(''),
  YOOKASSA_WEBHOOK_SECRET: z.string().default(''),
  YOOKASSA_ENABLE_RECEIPTS: bool.default(false),
  YOOKASSA_INN: z.string().default(''),
  YOOKASSA_DEFAULT_RECEIPT_EMAIL: z.string().default(''),
  YOOKASSA_VAT_CODE: z.coerce.number().int().min(1).max(12).default(1),
  YOOKASSA_SKIP_IP_CHECK: bool.default(false),

  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY: z.string().default(''),
  R2_SECRET_KEY: z.string().default(''),
  R2_BUCKET: z.string().default(''),
  R2_PUBLIC_URL: z.string().default(''),

  CRON_ENABLED: bool.default(true),
  RATE_LIMIT_ENABLED: bool.default(true),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.DEV_AUTH_ENABLED) {
    console.warn('DEV_AUTH_ENABLED is ignored in production');
    env.DEV_AUTH_ENABLED = false;
  }
  return env;
}

export const env = loadEnv();

export const config = {
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  publicApiUrl: env.PUBLIC_API_URL.replace(/\/+$/, ''),
  webAppUrl: env.WEB_APP_URL.replace(/\/+$/, ''),
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  botEnabled: env.BOT_TOKEN.length > 0 && env.BOT_MODE !== 'off',
  ownerTelegramId: env.PLATFORM_OWNER_TELEGRAM_ID ? BigInt(env.PLATFORM_OWNER_TELEGRAM_ID) : null,
  paymentProvider: (env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY ? 'yookassa' : 'mock') as
    'yookassa' | 'mock',
  devAuthEnabled: env.DEV_AUTH_ENABLED && env.NODE_ENV !== 'production',
  webAppIsHttps: env.WEB_APP_URL.startsWith('https://'),
};
