import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMyMasters } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { CardSkeleton } from '@/components/layout/states';
import { OnlineBadge, UserAvatar } from '@/components/domain/badges';
import { LoyaltyProgressBar } from '@/components/domain/loyalty';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { cn } from '@/lib/utils';

export default function MastersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const masters = useMyMasters();
  const list = masters.data ?? [];

  return (
    <Page title={t('client.masters.title')} back bottomInset="none">
      {masters.isLoading ? (
        <CardSkeleton />
      ) : !list.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-16 text-center">
          <div className="relative flex h-28 w-full max-w-[240px] items-end justify-center">
            <div className="absolute top-6 left-4 right-4 h-px bg-border" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="relative mx-2 flex flex-col items-center"
                style={{ marginTop: i === 1 ? 0 : 12 }}
              >
                <div className="mb-1 size-2 rounded-full bg-foreground/70" />
                <div className="flex size-16 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40" />
              </div>
            ))}
          </div>
          <div>
            <p className="text-[17px] font-semibold">{t('client.masters.emptyTitle')}</p>
            <p className="mt-1.5 max-w-xs text-[14px] text-muted-foreground">
              {t('client.masters.emptyText')}
            </p>
          </div>
          <GlassButton
            variant="primary"
            size="lg"
            className="rounded-full px-8"
            onClick={() => navigate('/client/search')}
          >
            <Search className="size-4" /> {t('client.masters.find')}
          </GlassButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((m) => (
            <Link key={m.clientId} to={`/m/${m.master.slug}`}>
              <GlassCard
                interactive
                className={cn('flex flex-col gap-3', !m.master.isAvailable && 'opacity-60')}
              >
                <div className="flex items-center gap-3">
                  <UserAvatar src={m.master.avatarUrl} name={m.master.name} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-semibold">{m.master.name}</div>
                    <div className="truncate text-[13px] text-muted-foreground">
                      {m.master.isAvailable
                        ? t('common.visits', { count: m.completedVisits })
                        : t('client.home.unavailable')}
                    </div>
                  </div>
                  {m.master.isOnlineNow ? <OnlineBadge /> : null}
                </div>
                {m.loyaltyProgress ? <LoyaltyProgressBar progress={m.loyaltyProgress} /> : null}
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
