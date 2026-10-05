import { useTranslation } from 'react-i18next';
import { useSalonMasters, useSalonProfile, useSalonServices } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { UserAvatar } from '@/components/domain/badges';
import { ListGroup, ListRow, SectionTitle } from '@/components/ui/glass';
import { assetUrl } from '@/lib/assets';
import { formatDuration, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function SalonServicesPage() {
  const { t } = useTranslation();
  const profile = useSalonProfile();
  const services = useSalonServices();
  const masters = useSalonMasters();
  const currency = profile.data?.currency ?? 'RUB';

  const groups = (masters.data ?? [])
    .map((m) => ({ master: m, services: (services.data ?? []).filter((s) => s.masterId === m.id) }))
    .filter((g) => g.services.length);

  return (
    <Page title={t('salon.services.title')} back>
      {services.isLoading || masters.isLoading ? (
        <ListSkeleton />
      ) : services.isError ? (
        <ErrorState onRetry={() => void services.refetch()} />
      ) : !groups.length ? (
        <EmptyState emoji="💅" title={t('salon.services.empty')} />
      ) : (
        groups.map(({ master, services: list }) => (
          <section key={master.id}>
            <SectionTitle>
              <span className="flex items-center gap-2">
                <UserAvatar src={master.avatarUrl} name={master.name} size={28} />
                {master.name}
              </span>
            </SectionTitle>
            <ListGroup>
              {list.map((s) => (
                <ListRow
                  key={s.id}
                  className={cn(!s.isActive && 'opacity-50')}
                  icon={
                    s.imageUrl ? (
                      <img
                        src={assetUrl(s.imageUrl)}
                        alt=""
                        className="size-9 rounded-xl object-cover"
                      />
                    ) : (
                      '💅'
                    )
                  }
                  title={s.name}
                  subtitle={formatDuration(s.duration)}
                  right={
                    <span className="shrink-0 text-[15px] font-semibold">
                      {formatPrice(s.price, currency)}
                    </span>
                  }
                />
              ))}
            </ListGroup>
          </section>
        ))
      )}
    </Page>
  );
}
