import { TZDate } from '@date-fns/tz';
import { format, getISODay } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { addDaysIso, type Language } from '@nail-crm/shared';

export interface LocalParts {
  /** `YYYY-MM-DD` in the given timezone. */
  day: string;
  /** Minutes since local midnight. */
  minutes: number;
  /** ISO weekday 1..7. */
  isoWeekday: number;
  hhmm: string;
}

export function localParts(date: Date, timezone: string): LocalParts {
  const z = new TZDate(date.getTime(), timezone);
  return {
    day: format(z, 'yyyy-MM-dd'),
    minutes: z.getHours() * 60 + z.getMinutes(),
    isoWeekday: getISODay(z),
    hhmm: format(z, 'HH:mm'),
  };
}

export const localDay = (date: Date, timezone: string): string => localParts(date, timezone).day;

/** Converts a local calendar day + minutes (1440 = next midnight) in `timezone` to UTC. */
export function zonedToUtc(day: string, minutes: number, timezone: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const dayOffset = Math.floor(minutes / 1440);
  const rest = minutes - dayOffset * 1440;
  const z = new TZDate(
    y ?? 1970,
    (m ?? 1) - 1,
    (d ?? 1) + dayOffset,
    Math.floor(rest / 60),
    rest % 60,
    0,
    0,
    timezone,
  );
  return new Date(z.getTime());
}

export const startOfLocalDay = (day: string, timezone: string): Date =>
  zonedToUtc(day, 0, timezone);
export const endOfLocalDay = (day: string, timezone: string): Date =>
  zonedToUtc(addDaysIso(day, 1), 0, timezone);

const locales = { ru, en: enUS };

export function fmtDate(date: Date, timezone: string, lang: Language): string {
  const z = new TZDate(date.getTime(), timezone);
  return format(z, lang === 'ru' ? 'd MMMM, EEEEEE' : 'EEE, d MMMM', { locale: locales[lang] });
}

export function fmtTime(date: Date, timezone: string): string {
  return format(new TZDate(date.getTime(), timezone), 'HH:mm');
}

export function fmtDateTime(date: Date, timezone: string, lang: Language): string {
  return `${fmtDate(date, timezone, lang)}, ${fmtTime(date, timezone)}`;
}

export function fmtShortDate(date: Date, timezone: string, lang: Language): string {
  return format(new TZDate(date.getTime(), timezone), 'd MMM yyyy', { locale: locales[lang] });
}

export const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);
export const addHours = (date: Date, hours: number): Date => addMinutes(date, hours * 60);
export const addDays = (date: Date, days: number): Date => addMinutes(date, days * 1440);
