import { describe, expect, it } from 'vitest';
import {
  buildStartParam,
  computeLoyaltyProgress,
  daysFromBirthday,
  effectiveStatus,
  evaluateLoyaltyRules,
  normalizePhone,
  normalizeUsername,
  parseStartParam,
  pickBestDiscount,
  promotionApplies,
  slugify,
  type LoyaltyRuleLike,
} from '../src';
import { detectLanguage, en, ru } from '../src/i18n';

describe('normalizeUsername', () => {
  it('lowercases and strips prefixes', () => {
    expect(normalizeUsername('@Anna_Nails')).toBe('anna_nails');
    expect(normalizeUsername('https://t.me/Anna_Nails')).toBe('anna_nails');
    expect(normalizeUsername('  ')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('normalizes national and international formats to E.164', () => {
    expect(normalizePhone('8 (916) 123-45-67', 'RU')).toBe('+79161234567');
    expect(normalizePhone('+7 916 123 45 67')).toBe('+79161234567');
    expect(normalizePhone('9161234567', 'RU')).toBe('+79161234567');
  });
  it('rejects garbage', () => {
    expect(normalizePhone('12', 'RU')).toBeNull();
    expect(normalizePhone('hello', 'RU')).toBeNull();
  });
});

describe('slugify', () => {
  it('transliterates russian names', () => {
    expect(slugify('Мария Иванова')).toBe('mariya-ivanova');
    expect(slugify('Салон «Лаванда»')).toBe('salon-lavanda');
  });
});

describe('start params', () => {
  it('round-trips every kind', () => {
    const params = [
      { kind: 'master', slug: 'maria-nails' },
      { kind: 'master', slug: 'maria-nails', referrerClientId: 'cmabc12345xyz' },
      { kind: 'salon', slug: 'lavanda' },
      { kind: 'masterRef', masterId: 'cmabc12345xyz' },
      { kind: 'joinSalon', salonId: 'cmsalon12345', code: 'Ab12Cd34Ef' },
      { kind: 'appointment', appointmentId: 'cmappt123456', action: 'reschedule' },
      { kind: 'route', route: 'master_schedule' },
    ] as const;
    for (const p of params) {
      expect(parseStartParam(buildStartParam(p))).toEqual(p);
    }
  });
  it('rejects unsafe input', () => {
    expect(parseStartParam('m_../../etc')).toBeNull();
    expect(parseStartParam('go_unknown')).toBeNull();
  });
});

describe('loyalty', () => {
  const rules: LoyaltyRuleLike[] = [
    { id: 'n', type: 'EVERY_N_VISIT', threshold: 5, discountPct: 20, isActive: true },
    { id: 'c', type: 'CUMULATIVE', threshold: 10, discountPct: 10, isActive: true },
    { id: 'f', type: 'FIRST_VISIT', threshold: null, discountPct: 10, isActive: true },
    { id: 'b', type: 'BIRTHDAY', threshold: 7, discountPct: 15, isActive: true },
  ];

  it('gives the 5th visit a discount', () => {
    const c = evaluateLoyaltyRules(rules, { completedVisits: 4, hasEarlierAppointments: true });
    expect(pickBestDiscount(c)?.ruleId).toBe('n');
  });

  it('gives newcomers the first-visit discount', () => {
    const c = evaluateLoyaltyRules(rules, { completedVisits: 0, hasEarlierAppointments: false });
    expect(pickBestDiscount(c)?.ruleId).toBe('f');
  });

  it('applies birthday window across year boundary', () => {
    expect(daysFromBirthday('1990-01-02', '2026-12-30')).toBe(3);
    const c = evaluateLoyaltyRules(rules, {
      completedVisits: 1,
      hasEarlierAppointments: true,
      birthday: '1990-01-02',
      appointmentDay: '2026-12-30',
    });
    expect(pickBestDiscount(c)?.ruleId).toBe('b');
  });

  it('reports "2 visits left out of 5" after two visits', () => {
    expect(computeLoyaltyProgress(rules, 2)).toMatchObject({ remaining: 2, total: 5, current: 2 });
    expect(computeLoyaltyProgress(rules, 4)).toMatchObject({ remaining: 0, total: 5 });
  });

  it('matches promotions by weekday and time', () => {
    const promo = {
      id: 'p',
      title: 'Weekday mornings',
      serviceId: 's1',
      discountPct: 20,
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2026-12-31T23:59:59Z',
      daysOfWeek: [1, 2, 3, 4, 5],
      timeFrom: null,
      timeTo: '14:00',
      isActive: true,
    };
    const base = { serviceIds: ['s1'], at: new Date('2026-10-06T08:00:00Z'), localDay: '2026-10-06' };
    expect(promotionApplies(promo, { ...base, localMinutes: 11 * 60, isoWeekday: 2 })).toBe(true);
    expect(promotionApplies(promo, { ...base, localMinutes: 15 * 60, isoWeekday: 2 })).toBe(false);
    expect(promotionApplies(promo, { ...base, localMinutes: 11 * 60, isoWeekday: 6 })).toBe(false);
  });
});

describe('effectiveStatus', () => {
  const now = new Date('2026-10-05T10:00:00Z');
  it('expires trials and paid periods by date', () => {
    expect(
      effectiveStatus({ status: 'TRIAL', trialEndsAt: '2026-10-06T00:00:00Z', subscriptionEndsAt: null }, now),
    ).toBe('TRIAL');
    expect(
      effectiveStatus({ status: 'TRIAL', trialEndsAt: '2026-10-01T00:00:00Z', subscriptionEndsAt: null }, now),
    ).toBe('EXPIRED');
    expect(
      effectiveStatus({ status: 'CANCELLED', trialEndsAt: null, subscriptionEndsAt: '2026-10-20T00:00:00Z' }, now),
    ).toBe('CANCELLED');
    expect(effectiveStatus({ status: 'BANNED', trialEndsAt: null, subscriptionEndsAt: null }, now)).toBe('BANNED');
  });
});

describe('i18n', () => {
  it('detects languages', () => {
    expect(detectLanguage('ru')).toBe('ru');
    expect(detectLanguage('en-US')).toBe('en');
    expect(detectLanguage('kk')).toBe('ru');
    expect(detectLanguage('fr')).toBe('en');
  });

  it('keeps ru and en dictionaries in sync', () => {
    const keys = (obj: object, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
      );
    expect(keys(en).sort()).toEqual(keys(ru).sort());
  });
});
