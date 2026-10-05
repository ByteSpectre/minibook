import {
  accessEndsAt,
  accessFlags,
  daysLeft,
  effectiveStatus,
  type AccessDto,
  type SubStatus,
} from '@nail-crm/shared';

export interface SubscriptionFields {
  status: SubStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  autoRenewEnabled: boolean;
}

const ACTIVE = new Set<SubStatus>(['TRIAL', 'ACTIVE', 'CANCELLED']);

function build(
  status: SubStatus,
  ownStatus: SubStatus,
  source: AccessDto['source'],
  endsAt: Date | null,
  autoRenewEnabled: boolean,
  now: Date,
): AccessDto {
  return {
    status,
    ownStatus,
    source,
    endsAt: endsAt ? endsAt.toISOString() : null,
    daysLeft: ACTIVE.has(status) ? daysLeft(endsAt, now) : 0,
    autoRenewEnabled,
    ...accessFlags(status),
  };
}

export function computeSalonAccess(salon: SubscriptionFields, now: Date = new Date()): AccessDto {
  const status = effectiveStatus(salon, now);
  return build(status, salon.status, 'salon', accessEndsAt(salon), salon.autoRenewEnabled, now);
}

/**
 * Masters inside a salon are covered by the salon subscription. A master's own paid
 * period (or trial) still applies if it is better than the salon's.
 */
export function computeMasterAccess(
  master: SubscriptionFields & { salonId: string | null },
  salon: SubscriptionFields | null,
  now: Date = new Date(),
): AccessDto {
  if (master.status === 'BANNED') {
    return build('BANNED', 'BANNED', 'master', null, master.autoRenewEnabled, now);
  }
  const own = effectiveStatus(master, now);
  if (master.salonId && salon) {
    const salonStatus = effectiveStatus(salon, now);
    const coveredBySalon = ACTIVE.has(salonStatus);
    if (coveredBySalon || !ACTIVE.has(own)) {
      const status: SubStatus = coveredBySalon ? salonStatus : 'EXPIRED';
      return build(
        status,
        master.status,
        'salon-member',
        accessEndsAt(salon),
        salon.autoRenewEnabled,
        now,
      );
    }
  }
  return build(own, master.status, 'master', accessEndsAt(master), master.autoRenewEnabled, now);
}

/** Prisma `where` fragment selecting tenants whose own subscription is active right now. */
export function activeSubscriptionWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: 'TRIAL' as const, trialEndsAt: { gt: now } },
      {
        status: { in: ['ACTIVE' as const, 'CANCELLED' as const] },
        subscriptionEndsAt: { gt: now },
      },
    ],
  };
}
