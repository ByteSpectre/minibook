import { DEFAULT_DAY_PERIODS, type DayPeriodDefinition } from '../constants';
import type { DayPeriodKey } from '../enums';

export const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `HH:mm` → minutes since midnight. `24:00` is 1440. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === (m ?? 1) - 1 && date.getUTCDate() === d
  );
}

/** Formats a UTC-midnight date (e.g. a Postgres `date`) as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isoDateToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function ageFromBirthday(birthday: string | Date, now: Date = new Date()): number {
  const b = typeof birthday === 'string' ? isoDateToUtc(birthday) : birthday;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Smallest distance in days between a calendar day (`YYYY-MM-DD`) and the birthday's
 * anniversary in the surrounding years.
 */
export function daysFromBirthday(birthday: string | Date, day: string): number {
  const b = typeof birthday === 'string' ? isoDateToUtc(birthday) : birthday;
  const target = isoDateToUtc(day);
  const year = target.getUTCFullYear();
  const candidates = [year - 1, year, year + 1].map((y) => {
    const month = b.getUTCMonth();
    // Feb 29 birthdays fall back to Feb 28 in non-leap years.
    const date = Math.min(b.getUTCDate(), new Date(Date.UTC(y, month + 1, 0)).getUTCDate());
    return Date.UTC(y, month, date);
  });
  return Math.min(
    ...candidates.map((ts) => Math.abs(Math.round((ts - target.getTime()) / 86400000))),
  );
}

export interface PeriodConfig {
  morningEnabled: boolean;
  morningStart: string;
  morningEnd: string;
  dayEnabled: boolean;
  dayStart: string;
  dayEnd: string;
  eveningEnabled: boolean;
  eveningStart: string;
  eveningEnd: string;
  nightEnabled: boolean;
  nightStart: string;
  nightEnd: string;
}

export interface ResolvedPeriod extends DayPeriodDefinition {
  enabled: boolean;
  startMin: number;
  endMin: number;
}

export function resolvePeriods(config?: Partial<PeriodConfig> | null): ResolvedPeriod[] {
  return DEFAULT_DAY_PERIODS.map((def) => {
    const enabled =
      (config?.[`${def.key}Enabled` as const] as boolean | undefined) ?? def.key !== 'night';
    const start = (config?.[`${def.key}Start` as const] as string | undefined) ?? def.start;
    const end = (config?.[`${def.key}End` as const] as string | undefined) ?? def.end;
    return { ...def, enabled, start, end, startMin: toMinutes(start), endMin: toMinutes(end) };
  });
}

export function periodOfMinute(
  minute: number,
  periods: ResolvedPeriod[],
): ResolvedPeriod | undefined {
  return periods.find((p) => minute >= p.startMin && minute < p.endMin);
}

export function periodKeyOfMinute(minute: number): DayPeriodKey {
  return periodOfMinute(minute, resolvePeriods())?.key ?? 'day';
}

export function addDaysIso(day: string, days: number): string {
  const date = isoDateToUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a `YYYY-MM-DD` calendar day. */
export function isoWeekdayOf(day: string): number {
  const dow = isoDateToUtc(day).getUTCDay();
  return dow === 0 ? 7 : dow;
}
