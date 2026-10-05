import type { LoyaltyType } from '../enums';
import { daysFromBirthday, toMinutes } from './time';

export interface LoyaltyRuleLike {
  id: string;
  type: LoyaltyType;
  threshold: number | null;
  discountPct: number;
  isActive: boolean;
}

export interface PromotionLike {
  id: string;
  title: string;
  serviceId: string | null;
  discountPct: number;
  validFrom: Date | string;
  validTo: Date | string;
  daysOfWeek: number[];
  timeFrom: string | null;
  timeTo: string | null;
  isActive: boolean;
}

export interface LoyaltyContext {
  /** Completed visits with this master before the appointment being priced. */
  completedVisits: number;
  /** Any earlier non-cancelled appointment (completed or upcoming) with this master. */
  hasEarlierAppointments: boolean;
  /** Client birthday (`YYYY-MM-DD`). */
  birthday?: string | null;
  /** Local calendar day of the appointment (`YYYY-MM-DD`) in the master's timezone. */
  appointmentDay?: string | null;
  /** Client was referred by a friend and hasn't used the referral discount yet. */
  referredRewardAvailable?: boolean;
  /** Client invited a friend who visited, reward not used yet. */
  referrerRewardAvailable?: boolean;
}

export interface DiscountCandidate {
  source: 'loyalty' | 'promotion';
  discountPct: number;
  loyaltyType?: LoyaltyType;
  ruleId?: string;
  promotionId?: string;
  title?: string;
}

export const DEFAULT_BIRTHDAY_WINDOW_DAYS = 7;

export function evaluateLoyaltyRules(
  rules: LoyaltyRuleLike[],
  ctx: LoyaltyContext,
): DiscountCandidate[] {
  const result: DiscountCandidate[] = [];
  for (const rule of rules) {
    if (!rule.isActive || rule.discountPct <= 0) continue;
    let applies = false;
    switch (rule.type) {
      case 'FIRST_VISIT':
        applies = ctx.completedVisits === 0 && !ctx.hasEarlierAppointments;
        break;
      case 'EVERY_N_VISIT': {
        const n = rule.threshold ?? 0;
        applies = n >= 2 && (ctx.completedVisits + 1) % n === 0;
        break;
      }
      case 'CUMULATIVE': {
        const n = rule.threshold ?? 0;
        applies = n >= 1 && ctx.completedVisits >= n;
        break;
      }
      case 'BIRTHDAY': {
        const windowDays = rule.threshold ?? DEFAULT_BIRTHDAY_WINDOW_DAYS;
        applies =
          !!ctx.birthday &&
          !!ctx.appointmentDay &&
          daysFromBirthday(ctx.birthday, ctx.appointmentDay) <= windowDays;
        break;
      }
      case 'REFERRAL':
        applies = !!ctx.referredRewardAvailable || !!ctx.referrerRewardAvailable;
        break;
    }
    if (applies) {
      result.push({
        source: 'loyalty',
        discountPct: rule.discountPct,
        loyaltyType: rule.type,
        ruleId: rule.id,
      });
    }
  }
  return result;
}

export interface PromotionMatchContext {
  serviceIds: string[];
  at: Date;
  /** Local calendar day in the master's timezone. */
  localDay: string;
  /** Local minutes since midnight. */
  localMinutes: number;
  /** ISO weekday 1..7 in the master's timezone. */
  isoWeekday: number;
}

export function promotionApplies(promo: PromotionLike, ctx: PromotionMatchContext): boolean {
  if (!promo.isActive) return false;
  const from = new Date(promo.validFrom).getTime();
  const to = new Date(promo.validTo).getTime();
  const at = ctx.at.getTime();
  if (at < from || at > to) return false;
  if (promo.serviceId && !ctx.serviceIds.includes(promo.serviceId)) return false;
  if (promo.daysOfWeek.length > 0 && !promo.daysOfWeek.includes(ctx.isoWeekday)) return false;
  if (promo.timeFrom && ctx.localMinutes < toMinutes(promo.timeFrom)) return false;
  if (promo.timeTo && ctx.localMinutes >= toMinutes(promo.timeTo)) return false;
  return true;
}

export function isPromotionCurrent(promo: PromotionLike, now: Date = new Date()): boolean {
  return (
    promo.isActive &&
    new Date(promo.validFrom).getTime() <= now.getTime() &&
    new Date(promo.validTo).getTime() >= now.getTime()
  );
}

/** Discounts never stack: the single best offer wins. */
export function pickBestDiscount(candidates: DiscountCandidate[]): DiscountCandidate | null {
  return candidates.reduce<DiscountCandidate | null>(
    (best, c) => (!best || c.discountPct > best.discountPct ? c : best),
    null,
  );
}

export interface LoyaltyProgress {
  ruleId: string;
  type: 'EVERY_N_VISIT' | 'CUMULATIVE';
  discountPct: number;
  /** Visits completed in the current cycle. */
  current: number;
  /** Cycle length (N). */
  total: number;
  /** Regular visits left before the discounted one; 0 means the next visit is discounted. */
  remaining: number;
  /** Cumulative discount already unlocked. */
  unlocked: boolean;
}

/**
 * Progress towards the nearest visit-based reward, e.g. "2 visits left out of 5" for
 * "every 5th visit −20%" after two completed visits.
 */
export function computeLoyaltyProgress(
  rules: LoyaltyRuleLike[],
  completedVisits: number,
): LoyaltyProgress | null {
  const options: LoyaltyProgress[] = [];
  for (const rule of rules) {
    if (!rule.isActive || !rule.threshold) continue;
    if (rule.type === 'EVERY_N_VISIT' && rule.threshold >= 2) {
      const current = completedVisits % rule.threshold;
      options.push({
        ruleId: rule.id,
        type: 'EVERY_N_VISIT',
        discountPct: rule.discountPct,
        current,
        total: rule.threshold,
        remaining: rule.threshold - current - 1,
        unlocked: false,
      });
    }
    if (rule.type === 'CUMULATIVE') {
      const unlocked = completedVisits >= rule.threshold;
      options.push({
        ruleId: rule.id,
        type: 'CUMULATIVE',
        discountPct: rule.discountPct,
        current: Math.min(completedVisits, rule.threshold),
        total: rule.threshold,
        remaining: Math.max(0, rule.threshold - completedVisits),
        unlocked,
      });
    }
  }
  const pending = options.filter((o) => !o.unlocked);
  if (pending.length > 0) {
    return (
      pending.sort((a, b) => a.remaining - b.remaining || b.discountPct - a.discountPct)[0] ?? null
    );
  }
  return options.sort((a, b) => b.discountPct - a.discountPct)[0] ?? null;
}
