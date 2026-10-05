import {
  BellRing,
  CalendarPlus,
  ChevronRight,
  Lock,
  Megaphone,
  Percent,
  Radio,
  Zap,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AccessDto } from '@nail-crm/shared';
import {
  useClientMutations,
  useDashboard,
  useOnlineToggle,
  type CabinetBase,
} from '@/api/cabinetApi';
import { ErrorState, ListSkeleton } from '@/components/layout/states';
import { SubscriptionBanner } from '@/components/domain/subscription';
import { GlassButton, GlassCard, SectionTitle, StatTile } from '@/components/ui/glass';
import { Progress } from '@/components/ui/progress';
import { formatDayLabel, formatPrice, formatTime } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { AgeBars, GenderPie, RevenueChart, WeekdayBars } from './charts';
import { NewAppointmentSheet, TimeBlockSheet } from './AppointmentSheets';

export function DashboardView({
  base,
  access,
  header,
  salonMasters,
}: {
  base: CabinetBase;
  access?: AccessDto;
  header?: ReactNode;
  salonMasters?: {
    id: string;
    name: string;
    services: { id: string; name: string; price: number; duration: number }[];
  }[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: d, isLoading, isError, refetch } = useDashboard(base);
  const online = useOnlineToggle();
  const { remind } = useClientMutations(base);
  const [newOpen, setNewOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const isMaster = base === '/api/master';
  const cabinet = isMaster ? '/master' : '/salon';

  if (isLoading) return <ListSkeleton count={4} />;
  if (isError || !d) return <ErrorState onRetry={() => void refetch()} />;
  const canWrite = access?.canWrite ?? true;

  return (
    <>
      {access ? <SubscriptionBanner access={access} to={`${cabinet}/subscription`} /> : null}
      {header}
      {d.pendingCount > 0 ? (
        <Link to={`${cabinet}/schedule`}>
          <GlassCard
            interactive
            className="flex items-center gap-3 bg-gradient-to-r from-amber-400/20 to-orange-400/10 p-3.5"
          >
            <BellRing className="size-5 text-amber-600" />
            <span className="flex-1 text-[14px] font-medium">
              {t('master.dashboard.pending', { count: d.pendingCount })}
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </GlassCard>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t('master.dashboard.today')} value={d.todayCount} />
        <StatTile label={t('master.dashboard.weekClients')} value={d.weekClients} />
        <StatTile
          label={t('master.dashboard.monthRevenue')}
          value={formatPrice(d.monthRevenue, d.currency)}
        />
        <StatTile
          label={t('master.dashboard.avgCheck')}
          value={formatPrice(d.avgCheck, d.currency)}
        />
      </div>

      <GlassCard className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[14px] font-medium">
          <span>{t('master.dashboard.monthLoad', { pct: d.monthLoadPct })}</span>
          <span className="text-muted-foreground">{d.monthLoadPct}%</span>
        </div>
        <Progress value={d.monthLoadPct} className="h-2.5 bg-muted [&>div]:bg-brand" />
      </GlassCard>

      {canWrite ? (
        <section>
          <SectionTitle>{t('master.dashboard.quickActions')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <GlassButton
              className="h-auto min-h-14 flex-col gap-1 py-3"
              onClick={() => setNewOpen(true)}
            >
              <CalendarPlus />{' '}
              <span className="text-[13px]">{t('master.dashboard.newAppointment')}</span>
            </GlassButton>
            {isMaster ? (
              <GlassButton
                className="h-auto min-h-14 flex-col gap-1 py-3"
                onClick={() => setBlockOpen(true)}
              >
                <Lock /> <span className="text-[13px]">{t('master.dashboard.blockTime')}</span>
              </GlassButton>
            ) : null}
            {isMaster ? (
              d.isOnlineOpen ? (
                <GlassButton
                  variant="soft"
                  className="col-span-2 h-auto min-h-14 py-3"
                  loading={online.close.isPending}
                  onClick={() => online.close.mutate()}
                >
                  <Radio className="text-emerald-500" />
                  <span className="text-left text-[13px] whitespace-normal">
                    {t('master.dashboard.onlineActive', {
                      time: d.onlineOpenUntil ? formatTime(d.onlineOpenUntil, d.timezone) : '',
                    })}
                    <br />
                    <b>{t('master.dashboard.closeOnline')}</b>
                  </span>
                </GlassButton>
              ) : (
                <GlassButton
                  variant="primary"
                  className="col-span-2 h-auto min-h-14 py-3"
                  loading={online.open.isPending}
                  onClick={() =>
                    online.open.mutate(undefined, {
                      onSuccess: () => {
                        haptic.notify('success');
                        toast.success(t('master.dashboard.onlineOpened'));
                      },
                    })
                  }
                >
                  <Zap />
                  <span className="text-left text-[13px]">
                    <b>{t('master.dashboard.openOnline')}</b>
                    <br />
                    {t('master.dashboard.openOnlineHint')}
                  </span>
                </GlassButton>
              )
            ) : null}
            <GlassButton
              className="h-auto min-h-14 flex-col gap-1 py-3"
              onClick={() => navigate(`${cabinet}/broadcast`)}
            >
              <Megaphone /> <span className="text-[13px]">{t('master.dashboard.broadcast')}</span>
            </GlassButton>
            <GlassButton
              className="h-auto min-h-14 flex-col gap-1 py-3"
              onClick={() => navigate(`${cabinet}/promotions`)}
            >
              <Percent /> <span className="text-[13px]">{t('master.dashboard.sendPromo')}</span>
            </GlassButton>
          </div>
        </section>
      ) : null}

      <GlassCard>
        <h3 className="mb-2 text-[15px] font-semibold">{t('master.dashboard.revenue30')}</h3>
        <RevenueChart data={d.revenue30d} currency={d.currency} />
      </GlassCard>

      {d.upcoming.length ? (
        <section>
          <SectionTitle
            action={
              <Link
                to={`${cabinet}/schedule`}
                className="flex items-center text-[14px] font-medium text-primary"
              >
                {t('nav.schedule')} <ChevronRight className="size-4" />
              </Link>
            }
          >
            {t('master.dashboard.upcoming')}
          </SectionTitle>
          <GlassCard className="flex flex-col divide-y divide-border p-0">
            {d.upcoming.map((a) => (
              <Link
                key={a.id}
                to={`${cabinet}/schedule?date=${a.startAt.slice(0, 10)}&appointment=${a.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-muted"
              >
                <div className="w-14 shrink-0 text-center">
                  <div className="text-[16px] font-semibold tabular-nums">
                    {formatTime(a.startAt, d.timezone)}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatDayLabel(a.startAt, d.timezone).split(',')[0]}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{a.client.firstName}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {!isMaster ? `${a.masterName} · ` : ''}
                    {a.services.map((s) => s.name).join(', ')}
                  </div>
                </div>
                <span
                  className={
                    a.status === 'PENDING'
                      ? 'size-2.5 rounded-full bg-amber-500'
                      : 'size-2.5 rounded-full bg-emerald-500'
                  }
                />
              </Link>
            ))}
          </GlassCard>
        </section>
      ) : null}

      <GlassCard>
        <h3 className="mb-2 text-[15px] font-semibold">{t('master.dashboard.loadByWeekday')}</h3>
        <WeekdayBars data={d.loadByWeekday} />
      </GlassCard>

      <div className="grid grid-cols-1 gap-3">
        <GlassCard>
          <h3 className="mb-2 text-[15px] font-semibold">{t('master.dashboard.topServices')}</h3>
          {d.topServices.length ? (
            <ol className="flex flex-col gap-2">
              {d.topServices.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 text-[14px]">
                  <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-muted-foreground">{s.count}×</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted-foreground">{t('master.dashboard.noData')}</p>
          )}
        </GlassCard>
        <GlassCard>
          <h3 className="mb-2 text-[15px] font-semibold">{t('master.dashboard.topClients')}</h3>
          {d.topClients.length ? (
            <ol className="flex flex-col gap-2">
              {d.topClients.map((c, i) => (
                <li key={c.id}>
                  <Link
                    to={`${cabinet}/clients/${c.id}`}
                    className="flex items-center gap-3 text-[14px]"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground">
                      {formatPrice(c.spent, d.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted-foreground">{t('master.dashboard.noData')}</p>
          )}
        </GlassCard>
      </div>

      {d.sleepingClients.length ? (
        <section>
          <SectionTitle>
            {t('master.dashboard.sleeping')}{' '}
            <span className="text-[13px] font-normal text-muted-foreground">
              · {t('master.dashboard.sleepingHint')}
            </span>
          </SectionTitle>
          <GlassCard className="flex flex-col divide-y divide-border p-0">
            {d.sleepingClients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link to={`${cabinet}/clients/${c.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{c.name}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {t('master.dashboard.daysAgo', { count: c.daysSince })}
                  </div>
                </Link>
                {c.hasTelegram && canWrite ? (
                  <GlassButton
                    size="sm"
                    variant="soft"
                    loading={remind.isPending && remind.variables?.id === c.id}
                    onClick={() =>
                      remind.mutate(
                        { id: c.id },
                        { onSuccess: () => toast.success(t('master.dashboard.reminded')) },
                      )
                    }
                  >
                    {t('master.dashboard.remind')}
                  </GlassButton>
                ) : null}
              </div>
            ))}
          </GlassCard>
        </section>
      ) : null}

      <GlassCard className="flex flex-col gap-3">
        <h3 className="text-[15px] font-semibold">{t('master.dashboard.demographics')}</h3>
        <GenderPie data={d.gender} />
        <AgeBars data={d.ages} />
      </GlassCard>

      <NewAppointmentSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        base={base}
        timezone={d.timezone}
        currency={d.currency}
        masters={salonMasters}
      />
      {isMaster ? (
        <TimeBlockSheet
          open={blockOpen}
          onClose={() => setBlockOpen(false)}
          timezone={d.timezone}
        />
      ) : null}
    </>
  );
}
