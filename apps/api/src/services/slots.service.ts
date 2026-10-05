import {
  addDaysIso,
  BLOCKING_APPOINTMENT_STATUSES,
  fromMinutes,
  isoWeekdayOf,
  promotionApplies,
  resolvePeriods,
  toMinutes,
  type DayPeriodKey,
  type PeriodConfig,
  type PromotionLike,
  type SlotsResponse,
} from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { NotFoundError } from '../lib/errors';
import { localParts, startOfLocalDay, zonedToUtc } from '../lib/time';

export interface SlotSettings extends PeriodConfig {
  slotStep: number;
  bufferMinutes: number;
  minLeadMinutes: number;
  bookingHorizonDays: number;
}

export interface ScheduleRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

export interface BusyInterval {
  startAt: Date;
  endAt: Date;
}

export interface SlotEngineInput {
  day: string;
  timezone: string;
  durationMin: number;
  settings: SlotSettings;
  schedule: ScheduleRow[];
  busy: BusyInterval[];
  online: { until: Date } | null;
  promotions?: PromotionLike[];
  serviceIds?: string[];
  now: Date;
}

export interface ComputedSlot {
  startAt: Date;
  minute: number;
  period: DayPeriodKey;
  discountPct: number | null;
}

export const DEFAULT_SLOT_SETTINGS: SlotSettings = {
  slotStep: 10,
  bufferMinutes: 0,
  minLeadMinutes: 60,
  bookingHorizonDays: 60,
  morningEnabled: true,
  morningStart: '07:00',
  morningEnd: '12:00',
  dayEnabled: true,
  dayStart: '12:00',
  dayEnd: '18:00',
  eveningEnabled: true,
  eveningStart: '18:00',
  eveningEnd: '24:00',
  nightEnabled: false,
  nightStart: '00:00',
  nightEnd: '07:00',
};

const ONLINE_LEAD_MINUTES = 10;

