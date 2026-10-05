import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SlotsResponse } from '@nail-crm/shared';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import { Calendar } from '@/components/ui/calendar';
import { GlassCard } from '@/components/ui/glass';
import { dateFromIsoDay, dateLocale, isoDayOf } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

/** Calendar with availability dots; unavailable days are disabled. */
export function GlassCalendar({
  value,
  onChange,
  availableDays,
  minDay,
  maxDay,
  className,
}: {
  value: string | null;
  onChange: (day: string) => void;
  availableDays?: Set<string> | null;
  minDay?: string;
  maxDay?: string;
  className?: string;
}) {
  const selected = value ? dateFromIsoDay(value) : undefined;
  const min = minDay ? dateFromIsoDay(minDay) : undefined;
  const max = maxDay ? dateFromIsoDay(maxDay) : undefined;
  return (
    <GlassCard className={cn('flex justify-center p-2', className)}>
      <Calendar
        mode="single"
        locale={dateLocale()}
        weekStartsOn={1}
        selected={selected}
        defaultMonth={selected ?? min}
        startMonth={min}
        endMonth={max}
        onSelect={(date) => {
          if (!date) return;
          haptic.select();
          onChange(isoDayOf(date));
        }}
        disabled={[
          ...(min ? [{ before: min }] : []),
          ...(max ? [{ after: max }] : []),
          ...(availableDays ? [(d: Date) => !availableDays.has(isoDayOf(d))] : []),
        ]}
        modifiers={
          availableDays ? { available: (d: Date) => availableDays.has(isoDayOf(d)) } : undefined
        }
        modifiersClassNames={{
          available:
            'relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary',
        }}
        className="w-full bg-transparent p-1 [--cell-radius:14px] [--cell-size:--spacing(11)]"
        classNames={{ root: 'w-full', months: 'w-full', month: 'w-full', month_grid: 'w-full' }}
      />
    </GlassCard>
  );
}

export function TimeSlotGrid({
  data,
  value,
  onChange,
  className,
}: {
  data: SlotsResponse | undefined;
  value: string | null;
  onChange: (startAt: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!data) return null;
  if (data.totalSlots === 0) {
    return (
      <GlassCard className={cn('py-6 text-center', className)}>
        <div className="text-[15px] font-medium">{t('components.slots.empty')}</div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {t('components.slots.emptyHint')}
        </div>
      </GlassCard>
    );
  }
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {data.periods.map((period) => (
        <section key={period.key}>
          <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted-foreground">
            <MonoEmoji>{period.emoji}</MonoEmoji>
            {t(`enums.period.${period.key}`)}
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {period.slots.map((slot) => {
              const active = slot.startAt === value;
              return (
                <button
                  key={slot.startAt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    haptic.select();
                    onChange(slot.startAt);
                  }}
                  className={cn(
                    'relative flex h-11 items-center justify-center rounded-2xl text-[15px] font-semibold tabular-nums transition-all active:scale-95',
                    active ? 'bg-foreground text-background shadow-lg' : 'glass',
                  )}
                >
                  {slot.time}
                  {slot.discountPct ? (
                    <span className="absolute -top-1.5 -right-1 rounded-full bg-brand px-1 text-[10px] leading-4 font-bold text-white">
                      {t('components.slots.discount', { pct: slot.discountPct })}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function useAvailableSet(days?: { date: string; available: boolean }[]) {
  return useMemo(
    () => (days ? new Set(days.filter((d) => d.available).map((d) => d.date)) : null),
    [days],
  );
}
