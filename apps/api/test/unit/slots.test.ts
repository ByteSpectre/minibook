import { describe, expect, it } from 'vitest';
import { zonedToUtc } from '../../src/lib/time';
import {
  computeDaySlots,
  DEFAULT_SLOT_SETTINGS,
  type SlotEngineInput,
} from '../../src/services/slots.service';

const TZ = 'Europe/Moscow';
const DAY = '2026-10-07'; // Wednesday
const base = (overrides: Partial<SlotEngineInput> = {}): SlotEngineInput => ({
  day: DAY,
  timezone: TZ,
  durationMin: 60,
  settings: { ...DEFAULT_SLOT_SETTINGS, minLeadMinutes: 0, slotStep: 10 },
  schedule: [{ dayOfWeek: 3, startTime: '10:00', endTime: '14:00', isWorking: true }],
  busy: [],
  online: null,
  now: new Date('2026-10-06T00:00:00Z'),
  ...overrides,
});
const times = (input: SlotEngineInput) =>
  computeDaySlots(input).map(
    (s) =>
      `${String(Math.floor(s.minute / 60)).padStart(2, '0')}:${String(s.minute % 60).padStart(2, '0')}`,
  );

describe('computeDaySlots', () => {
  it('offers 10-minute slots that fit into working hours', () => {
    const t = times(base());
    expect(t[0]).toBe('10:00');
    expect(t.at(-1)).toBe('13:00');
    expect(t).toHaveLength(19);
  });

  it('skips non-working days', () => {
    expect(times(base({ day: '2026-10-08' }))).toEqual([]);
  });

  it('respects existing appointments and the buffer', () => {
    const busy = [{ startAt: zonedToUtc(DAY, 11 * 60, TZ), endAt: zonedToUtc(DAY, 12 * 60, TZ) }];
    const noBuffer = times(base({ busy }));
    expect(noBuffer).toContain('10:00');
    expect(noBuffer).not.toContain('10:10');
    expect(noBuffer).toContain('12:00');
    const withBuffer = times(
      base({ busy, settings: { ...DEFAULT_SLOT_SETTINGS, minLeadMinutes: 0, bufferMinutes: 10 } }),
    );
    expect(withBuffer).not.toContain('10:00');
    expect(withBuffer).not.toContain('12:00');
    expect(withBuffer[0]).toBe('12:10');
  });

  it('applies the minimum lead time', () => {
    const now = zonedToUtc(DAY, 10 * 60 + 5, TZ);
    const t = times(base({ now, settings: { ...DEFAULT_SLOT_SETTINGS, minLeadMinutes: 60 } }));
    expect(t[0]).toBe('11:10');
  });

  it('hides slots of disabled periods', () => {
    const t = times(
      base({ settings: { ...DEFAULT_SLOT_SETTINGS, minLeadMinutes: 0, morningEnabled: false } }),
    );
    expect(t[0]).toBe('12:00');
  });

  it('opens extra availability for an "available now" window', () => {
    const now = zonedToUtc('2026-10-08', 15 * 60, TZ);
    const t = times(
      base({
        day: '2026-10-08',
        now,
        online: { until: zonedToUtc('2026-10-08', 17 * 60, TZ) },
        settings: { ...DEFAULT_SLOT_SETTINGS, minLeadMinutes: 60 },
      }),
    );
    expect(t[0]).toBe('15:10');
    expect(t.at(-1)).toBe('16:00');
  });

  it('marks slots covered by a weekday morning promotion', () => {
    const slots = computeDaySlots(
      base({
        serviceIds: ['svc'],
        promotions: [
          {
            id: 'p',
            title: 'Morning',
            serviceId: 'svc',
            discountPct: 20,
            validFrom: '2026-10-01T00:00:00Z',
            validTo: '2026-10-31T00:00:00Z',
            daysOfWeek: [1, 2, 3, 4, 5],
            timeFrom: null,
            timeTo: '12:00',
            isActive: true,
          },
        ],
      }),
    );
    expect(slots.find((s) => s.minute === 600)?.discountPct).toBe(20);
    expect(slots.find((s) => s.minute === 720)?.discountPct).toBeNull();
  });

  it('works across a DST switch', () => {
    const t = computeDaySlots(
      base({
        day: '2026-03-29',
        timezone: 'Europe/Berlin',
        schedule: [{ dayOfWeek: 7, startTime: '10:00', endTime: '12:00', isWorking: true }],
        now: new Date('2026-03-28T00:00:00Z'),
      }),
    );
    expect(t[0]!.startAt.toISOString()).toBe('2026-03-29T08:00:00.000Z');
  });
});
