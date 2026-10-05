import { CalendarDays, ChevronRight, List, Map as MapIcon, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMyAppointments, useMyMasters } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { CardSkeleton, EmptyState } from '@/components/layout/states';
import { ClientAppointmentCard } from '@/components/domain/appointments';
import { OnlineBadge, UserAvatar } from '@/components/domain/badges';
import { LoyaltyProgressBar } from '@/components/domain/loyalty';
import { CategoryChips, CityPicker, CountryPicker } from '@/components/domain/pickers';
import { GlassButton, GlassCard, SectionTitle } from '@/components/ui/glass';
import { Switch } from '@/components/ui/switch';
import { filtersToParams, saveFilters, savedFilters } from '@/features/search/filters';
import { cn } from '@/lib/utils';
import { useMe } from '@/store/auth';

export default function HomePage() {
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(savedFilters);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const masters = useMyMasters();
  const appointments = useMyAppointments();

  const find = () => {
    saveFilters(filters);
    navigate(
      `/client/search${mode === 'map' ? '/map' : ''}?${filtersToParams(filters).toString()}`,
    );
  };

  return (
    <Page
      title={t('client.home.greeting', { name: me?.user.firstName ?? '' })}
      subtitle={t('client.home.subtitle')}
      actions={
        <Link to="/client/profile" aria-label={t('nav.profile')}>
          <UserAvatar src={me?.user.photoUrl} name={me?.user.firstName} size={44} ring />
        </Link>
      }
    >
      <GlassCard className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">{t('client.home.searchTitle')}</h2>
          <div className="flex rounded-full bg-muted p-1" role="tablist">
            {(['list', 'map'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-all',
                  mode === m ? 'bg-background text-foreground shadow' : 'text-muted-foreground',
                )}
              >
                {m === 'list' ? <List className="size-4" /> : <MapIcon className="size-4" />}
                {m === 'list' ? t('client.home.list') : t('client.home.map')}
              </button>
            ))}
          </div>
        </div>
        <CategoryChips
          value={filters.categoryIds}
          onChange={(categoryIds) => setFilters((f) => ({ ...f, categoryIds }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <CountryPicker
            allowEmpty
            value={filters.countryId}
            onChange={(countryId) => setFilters((f) => ({ ...f, countryId, cityId: null }))}
          />
          <CityPicker
            allowEmpty
            countryId={filters.countryId}
            value={filters.cityId}
            onChange={(cityId) => setFilters((f) => ({ ...f, cityId }))}
          />
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 px-1">
          <span className="flex items-center gap-2 text-[15px] font-medium">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            {t('client.home.onlineNow')}
          </span>
          <Switch
            checked={filters.onlineNow}
            onCheckedChange={(onlineNow) => setFilters((f) => ({ ...f, onlineNow }))}
          />
        </label>
        <GlassButton variant="primary" size="lg" block onClick={find}>
          <Search /> {t('client.home.find')}
        </GlassButton>
      </GlassCard>

      <section>
        <SectionTitle>{t('client.home.myMasters')}</SectionTitle>
        {masters.isLoading ? (
          <CardSkeleton />
        ) : masters.data?.length ? (
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {masters.data.map((m) => (
              <Link
                key={m.clientId}
                to={`/m/${m.master.slug}`}
                className="w-[230px] shrink-0 snap-start"
              >
                <GlassCard
                  interactive
                  className={cn(
                    'flex h-full flex-col gap-3',
                    !m.master.isAvailable && 'opacity-60',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar src={m.master.avatarUrl} name={m.master.name} size={48} />
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">{m.master.name}</div>
                      <div className="truncate text-[12px] text-muted-foreground">
                        {m.master.isAvailable
                          ? t('common.visits', { count: m.completedVisits })
                          : t('client.home.unavailable')}
                      </div>
                    </div>
                  </div>
                  {m.master.isOnlineNow ? <OnlineBadge className="self-start" /> : null}
                  {m.loyaltyProgress ? (
                    <LoyaltyProgressBar progress={m.loyaltyProgress} compact />
                  ) : null}
                </GlassCard>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState emoji="💖" title={t('client.home.myMastersEmpty')} />
        )}
      </section>

      <section>
        <SectionTitle
          action={
            <Link
              to="/client/calendar"
              className="flex items-center gap-0.5 text-[14px] font-medium text-primary"
            >
              {t('client.home.allAppointments')} <ChevronRight className="size-4" />
            </Link>
          }
        >
          {t('client.home.myAppointments')}
        </SectionTitle>
        {appointments.isLoading ? (
          <CardSkeleton />
        ) : appointments.data?.upcoming.length ? (
          <div className="flex flex-col gap-3">
            {appointments.data.upcoming.slice(0, 3).map((a) => (
              <ClientAppointmentCard
                key={a.id}
                appointment={a}
                compact
                onClick={() => navigate(`/client/calendar?appointment=${a.id}`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            emoji="🗓"
            title={t('client.home.noAppointments')}
            text={t('client.home.noAppointmentsHint')}
            action={
              <GlassButton size="sm" onClick={find}>
                <CalendarDays /> {t('client.home.find')}
              </GlassButton>
            }
          />
        )}
      </section>
    </Page>
  );
}
