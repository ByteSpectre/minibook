import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgresql://beauty:beauty@localhost:5432/beauty_test',
      JWT_SECRET: 'test-jwt-secret-0123456789abcdef',
      BOT_TOKEN: '123456:TEST-BOT-TOKEN',
      BOT_MODE: 'off',
      BOT_USERNAME: 'glow_test_bot',
      DEV_AUTH_ENABLED: 'false',
      CRON_ENABLED: 'false',
      RATE_LIMIT_ENABLED: 'false',
      PLATFORM_OWNER_TELEGRAM_ID: '999000',
      PLATFORM_TIMEZONE: 'Europe/Moscow',
      YOOKASSA_WEBHOOK_SECRET: 'test-webhook-secret',
      YOOKASSA_SHOP_ID: '',
      YOOKASSA_SECRET_KEY: '',
      TRUST_PROXY: '1',
      UPLOAD_DIR: '/tmp/glow-test-uploads',
      WEB_APP_URL: 'http://localhost:5420',
      PUBLIC_API_URL: 'http://localhost:4420',
    },
  },
});
