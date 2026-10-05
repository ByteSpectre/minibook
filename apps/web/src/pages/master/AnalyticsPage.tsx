import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalytics, type CabinetBase } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ErrorState, ListSkeleton } from '@/components/layout/states';
import { Chip, GlassCard, StatTile } from '@/components/ui/glass';
import { AgeBars, GenderPie, HourBars, RevenueChart, WeekdayBars } from '@/features/cabinet/charts';
import { formatPrice } from '@/lib/format';

export function AnalyticsView({ base }: { base: CabinetBase }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const { data: a, isLoading, isError, refetch } = useAnalytics(base, days);
  return (
    <>
      <div className="flex gap-2">
        {[7, 30, 90, 365].map((d) => (
          <Chip key={d} active={days === d} onClick={() => setDays(d)}>
            {t('master.analytics.period', { days: d })}
          </Chip>
        ))}
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : isError || !a ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label={t('master.analytics.revenue')}
              value={formatPrice(a.totals.revenue, a.currency)}
            />
            <StatTile
              label={t('master.analytics.avgCheck')}
              value={formatPrice(a.totals.avgCheck, a.currency)}
            />
            <StatTile
              label={t('master.analytics.completed')}
              value={a.totals.completed}
              hint={`${t('master.analytics.noShow')}: ${a.totals.noShow}`}
            />
            <StatTile
              label={t('master.analytics.cancellationRate')}
              value={`${a.totals.cancellationRatePct}%`}
              hint={`${t('master.analytics.cancelled')}: ${a.totals.cancelled}`}
            />
            <StatTile label={t('master.analytics.newClients')} value={a.totals.newClients} />
            <StatTile
              label={t('master.analytics.returningClients')}
              value={a.totals.returningClients}
            />
          </div>
          <GlassCard>
            <h3 className="mb-2 text-[15px] font-semibold">{t('master.analytics.revenue')}</h3>
            <RevenueChart data={a.revenueByDay} currency={a.currency} />
          </GlassCard>
          {base === '/api/salon' && a.byMaster.length ? (
            <GlassCard>
              <h3 className="mb-2 text-[15px] font-semibold">{t('master.analytics.byMaster')}</h3>
              <ul className="flex flex-col gap-2">
                {a.byMaster.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-[14px]">
                    <span>{m.name}</span>
                    <span className="text-muted-foreground">
                      {m.count} · {formatPrice(m.revenue, a.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ) : null}
          <GlassCard>
            <h3 className="mb-2 text-[15px] font-semibold">{t('master.analytics.byService')}</h3>
            <ul className="flex flex-col gap-2.5">
              {a.byService.map((s) => {
                const max = Math.max(1, ...a.byService.map((x) => x.revenue));
                return (
                  <li key={s.id} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[14px]">
                      <span className="truncate">{s.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {s.count}× · {formatPrice(s.revenue, a.currency)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="bg-brand h-full rounded-full"
                        style={{ width: `${(s.revenue / max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
          <GlassCard>
            <h3 className="mb-2 text-[15px] font-semibold">{t('master.analytics.byWeekday')}</h3>
            <WeekdayBars data={a.byWeekday} />
          </GlassCard>
          <GlassCard>
            <h3 className="mb-2 text-[15px] font-semibold">{t('master.analytics.byHour')}</h3>
            <HourBars data={a.byHour} />
          </GlassCard>
          <GlassCard className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold">{t('master.dashboard.demographics')}</h3>
            <GenderPie data={a.gender} />
            <AgeBars data={a.ages} />
          </GlassCard>
        </>
      )}
    </>
  );
}

export default function MasterAnalyticsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('master.analytics.title')} back>
      <AnalyticsView base="/api/master" />
    </Page>
  );
}
