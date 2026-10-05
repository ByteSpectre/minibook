import {
  applyDiscount,
  evaluateLoyaltyRules,
  isPromotionCurrent,
  pickBestDiscount,
  promotionApplies,
  toIsoDate,
  type DiscountCandidate,
  type QuoteResponse,
} from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { localParts } from '../lib/time';
import { resolveServices } from './slots.service';

export interface PricingClient {
  /** Existing Client of this master, if any. */
  clientId: string | null;
  birthday: Date | null;
  /** Referral link used by a new client. */
  referrerClientId?: string | null;
}

export interface Quote extends QuoteResponse {
  discountSourceKey: string | null;
  services: Awaited<ReturnType<typeof resolveServices>>['services'];
}

async function referralFlags(masterId: string, client: PricingClient) {
  if (!client.clientId) {
    if (!client.referrerClientId) return { referred: null, referrer: null };
    const referrer = await prisma.client.findFirst({
      where: { id: client.referrerClientId, masterId },
      select: { id: true },
    });
    return { referred: referrer ? 'new' : null, referrer: null };
  }
  const [asReferred, asReferrer] = await Promise.all([
    prisma.referral.findFirst({
      where: { masterId, referredId: client.clientId, referredRewardUsedAt: null },
      select: { id: true },
    }),
    prisma.referral.findFirst({
      where: {
        masterId,
        referrerId: client.clientId,
        referredRewardUsedAt: { not: null },
        referrerRewardUsedAt: null,
      },
      orderBy: { appliedAt: 'asc' },
      select: { id: true },
    }),
  ]);
  return { referred: asReferred?.id ?? null, referrer: asReferrer?.id ?? null };
}

function sourceKey(
  best: DiscountCandidate | null,
  referral: { referred: string | null; referrer: string | null },
) {
  if (!best) return null;
  if (best.source === 'promotion') return `promotion:${best.promotionId}`;
  if (best.loyaltyType === 'REFERRAL') {
    if (referral.referred) return `loyalty:REFERRAL:referred:${referral.referred}`;
    if (referral.referrer) return `loyalty:REFERRAL:referrer:${referral.referrer}`;
  }
  return `loyalty:${best.loyaltyType}`;
}

/** Price for a booking: best single discount among loyalty rules and current promotions. */
export async function computeQuote(
  masterId: string,
  serviceIds: string[],
  startAt: Date | null,
  client: PricingClient,
  now: Date = new Date(),
): Promise<Quote> {
  const master = await prisma.master.findUniqueOrThrow({
    where: { id: masterId },
    select: { timezone: true, currency: true },
  });
  const { services, durationMin, totalPrice } = await resolveServices(masterId, serviceIds);
  const [rules, promotions, completedVisits, earlier, referral] = await Promise.all([
    prisma.loyaltyRule.findMany({ where: { masterId, isActive: true } }),
    prisma.promotion.findMany({ where: { masterId, isActive: true, validTo: { gte: now } } }),
    client.clientId
      ? prisma.appointment.count({
          where: { masterId, clientId: client.clientId, status: 'COMPLETED' },
        })
      : Promise.resolve(0),
    client.clientId
      ? prisma.appointment.count({
          where: {
            masterId,
            clientId: client.clientId,
            status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
          },
        })
      : Promise.resolve(0),
    referralFlags(masterId, client),
  ]);

  const at = startAt ?? now;
  const local = localParts(at, master.timezone);
  const candidates = evaluateLoyaltyRules(rules, {
    completedVisits,
    hasEarlierAppointments: earlier > 0,
    birthday: client.birthday ? toIsoDate(client.birthday) : null,
    appointmentDay: local.day,
    referredRewardAvailable: referral.referred !== null,
    referrerRewardAvailable: referral.referrer !== null,
  });
  for (const promo of promotions) {
    const applies = startAt
      ? promotionApplies(promo, {
          serviceIds,
          at,
          localDay: local.day,
          localMinutes: local.minutes,
          isoWeekday: local.isoWeekday,
        })
      : false;
    if (applies && isPromotionCurrent(promo, startAt ?? now)) {
      candidates.push({
        source: 'promotion',
        discountPct: promo.discountPct,
        promotionId: promo.id,
        title: promo.title,
      });
    }
  }
  const best = pickBestDiscount(candidates);
  return {
    durationMin,
    totalPrice,
    discountPct: best?.discountPct ?? null,
    discountSource: best
      ? {
          source: best.source,
          ...(best.loyaltyType ? { loyaltyType: best.loyaltyType } : {}),
          ...(best.title ? { title: best.title } : {}),
        }
      : null,
    finalPrice: applyDiscount(totalPrice, best?.discountPct),
    currency: master.currency,
    discountSourceKey: sourceKey(best, referral),
    services,
  };
}
