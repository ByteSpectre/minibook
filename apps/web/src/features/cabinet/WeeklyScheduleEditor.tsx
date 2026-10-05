import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ScheduleDayDto } from '@nail-crm/shared';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/ui/glass';
import { cn } from '@/lib/utils';

export const DEFAULT_WEEK: ScheduleDayDto[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  dayOfWeek: d,
  isWorking: d <= 6,
  intervals: d <= 6 ? [{ start: '10:00', end: '20:00' }] : [],
}));

const timeInput =
  'h-10 w-[92px] rounded-xl border border-border bg-background/60 px-2 text-center text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-ring';

export function WeeklyScheduleEditor({
  value,
  onChange,
}: {
  value: ScheduleDayDto[];
  onChange: (days: ScheduleDayDto[]) => void;
}) {
  const { t } = useTranslation();
  const update = (dayOfWeek: number, patch: Partial<ScheduleDayDto>) =>
    onChange(value.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));

  return (
    <GlassCard className="flex flex-col divide-y divide-border p-0">
      {value.map((day) => (
        <div key={day.dayOfWeek} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <span
              className={cn('text-[15px] font-medium', !day.isWorking && 'text-muted-foreground')}
            >
              {t(`common.weekdaysLong.${String(day.dayOfWeek) as '1'}`)}
            </span>
            <Switch
              checked={day.isWorking}
              aria-label={t(`common.weekdaysLong.${String(day.dayOfWeek) as '1'}`)}
              onCheckedChange={(isWorking) =>
                update(day.dayOfWeek, {
                  isWorking,
                  intervals:
                    isWorking && day.intervals.length === 0
                      ? [{ start: '10:00', end: '20:00' }]
                      : day.intervals,
                })
              }
            />
          </div>
          {day.isWorking ? (
            <div className="flex flex-col gap-2">
              {day.intervals.map((interval, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    step={600}
                    value={interval.start}
                    aria-label={t('master.schedule.from')}
                    className={timeInput}
                    onChange={(e) =>
                      update(day.dayOfWeek, {
                        intervals: day.intervals.map((x, j) =>
                          j === i ? { ...x, start: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <span className="text-muted-foreground">—</span>
                  <input
                    type="time"
                    step={600}
                    value={interval.end === '24:00' ? '23:59' : interval.end}
                    aria-label={t('master.schedule.to')}
                    className={timeInput}
                    onChange={(e) =>
                      update(day.dayOfWeek, {
                        intervals: day.intervals.map((x, j) =>
                          j === i ? { ...x, end: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  {day.intervals.length > 1 ? (
                    <button
                      type="button"
                      aria-label={t('common.remove')}
                      className="flex size-9 items-center justify-center rounded-full bg-muted"
                      onClick={() =>
                        update(day.dayOfWeek, {
                          intervals: day.intervals.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              {day.intervals.length < 3 ? (
                <button
                  type="button"
                  className="flex h-8 items-center gap-1 self-start text-[13px] font-medium text-primary"
                  onClick={() =>
                    update(day.dayOfWeek, {
                      intervals: [...day.intervals, { start: '14:00', end: '18:00' }],
                    })
                  }
                >
                  <Plus className="size-4" /> {t('master.schedule.addInterval')}
                </button>
              ) : null}
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">{t('master.schedule.dayOff')}</span>
          )}
        </div>
      ))}
    </GlassCard>
  );
}

export function toWeeklyInput(days: ScheduleDayDto[]) {
  return {
    days: days.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      isWorking: d.isWorking,
      intervals: d.isWorking
        ? d.intervals.map((i) => ({ start: i.start, end: i.end === '23:59' ? '24:00' : i.end }))
        : [],
    })),
  };
}
