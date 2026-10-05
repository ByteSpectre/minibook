import { TZDate } from '@date-fns/tz';
import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';
import { enGB, ru } from 'date-fns/locale';
import { formatDuration as fmtDuration, formatMoney, type Language } from '@nail-crm/shared';
import i18n from './i18n';

const lang = (): Language => (i18n.language === 'en' ? 'en' : 'ru');
const locale = () => (lang() === 'ru' ? ru : enGB);
const localeTag = () => (lang() === 'ru' ? 'ru-RU' : 'en-GB');

export const zoned = (iso: string | Date, timezone: string) =>
  new TZDate(new Date(iso).getTime(), timezone);

export function fmt(iso: string | Date, pattern: string, timezone?: string): string {
  const date = timezone ? zoned(iso, timezone) : new Date(iso);
  return format(date, pattern, { locale: locale() });
}

export const formatTime = (iso: string | Date, timezone?: string) => fmt(iso, 'HH:mm', timezone);

export function formatDayLabel(iso: string | Date, timezone?: string): string {
  const date = timezone ? zoned(iso, timezone) : new Date(iso);
  const now = timezone ? zoned(new Date(), timezone) : new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (isSameDay(date, now)) return i18n.t('common.today');
  if (isSameDay(date, tomorrow)) return i18n.t('common.tomorrow');
  return format(date, lang() === 'ru' ? 'd MMMM, EEEEEE' : 'EEE, d MMMM', { locale: locale() });
}

/** "Сегодня" / "Завтра" / "8 окт." */
export function formatShortDayLabel(iso: string | Date, timezone?: string): string {
  const date = timezone ? zoned(iso, timezone) : new Date(iso);
  const now = timezone ? zoned(new Date(), timezone) : new Date();
  if (isSameDay(date, now)) return i18n.t('common.today');
  if (isSameDay(date, new Date(now.getTime() + 86_400_000))) return i18n.t('common.tomorrow');
  return format(date, 'd MMM', { locale: locale() });
}

export const formatDateTime = (iso: string | Date, timezone?: string) =>
  `${formatDayLabel(iso, timezone)}, ${formatTime(iso, timezone)}`;

export const formatDate = (iso: string | Date, timezone?: string) =>
  fmt(iso, lang() === 'ru' ? 'd MMMM yyyy' : 'd MMMM yyyy', timezone);

export const formatShortDate = (iso: string | Date, timezone?: string) =>
  fmt(iso, 'd MMM', timezone);

/** `YYYY-MM-DD` calendar day → localized label. */
export function formatIsoDay(day: string, pattern = 'd MMMM, EEEE'): string {
  const [y, m, d] = day.split('-').map(Number);
  return format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1), pattern, { locale: locale() });
}

export const formatPrice = (amount: number | null | undefined, currency = 'RUB') =>
  amount === null || amount === undefined ? '—' : formatMoney(amount, currency, localeTag());

export const formatDuration = (minutes: number) => fmtDuration(minutes, lang());

export const fromNow = (iso: string | Date) =>
  formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: locale() });

/** Today as `YYYY-MM-DD` in a timezone. */
export function todayIn(timezone: string): string {
  return format(zoned(new Date(), timezone), 'yyyy-MM-dd');
}

/** Local wall-clock day + `HH:mm` in a timezone → ISO instant. */
export function zonedIso(day: string, time: string, timezone: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new TZDate(
    y ?? 1970,
    (m ?? 1) - 1,
    d ?? 1,
    hh ?? 0,
    mm ?? 0,
    0,
    0,
    timezone,
  ).toISOString();
}

export function isoDayOf(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function dateFromIsoDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export const pluralKey = (count: number) => ({ count });

export const dateLocale = locale;
