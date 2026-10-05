import { AnimatePresence, motion } from 'framer-motion';
import { List, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import type { MapPointDto } from '@nail-crm/shared';
import { useCities } from '@/api/common';
import { useMapPoints } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import {
  CategoryTag,
  OnlineBadge,
  PromoBadge,
  RatingStars,
  SalonBadge,
  UserAvatar,
} from '@/components/domain/badges';
import { categoryName, tenantPath } from '@/components/domain/MasterCard';
import { CategoryChips } from '@/components/domain/pickers';
import { MapView } from '@/components/map/MapView';
import { Chip, GlassButton, GlassCard } from '@/components/ui/glass';
import { filtersFromParams, filtersToParams } from '@/features/search/filters';

export default function SearchMapPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const points = useMapPoints(filters);
  const cities = useCities(filters.countryId);
  const [selected, setSelected] = useState<MapPointDto | null>(null);
  const city = cities.data?.find((c) => c.id === filters.cityId);
  const center =
    city?.latitude && city.longitude ? { lat: city.latitude, lng: city.longitude } : null;
  const markers = useMemo(
    () =>
      (points.data ?? []).map((p) => ({
        id: `${p.type}-${p.id}`,
        lat: p.latitude,
        lng: p.longitude,
        title: p.name,
        avatarUrl: p.avatarUrl,
        online: p.isOnlineNow,
        discount: p.maxDiscountPct,
        kind: p.type,
      })),
    [points.data],
  );
  const update = (next: typeof filters) => setParams(filtersToParams(next), { replace: true });

  return (
    <Page
      title={t('client.home.map')}
      back
      actions={
        <GlassButton asChild size="icon" aria-label={t('client.home.list')}>
          <Link to={`/client/search?${params.toString()}`}>
            <List />
          </Link>
        </GlassButton>
      }
    >
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip
          active={filters.onlineNow}
          onClick={() => update({ ...filters, onlineNow: !filters.onlineNow })}
        >
          <span className="size-2 rounded-full bg-foreground" /> {t('client.home.onlineNow')}
        </Chip>
        <CategoryChips
          className="mx-0 px-0"
          value={filters.categoryIds}
          onChange={(categoryIds) => update({ ...filters, categoryIds })}
        />
      </div>
      <div className="relative">
        <MapView
          markers={markers}
          center={center}
          showNearMe
          height="calc(100dvh - 260px)"
          onMarkerClick={(m) =>
            setSelected(points.data?.find((p) => `${p.type}-${p.id}` === m.id) ?? null)
          }
        />
        <AnimatePresence>
          {selected ? (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="absolute inset-x-3 bottom-3"
            >
              <GlassCard strong className="flex flex-col gap-3 p-3">
                <div className="flex items-start gap-3">
                  <UserAvatar
                    src={selected.avatarUrl}
                    name={selected.name}
                    size={56}
                    className="rounded-2xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-semibold">{selected.name}</span>
                      {selected.maxDiscountPct ? (
                        <PromoBadge pct={selected.maxDiscountPct} />
                      ) : null}
                    </div>
                    <RatingStars value={selected.ratingAvg} count={selected.ratingCount} />
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selected.isOnlineNow ? <OnlineBadge /> : null}
                      {selected.type === 'salon' ? <SalonBadge /> : null}
                      {selected.categories.slice(0, 2).map((c) => (
                        <CategoryTag
                          key={c.id}
                          emoji={c.emoji}
                          name={categoryName(c, i18n.language)}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t('common.close')}
                    onClick={() => setSelected(null)}
                    className="flex size-9 items-center justify-center rounded-full bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <GlassButton asChild variant="primary" block>
                  <Link to={tenantPath(selected.type, selected.slug)}>{t('components.book')}</Link>
                </GlassButton>
              </GlassCard>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Page>
  );
}