function mergeIntervals(intervals: [number, number][]): [number, number][] {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Pure slot computation for one local day. All comparisons are done on UTC instants. */
export function computeDaySlots(input: SlotEngineInput): ComputedSlot[] {
  const { day, timezone, durationMin, settings, now } = input;
  if (durationMin <= 0) return [];
  const today = localParts(now, timezone);
  if (day < today.day || day > addDaysIso(today.day, settings.bookingHorizonDays)) return [];

  const weekday = isoWeekdayOf(day);
  const working: [number, number][] = input.schedule
    .filter((s) => s.isWorking && s.dayOfWeek === weekday)
    .map((s) => [toMinutes(s.startTime), toMinutes(s.endTime)]);

  const onlineRanges: [number, number][] = [];
  if (input.online && input.online.until > now) {
    const untilParts = localParts(input.online.until, timezone);
    const start = day === today.day ? today.minutes : day > today.day ? 0 : 1440;
    const end = untilParts.day === day ? untilParts.minutes : untilParts.day > day ? 1440 : -1;
    if (end > start) onlineRanges.push([start, end]);
  }
  const intervals = mergeIntervals([...working, ...onlineRanges]);
  if (intervals.length === 0) return [];

  const periods = resolvePeriods(settings);
  const step = Math.max(5, settings.slotStep);
  const buffer = settings.bufferMinutes * 60_000;
  const minStart = now.getTime() + settings.minLeadMinutes * 60_000;
  const minOnlineStart = now.getTime() + ONLINE_LEAD_MINUTES * 60_000;
  const busy = input.busy.map((b) => [b.startAt.getTime(), b.endAt.getTime()] as const);

  const result: ComputedSlot[] = [];
  for (const [from, to] of intervals) {
    for (let minute = Math.ceil(from / step) * step; minute + durationMin <= to; minute += step) {
      const period = periods.find((p) => minute >= p.startMin && minute < p.endMin);
      if (!period || !period.enabled) continue;
      const start = zonedToUtc(day, minute, timezone).getTime();
      const end = start + durationMin * 60_000;
      const inOnline = onlineRanges.some(([a, b]) => minute >= a && minute + durationMin <= b);
      if (start < (inOnline ? Math.min(minStart, minOnlineStart) : minStart)) continue;
      const overlaps = busy.some(([bs, be]) => start < be + buffer && end + buffer > bs);
      if (overlaps) continue;

      let discountPct: number | null = null;
      if (input.promotions?.length) {
        for (const promo of input.promotions) {
          const applies = promotionApplies(promo, {
            serviceIds: input.serviceIds ?? [],
            at: new Date(start),
            localDay: day,
            localMinutes: minute,
            isoWeekday: weekday,
          });
          if (applies && promo.discountPct > (discountPct ?? 0)) discountPct = promo.discountPct;
        }
      }
      result.push({ startAt: new Date(start), minute, period: period.key, discountPct });
    }
  }
  return result;
}

export function groupSlots(
  day: string,
  timezone: string,
  durationMin: number,
  slots: ComputedSlot[],
): SlotsResponse {
  const periods = resolvePeriods();
  const order: DayPeriodKey[] = ['morning', 'day', 'evening', 'night'];
  return {
    date: day,
    timezone,
    durationMin,
    totalSlots: slots.length,
    periods: order
      .map((key) => ({
        key,
        emoji: periods.find((p) => p.key === key)?.emoji ?? '',
        slots: slots
          .filter((s) => s.period === key)
          .map((s) => ({
            startAt: s.startAt.toISOString(),
            time: fromMinutes(s.minute),
            discountPct: s.discountPct,
          })),
      }))
      .filter((p) => p.slots.length > 0),
  };
}

/* ───────────── DB-backed helpers ───────────── */

export interface MasterSlotContext {
  masterId: string;
  timezone: string;
  settings: SlotSettings;
  schedule: ScheduleRow[];
  online: { until: Date } | null;
  promotions: PromotionLike[];
}

export async function loadSlotContext(masterId: string): Promise<MasterSlotContext> {
  const master = await prisma.master.findUnique({
    where: { id: masterId },
    select: {
      id: true,
      timezone: true,
      isOnlineOpen: true,
      onlineOpenUntil: true,
      settings: true,
      schedule: true,
      promotions: { where: { isActive: true } },
    },
  });
  if (!master) throw new NotFoundError();
  return {
    masterId: master.id,
    timezone: master.timezone,
    settings: master.settings
      ? { ...DEFAULT_SLOT_SETTINGS, ...master.settings }
      : DEFAULT_SLOT_SETTINGS,
    schedule: master.schedule,
    online:
      master.isOnlineOpen && master.onlineOpenUntil ? { until: master.onlineOpenUntil } : null,
    promotions: master.promotions,
  };
}

export async function loadBusy(
  masterId: string,
  from: Date,
  to: Date,
  excludeAppointmentId?: string,
): Promise<BusyInterval[]> {
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        masterId,
        status: { in: [...BLOCKING_APPOINTMENT_STATUSES] },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.timeBlock.findMany({
      where: { masterId, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  return [...appointments, ...blocks];
}

export async function resolveServices(masterId: string, serviceIds: string[]) {
  const unique = [...new Set(serviceIds)];
  const services = await prisma.service.findMany({
    where: { id: { in: unique }, masterId, isActive: true, deletedAt: null },
  });
  if (services.length !== unique.length) throw new NotFoundError('Service not found');
  const ordered = unique.map((id) => services.find((s) => s.id === id)!);
  return {
    services: ordered,
    durationMin: ordered.reduce((sum, s) => sum + s.duration, 0),
    totalPrice: ordered.reduce((sum, s) => sum + Number(s.price), 0),
  };
}

export async function getDaySlots(
  masterId: string,
  serviceIds: string[],
  day: string,
  opts: {
    excludeAppointmentId?: string;
    now?: Date;
    ctx?: MasterSlotContext;
    durationMin?: number;
  } = {},
): Promise<{ response: SlotsResponse; slots: ComputedSlot[] }> {
  const now = opts.now ?? new Date();
  const ctx = opts.ctx ?? (await loadSlotContext(masterId));
  const durationMin = opts.durationMin ?? (await resolveServices(masterId, serviceIds)).durationMin;
  const from = startOfLocalDay(addDaysIso(day, -1), ctx.timezone);
  const to = startOfLocalDay(addDaysIso(day, 2), ctx.timezone);
  const busy = await loadBusy(masterId, from, to, opts.excludeAppointmentId);
  const slots = computeDaySlots({
    day,
    timezone: ctx.timezone,
    durationMin,
    settings: ctx.settings,
    schedule: ctx.schedule,
    busy,
    online: ctx.online,
    promotions: ctx.promotions,
    serviceIds,
    now,
  });
  return { response: groupSlots(day, ctx.timezone, durationMin, slots), slots };
}

export async function getAvailability(
  masterId: string,
  serviceIds: string[],
  fromDay: string,
  days: number,
  now: Date = new Date(),
): Promise<{
  timezone: string;
  days: { date: string; available: boolean }[];
  firstAvailable: string | null;
}> {
  const ctx = await loadSlotContext(masterId);
  const { durationMin } = await resolveServices(masterId, serviceIds);
  const lastDay = addDaysIso(fromDay, days - 1);
  const busy = await loadBusy(
    masterId,
    startOfLocalDay(addDaysIso(fromDay, -1), ctx.timezone),
    startOfLocalDay(addDaysIso(lastDay, 2), ctx.timezone),
  );
  const result: { date: string; available: boolean }[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDaysIso(fromDay, i);
    const slots = computeDaySlots({
      day,
      timezone: ctx.timezone,
      durationMin,
      settings: ctx.settings,
      schedule: ctx.schedule,
      busy,
      online: ctx.online,
      now,
    });
    result.push({ date: day, available: slots.length > 0 });
  }
  return {
    timezone: ctx.timezone,
    days: result,
    firstAvailable: result.find((d) => d.available)?.date ?? null,
  };
}

export async function findNearestSlot(
  masterId: string,
  serviceIds: string[],
  opts: { now?: Date; maxDays?: number } = {},
): Promise<ComputedSlot | null> {
  const now = opts.now ?? new Date();
  const ctx = await loadSlotContext(masterId);
  const { durationMin } = await resolveServices(masterId, serviceIds);
  const today = localParts(now, ctx.timezone).day;
  const maxDays = Math.min(opts.maxDays ?? 45, ctx.settings.bookingHorizonDays + 1);
  const busy = await loadBusy(
    masterId,
    startOfLocalDay(addDaysIso(today, -1), ctx.timezone),
    startOfLocalDay(addDaysIso(today, maxDays + 1), ctx.timezone),
  );
  for (let i = 0; i < maxDays; i += 1) {
    const day = addDaysIso(today, i);
    const slots = computeDaySlots({
      day,
      timezone: ctx.timezone,
      durationMin,
      settings: ctx.settings,
      schedule: ctx.schedule,
      busy,
      online: ctx.online,
      promotions: ctx.promotions,
      serviceIds,
      now,
    });
    if (slots[0]) return slots[0];
  }
  return null;
}

/** Validates that `startAt` is one of the offered slots (schedule, buffers, lead time). */
export async function isSlotBookable(
  masterId: string,
  serviceIds: string[],
  startAt: Date,
  opts: { excludeAppointmentId?: string; now?: Date; durationMin?: number } = {},
): Promise<boolean> {
  const ctx = await loadSlotContext(masterId);
  const day = localParts(startAt, ctx.timezone).day;
  const { slots } = await getDaySlots(masterId, serviceIds, day, { ...opts, ctx });
  return slots.some((s) => s.startAt.getTime() === startAt.getTime());
}

/** Plain overlap check used for manual bookings by the master. */
export async function hasOverlap(
  masterId: string,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const busy = await loadBusy(masterId, startAt, endAt, excludeAppointmentId);
  return busy.length > 0;
}
