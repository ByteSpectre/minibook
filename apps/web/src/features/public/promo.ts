import type { TFunction } from 'i18next';
import type { PromotionDto } from '@nail-crm/shared';
import { formatShortDate } from '@/lib/format';

/** "по будням до 14:00 · до 15 нояб." */
export function promotionConditions(t: TFunction, p: PromotionDto, timezone?: string): string {
  const days = [...p.daysOfWeek].sort().join(',');
  const parts: string[] = [];
  if (days === '1,2,3,4,5') parts.push(t('public.weekdays'));
  else if (days === '6,7') parts.push(t('public.weekends'));
  else if (p.daysOfWeek.length > 0)
    parts.push(p.daysOfWeek.map((d) => t(`common.weekdaysShort.${String(d) as '1'}`)).join(', '));
  if (p.timeFrom && p.timeTo) parts.push(t('public.timeRange', { from: p.timeFrom, to: p.timeTo }));
  else if (p.timeTo) parts.push(t('public.untilTime', { time: p.timeTo }));
  else if (p.timeFrom) parts.push(t('public.fromTime', { time: p.timeFrom }));
  parts.push(t('public.validUntil', { date: formatShortDate(p.validTo, timezone) }));
  return parts.join(' · ');
}
