import { prisma } from '../db/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

/** Visits, spend and last visit are derived from completed appointments. */
export async function recomputeClientStats(
  masterId: string,
  clientId: string,
  db: Db = prisma,
): Promise<void> {
  const agg = await db.appointment.aggregate({
    where: { masterId, clientId, status: 'COMPLETED' },
    _count: { _all: true },
    _sum: { price: true },
    _max: { startAt: true },
  });
  await db.client.updateMany({
    where: { id: clientId, masterId },
    data: {
      visitsCount: agg._count._all,
      totalSpent: agg._sum.price ?? 0,
      lastVisitAt: agg._max.startAt,
    },
  });
}

export async function recomputeMasterRating(masterId: string, db: Db = prisma): Promise<void> {
  const agg = await db.review.aggregate({
    where: { masterId, isPublished: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await db.master.update({
    where: { id: masterId },
    data: {
      ratingAvg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      ratingCount: agg._count._all,
    },
  });
}

/** Marks referral rewards as used once the discounted visit actually happens. */
export async function applyReferralOnCompletion(
  masterId: string,
  appointment: { clientId: string; discountSource: string | null; completedAt: Date | null },
  db: Db = prisma,
): Promise<void> {
  const when = appointment.completedAt ?? new Date();
  const source = appointment.discountSource ?? '';
  if (source.startsWith('loyalty:REFERRAL:referrer:')) {
    const referralId = source.split(':')[3];
    if (referralId) {
      await db.referral.updateMany({
        where: {
          id: referralId,
          masterId,
          referrerId: appointment.clientId,
          referrerRewardUsedAt: null,
        },
        data: { referrerRewardUsedAt: when },
      });
    }
  }
  // The friend's first visit unlocks the reward for the referrer.
  await db.referral.updateMany({
    where: { masterId, referredId: appointment.clientId, referredRewardUsedAt: null },
    data: { referredRewardUsedAt: when },
  });
}
