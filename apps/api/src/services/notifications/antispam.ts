import { LIMITS } from '@nail-crm/shared';
import { prisma } from '../../db/prisma';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Marketing = free-slot alerts + broadcasts. At most one per hour per person (Telegram id). */
export async function marketingSentWithinHour(
  telegramId: bigint,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - HOUR);
  const [alerts, broadcasts] = await Promise.all([
    prisma.slotAlert.count({ where: { telegramId, sentAt: { gt: since } } }),
    prisma.broadcastRecipient.count({ where: { telegramId, sentAt: { gt: since } } }),
  ]);
  return alerts + broadcasts >= LIMITS.marketingMessagesPerHourPerClient;
}

export async function canSendSlotAlert(
  telegramId: bigint,
  now: Date = new Date(),
): Promise<boolean> {
  const [hourly, daily] = await Promise.all([
    prisma.slotAlert.count({
      where: { telegramId, sentAt: { gt: new Date(now.getTime() - HOUR) } },
    }),
    prisma.slotAlert.count({
      where: { telegramId, sentAt: { gt: new Date(now.getTime() - DAY) } },
    }),
  ]);
  if (hourly >= LIMITS.slotAlertsPerHourPerClient) return false;
  if (daily >= LIMITS.slotAlertsPerDayPerClient) return false;
  return !(await marketingSentWithinHour(telegramId, now));
}

export async function canSendBroadcastTo(
  telegramId: bigint,
  now: Date = new Date(),
): Promise<boolean> {
  return !(await marketingSentWithinHour(telegramId, now));
}
