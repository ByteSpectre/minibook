import pino from 'pino';
import { config, env } from './config';

export const logger = pino({
  level: config.isTest ? 'silent' : env.LOG_LEVEL,
  base: undefined,
  redact: {
    paths: ['req.headers.authorization', 'initData', '*.initData', 'token'],
    censor: '[redacted]',
  },
  ...(config.isProd || config.isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }),
});
