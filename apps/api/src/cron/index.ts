import cron from 'node-cron';
import { env } from '../config';
import { logger } from '../logger';
import { runJobByName, type JobName } from './jobs';

const SCHEDULE: { name: JobName; expression: string }[] = [
  { name: 'reminders', expression: '*/5 * * * *' },
  { name: 'onlineClose', expression: '*/5 * * * *' },
  // Evening and morning summaries use each master's own timezone and time setting.
  { name: 'evening', expression: '*/15 * * * *' },
  { name: 'morning', expression: '*/15 * * * *' },
  { name: 'subscriptionReminders', expression: '0 10 * * *' },
  { name: 'expire', expression: '5 10 * * *' },
  { name: 'birthdays', expression: '0 10 * * *' },
  { name: 'autopay', expression: '0 11 * * *' },
  { name: 'digest', expression: '0 10 * * 1' },
];

export function startCron(): () => void {
  const tasks = SCHEDULE.map(({ name, expression }) =>
    cron.schedule(
      expression,
      async () => {
        const startedAt = Date.now();
        try {
          const result = await runJobByName(name);
          logger.info({ job: name, result, ms: Date.now() - startedAt }, 'Cron job finished');
        } catch (err) {
          logger.error({ err, job: name }, 'Cron job failed');
        }
      },
      { name, timezone: env.PLATFORM_TIMEZONE, noOverlap: true },
    ),
  );
  logger.info({ jobs: SCHEDULE.length, timezone: env.PLATFORM_TIMEZONE }, 'Cron scheduler started');
  return () => {
    for (const task of tasks) void task.stop();
  };
}
