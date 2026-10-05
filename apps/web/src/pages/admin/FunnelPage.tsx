import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFunnel } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { ErrorState, ListSkeleton } from '@/components/layout/states';
import { GlassCard, SectionTitle } from '@/components/ui/glass';
import { formatShortDate } from '@/lib/format';

export default function AdminFunnelPage() {
  const { t } = useTranslation();
  const { data: f, isLoading, isError, refetch } = useFunnel();
  const max = Math.max(1, ...(f?.steps.map((s) => s.count) ?? [1]));
  return (
    <Page title={t('admin.funnel.title')} back bottomInset="none">
      {isLoading ? (
        <ListSkeleton count={4} />
      ) : isError || !f ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <GlassCard className="flex flex-col gap-3">
            {f.steps.map((s, i) => (
              <div key={s.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="font-medium">{t(`enums.funnel.${s.key}`)}</span>
                  <span className="font-semibold">{s.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="bg-brand h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${(s.count / max) * 100}%` }}
                  />
                </div>
                {i > 0 ? (
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {t('admin.funnel.conversion', { pct: s.conversionPct })}
                  </div>
                ) : null}
              </div>
            ))}
          </GlassCard>

          <section>
            <SectionTitle>{t('admin.funnel.byRole')}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {f.byRole.map((r) => (
                <GlassCard key={r.role}>
                  <h3 className="mb-2 text-[15px] font-semibold">{t(`enums.role.${r.role}`)}</h3>
                  <dl className="grid grid-cols-2 gap-2 text-[14px]">
                    {(
                      ['started', 'completed', 'firstAppointment', 'subscribed', 'churned'] as const
                    ).map((k) => (
                      <div key={k}>
                        <dt className="text-[12px] text-muted-foreground">
                          {t(`admin.funnel.${k}`)}
                        </dt>
                        <dd className="text-[17px] font-semibold">{r[k]}</dd>
                      </div>
                    ))}
                  </dl>
                </GlassCard>
              ))}
            </div>
          </section>

          {f.weekly.length ? (
            <GlassCard>
              <h3 className="mb-2 text-[15px] font-semibold">{t('admin.funnel.weekly')}</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={f.weekly} margin={{ left: -24, right: 4, top: 6 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.15} />
                    <XAxis
                      dataKey="week"
                      tickFormatter={(w: string) => formatShortDate(w)}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      labelFormatter={(w) => formatShortDate(String(w))}
                      contentStyle={{ borderRadius: 14, border: 'none' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="newUsers"
                      name={t('admin.funnel.newUsers')}
                      fill="#a78bfa"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="newMasters"
                      name={t('admin.funnel.newMasters')}
                      fill="#f472b6"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="subscribed"
                      name={t('admin.funnel.subscribed')}
                      fill="#34d399"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          ) : null}
        </>
      )}
    </Page>
  );
}
