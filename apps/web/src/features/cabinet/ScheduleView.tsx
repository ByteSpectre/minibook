import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Settings2,
  Unlock,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { addDaysIso, isoWeekdayOf, type MasterAppointmentDto } from '@nail-crm/shared';
import {
  useSaveWeeklySchedule,
  useScheduleDay,
  useScheduleOverview,
  useTimeBlockMutations,
  useWeeklySchedule,
  type CabinetBase,
} from '@/api/cabinetApi';
import { EmptyState, ListSkeleton } from '@/components/layout/states';
import { StatusBadge } from '@/components/domain/badges';
import { GlassCalendar } from '@/components/domain/booking';
import { Chip, GlassButton, GlassCard, GlassSheet } from '@/components/ui/glass';
import { formatIsoDay, formatPrice, formatTime, todayIn } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { AppointmentSheet, NewAppointmentSheet, TimeBlockSheet } from './AppointmentSheets';
import { DEFAULT_WEEK, toWeeklyInput, WeeklyScheduleEditor } from './WeeklyScheduleEditor';

const STATUS_BAR: Record<MasterAppointmentDto['status'], string> = {
  PENDING: 'bg-muted-foreground/50',
  CONFIRMED: 'bg-foreground/70',
  COMPLETED: 'bg-foreground',
  CANCELLED: 'bg-muted-foreground/40',
  NO_SHOW: 'bg-destructive/80',
};

function WeeklySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const weekly = useWeeklySchedule();
  const save = useSaveWeeklySchedule();
  const [days, setDays] = useState(DEFAULT_WEEK);
  useEffect(() => {
    if (weekly.data && open) setDays(weekly.data);
  }, [weekly.data, open]);
  return (
    <GlassSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('master.schedule.weekly')}
      description={t('master.schedule.weeklyHint')}
      footer={
        <GlassButton
          variant="primary"
          size="lg"
          block
          loading={save.isPending}
          onClick={() =>
            save.mutate(toWeeklyInput(days), {
              onSuccess: () => (toast.success(t('master.schedule.saved')), onClose()),
            })
          }
        >
          {t('common.save')}
        </GlassButton>
      }
    >
      <WeeklyScheduleEditor value={days} onChange={setDays} />
    </GlassSheet>
  );
}

