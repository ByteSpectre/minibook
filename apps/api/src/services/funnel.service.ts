import type { FunnelEventType } from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { logger } from '../logger';

export type FunnelRole = 'MASTER' | 'SALON' | 'CLIENT' | 'ANY';

/** Records the first occurrence of a funnel step per user/role (idempotent). */
export async function trackFunnel(
  userId: string,
  type: FunnelEventType,
  role: FunnelRole = 'ANY',
): Promise<void> {
  try {
    await prisma.funnelEvent.createMany({ data: [{ userId, type, role }], skipDuplicates: true });
  } catch (err) {
    logger.warn({ err, userId, type }, 'Failed to track funnel event');
  }
}
