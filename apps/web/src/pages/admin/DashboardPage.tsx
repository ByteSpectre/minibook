import { Send } from 'lucide-react';
import { SUB_STATUSES } from '@nail-crm/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdminStats, useSendDigest } from '@/api/adminApi';
import { Page } from '@/components/layout/Page';
import { ErrorState, ListSkeleton } from '@/components/layout/states';
import { SubStatusBadge } from '@/components/domain/badges';
import {
  GlassButton,
  GlassCard,
  ListGroup,
  ListRow,
  SectionTitle,
  StatTile,
} from '@/components/ui/glass';
import { RevenueChart } from '@/features/cabinet/charts';
import { formatPrice } from '@/lib/format';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data: s, isLoading, isError, refetch } = useAdminStats();
  const digest = useSendDigest();
  return (
    <Page
      title={t('admin.dashboard.title')}
      actions={
        <GlassButton
          size="icon"
          aria-label={t('admin.dashboard.sendDigest')}
          loading={digest.isPending}
          onClick={() =>
            digest.mutate(undefined, {
              onSuccess: () => toast.success(t('admin.dashboard.digestSent')),
            })
          }
        >
          <Send />
        </GlassButton>
      }
    >
      {isLoading ? (
        <ListSkeleton count={4} />
      ) : isError || !s ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <GlassCard strong className="p-5">
            <div className="text-[13px] font-medium text-muted-foreground">
              {t('admin.dashboard.mrr')}
            </div>
            <div className="text-[34px] font-bold tracking-tight">{formatPrice(s.mrrRub)}</div>
            <div className="text-[13px] text-muted-foreground">
              {t('admin.dashboard.new7', { masters: s.newMasters7d, salons: s.newSalons7d })}
            </div>
          </GlassCard>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label={t('admin.dashboard.revenue30')}
              value={formatPrice(s.revenue30dRub)}
              hint={`${t('admin.dashboard.payments30')}: ${s.payments30d}`}
            />
            <StatTile label={t('admin.dashboard.appointments30')} value={s.appointments30d} />
            <StatTile label={t('admin.dashboard.masters')} value={s.masters} />
            <StatTile label={t('admin.dashboard.salons')} value={s.salons} />
            <StatTile label={t('admin.dashboard.clients')} value={s.clients} />
            <StatTile label={t('admin.dashboard.users')} value={s.users} />
          </div>
          <GlassCard>
            <h3 className="mb-2 text-[15px] font-semibold">{t('admin.dashboard.revenueChart')}</h3>
            <RevenueChart data={s.revenueByDay} currency="RUB" />
          </GlassCard>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['byStatus', s.byStatus, '/admin/masters'],
                ['salonsByStatus', s.salonsByStatus, '/admin/salons'],
              ] as const
            ).map(([key, counts, to]) => (
              <GlassCard key={key}>
                <h3 className="mb-2 text-[15px] font-semibold">{t(`admin.dashboard.${key}`)}</h3>
                <ul className="flex flex-col gap-1.5">
                  {SUB_STATUSES.map((st) => (
                    <li key={st}>
                      <Link
                        to={`${to}?status=${st}`}
                        className="flex items-center justify-between py-0.5"
                      >
                        <SubStatusBadge status={st} />
                        <span className="text-[15px] font-semibold">{counts[st] ?? 0}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
          {s.topMasters.length ? (
            <section>
              <SectionTitle>{t('admin.dashboard.topMasters')}</SectionTitle>
              <ListGroup>
                {s.topMasters.map((m, i) => (
                  <ListRow
                    key={m.id}
                    icon={<span className="text-[13px] font-semibold">{i + 1}</span>}
                    title={m.name}
                    subtitle={`/m/${m.slug} · ${t('admin.tenants.appointments')}: ${m.appointments}`}
                    right={
                      <span className="shrink-0 text-[15px] font-semibold">
                        {formatPrice(m.revenue)}
                      </span>
                    }
                  />
                ))}
              </ListGroup>
            </section>
          ) : null}
        </>
      )}
    </Page>
  );
}