export function ScheduleView({
  base,
  timezone,
  currency,
  masters,
  canWrite = true,
}: {
  base: CabinetBase;
  timezone: string;
  currency: string;
  masters?: {
    id: string;
    name: string;
    services: { id: string; name: string; price: number; duration: number }[];
  }[];
  canWrite?: boolean;
}) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const today = todayIn(timezone);
  const [day, setDay] = useState(params.get('date') ?? today);
  const [masterId, setMasterId] = useState<string | undefined>(params.get('master') ?? undefined);
  const [openId, setOpenId] = useState<string | null>(params.get('appointment'));
  const [calendar, setCalendar] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const dayQuery = useScheduleDay(base, day, masterId);
  const weekStart = useMemo(() => addDaysIso(day, -(isoWeekdayOf(day) - 1)), [day]);
  const overview = useScheduleOverview(base, addDaysIso(weekStart, -7), masterId);
  const counts = useMemo(
    () => new Map((overview.data ?? []).map((o) => [o.date, o])),
    [overview.data],
  );
  const blocks = useTimeBlockMutations();
  const isMaster = base === '/api/master';

  const select = (d: string) => {
    haptic.select();
    setDay(d);
    setParams({ date: d }, { replace: true });
  };
  const data = dayQuery.data;
  const opened = data?.appointments.find((a) => a.id === openId) ?? null;

  return (
    <>
      {masters && masters.length > 1 ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!masterId} onClick={() => setMasterId(undefined)}>
            {t('master.schedule.allMasters')}
          </Chip>
          {masters.map((m) => (
            <Chip key={m.id} active={masterId === m.id} onClick={() => setMasterId(m.id)}>
              {m.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <GlassCard className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            aria-label={t('common.back')}
            onClick={() => select(addDaysIso(day, -7))}
            className="flex size-9 items-center justify-center rounded-full active:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCalendar(true)}
            className="flex items-center gap-1.5 text-[15px] font-semibold capitalize"
          >
            <CalendarDays className="size-4 text-primary" /> {formatIsoDay(weekStart, 'LLLL yyyy')}
          </button>
          <button
            type="button"
            aria-label={t('common.next')}
            onClick={() => select(addDaysIso(day, 7))}
            className="flex size-9 items-center justify-center rounded-full active:bg-muted"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)).map((d) => {
            const c = counts.get(d);
            const active = d === day;
            return (
              <button
                key={d}
                type="button"
                onClick={() => select(d)}
                aria-pressed={active}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all',
                  active ? 'bg-foreground text-background shadow-lg' : 'active:bg-muted',
                  d === today && !active && 'ring-1 ring-primary',
                )}
              >
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    active ? 'opacity-80' : 'text-muted-foreground',
                  )}
                >
                  {t(`common.weekdaysShort.${String(isoWeekdayOf(d)) as '1'}`)}
                </span>
                <span className="text-[17px] font-semibold tabular-nums">{Number(d.slice(8))}</span>
                <span className="flex h-1.5 gap-0.5">
                  {c
                    ? Array.from({ length: Math.min(c.count, 4) }, (_, k) => (
                        <span
                          key={k}
                          className={cn(
                            'size-1.5 rounded-full',
                            c.pending > k
                              ? 'bg-muted-foreground'
                              : active
                                ? 'bg-background/80'
                                : 'bg-primary',
                          )}
                        />
                      ))
                    : null}
                </span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-semibold capitalize">
            {formatIsoDay(day, 'd MMMM, EEEE')}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {data?.working.length
              ? t('master.schedule.working', {
                  hours: data.working.map((w) => `${w.start}–${w.end}`).join(', '),
                })
              : t('master.schedule.dayOff')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isMaster ? (
            <GlassButton
              size="icon"
              aria-label={t('master.schedule.weekly')}
              onClick={() => setWeekly(true)}
            >
              <Settings2 />
            </GlassButton>
          ) : null}
          {isMaster && canWrite ? (
            <GlassButton
              size="icon"
              aria-label={t('master.dashboard.blockTime')}
              onClick={() => setBlockOpen(true)}
            >
              <Lock />
            </GlassButton>
          ) : null}
          {canWrite ? (
            <GlassButton
              size="icon"
              variant="primary"
              aria-label={t('master.schedule.newAppointment')}
              onClick={() => setNewOpen(true)}
            >
              <Plus />
            </GlassButton>
          ) : null}
        </div>
      </div>

      {dayQuery.isLoading ? (
        <ListSkeleton count={3} />
      ) : !data || (data.appointments.length === 0 && data.timeBlocks.length === 0) ? (
        <EmptyState emoji="✦" title={t('master.schedule.empty')} />
      ) : (
        <div className="flex flex-col gap-2">
          {[
            ...data.appointments.map((a) => ({ kind: 'appointment' as const, at: a.startAt, a })),
            ...data.timeBlocks.map((b) => ({ kind: 'block' as const, at: b.startAt, b })),
          ]
            .sort((x, y) => x.at.localeCompare(y.at))
            .map((item) =>
              item.kind === 'appointment' ? (
                <GlassCard
                  key={item.a.id}
                  interactive
                  onClick={() => setOpenId(item.a.id)}
                  className={cn(
                    'relative flex cursor-pointer gap-3 overflow-hidden p-3 pl-4',
                    (item.a.status === 'CANCELLED' || item.a.status === 'NO_SHOW') && 'opacity-60',
                  )}
                >
                  <span
                    className={cn('absolute inset-y-0 left-0 w-1.5', STATUS_BAR[item.a.status])}
                  />
                  <div className="w-14 shrink-0">
                    <div className="text-[16px] font-semibold tabular-nums">
                      {formatTime(item.a.startAt, timezone)}
                    </div>
                    <div className="text-[12px] text-muted-foreground tabular-nums">
                      {formatTime(item.a.endAt, timezone)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">
                        {item.a.client.firstName ?? '—'}
                      </span>
                      {item.a.client.isNew ? (
                        <span className="rounded-full border border-border bg-muted px-1.5 text-[10px] font-semibold">
                          NEW
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[13px] text-muted-foreground">
                      {masters ? `${item.a.masterName} · ` : ''}
                      {item.a.services.map((s) => s.name).join(', ')}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={item.a.status} />
                      {item.a.clientConfirmedAt ? (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          ✓ {t('client.calendar.visitConfirmed')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[14px] font-semibold">
                    {formatPrice(item.a.price, currency)}
                  </div>
                </GlassCard>
              ) : (
                <GlassCard
                  key={item.b.id}
                  className="flex items-center gap-3 bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,var(--muted)_8px,var(--muted)_16px)] p-3"
                >
                  <Lock className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1 text-[14px]">
                    <span className="font-semibold tabular-nums">
                      {formatTime(item.b.startAt, timezone)}–{formatTime(item.b.endAt, timezone)}
                    </span>{' '}
                    · {item.b.reason || t('master.schedule.block')}
                  </div>
                  {isMaster && canWrite ? (
                    <GlassButton
                      size="icon-sm"
                      aria-label={t('master.schedule.unblock')}
                      onClick={() => blocks.remove.mutate(item.b.id)}
                    >
                      <Unlock />
                    </GlassButton>
                  ) : null}
                </GlassCard>
              ),
            )}
        </div>
      )}

      <GlassSheet open={calendar} onOpenChange={setCalendar} title={t('master.schedule.date')}>
        <GlassCalendar value={day} onChange={(d) => (select(d), setCalendar(false))} />
      </GlassSheet>
      <AppointmentSheet
        appointment={opened}
        timezone={timezone}
        currency={currency}
        base={base}
        onClose={() => (setOpenId(null), setParams({ date: day }, { replace: true }))}
      />
      <NewAppointmentSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        base={base}
        timezone={timezone}
        currency={currency}
        masters={masters}
        defaultDay={day}
      />
      {isMaster ? (
        <>
          <TimeBlockSheet
            open={blockOpen}
            onClose={() => setBlockOpen(false)}
            timezone={timezone}
            defaultDay={day}
          />
          <WeeklySheet open={weekly} onClose={() => setWeekly(false)} />
        </>
      ) : null}
    </>
  );
}
