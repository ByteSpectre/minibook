import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { addDaysIso } from '@nail-crm/shared';
import { useAvailability, useSlots } from '@/api/publicApi';
import { GlassCalendar, TimeSlotGrid, useAvailableSet } from '@/components/domain/booking';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIsoDay, todayIn } from '@/lib/format';

export function SlotPicker({
  slug,
  serviceIds,
  timezone,
  day,
  onDayChange,
  value,
  onChange,
}: {
  slug: string;
  serviceIds: string[];
  timezone: string;
  day: string | null;
  onDayChange: (day: string) => void;
  value: string | null;
  onChange: (startAt: string) => void;
}) {
  const { t } = useTranslation();
  const today = useMemo(() => todayIn(timezone), [timezone]);
  const availability = useAvailability(slug, serviceIds, today);
  const available = useAvailableSet(availability.data?.days);
  const slots = useSlots(slug, serviceIds, day);

  useEffect(() => {
    if (!day && availability.data?.firstAvailable) onDayChange(availability.data.firstAvailable);
  }, [day, availability.data?.firstAvailable, onDayChange]);

  return (
    <div className="flex flex-col gap-4">
      {availability.isLoading ? (
        <Skeleton className="h-[380px] w-full rounded-3xl bg-muted" />
      ) : (
        <GlassCalendar
          value={day}
          onChange={onDayChange}
          availableDays={available}
          minDay={today}
          maxDay={addDaysIso(today, 41)}
        />
      )}
      {day ? (
        <div className="flex flex-col gap-3">
          <h3 className="px-1 text-[17px] font-semibold capitalize">{formatIsoDay(day)}</h3>
          {slots.isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-11 rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <TimeSlotGrid data={slots.data} value={value} onChange={onChange} />
          )}
        </div>
      ) : availability.data && !availability.data.firstAvailable ? (
        <p className="text-center text-[14px] text-muted-foreground">
          {t('components.calendar.noSlots')}
        </p>
      ) : null}
    </div>
  );
}
