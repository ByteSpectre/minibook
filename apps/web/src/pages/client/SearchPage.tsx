import { Map as MapIcon, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useSearch } from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { MasterCard } from '@/components/domain/MasterCard';
import { CategoryChips, CityPicker, CountryPicker } from '@/components/domain/pickers';
import { Chip, GlassButton, GlassInput, GlassSheet } from '@/components/ui/glass';
import { Switch } from '@/components/ui/switch';
import {
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToParams,
  saveFilters,
} from '@/features/search/filters';

export default function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [draft, setDraft] = useState(filters);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(filters.q);
  const search = useSearch(filters);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (q !== filters.q) setParams(filtersToParams({ ...filters, q }), { replace: true });
    }, 350);
    return () => window.clearTimeout(id);
  }, [q, filters, setParams]);

  const apply = (next = draft) => {
    saveFilters(next);
    setParams(filtersToParams(next), { replace: true });
    setSheet(false);
  };

  const items = search.data?.pages.flatMap((p) => p.items) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;
  const activeCount =
    filters.categoryIds.length +
    (filters.countryId ? 1 : 0) +
    (filters.cityId ? 1 : 0) +
    (filters.onlineNow ? 1 : 0);

  return (
    <Page
      title={t('client.search.title')}
      back
      actions={
        <GlassButton asChild size="icon" aria-label={t('client.home.map')}>
          <Link to={`/client/search/map?${params.toString()}`}>
            <MapIcon />
          </Link>
        </GlassButton>
      }
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <GlassInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('client.search.searchPlaceholder')}
            className="pl-10"
          />
        </div>
        <GlassButton
          size="icon"
          aria-label={t('client.search.filters')}
          onClick={() => (setDraft(filters), setSheet(true))}
          className="relative"
        >
          <SlidersHorizontal />
          {activeCount ? (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </GlassButton>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip
          active={filters.onlineNow}
          onClick={() => apply({ ...filters, onlineNow: !filters.onlineNow })}
        >
          <span className="size-2 rounded-full bg-emerald-500" /> {t('client.home.onlineNow')}
        </Chip>
        <CategoryChips
          className="mx-0 px-0"
          value={filters.categoryIds}
          onChange={(categoryIds) => apply({ ...filters, categoryIds })}
        />
      </div>

      {search.isLoading ? (
        <ListSkeleton count={5} />
      ) : search.isError ? (
        <ErrorState onRetry={() => void search.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title={t('client.search.empty')}
          text={t('client.search.emptyText')}
          action={
            activeCount ? (
              <GlassButton size="sm" onClick={() => apply(EMPTY_FILTERS)}>
                {t('client.search.reset')}
              </GlassButton>
            ) : null
          }
        />
      ) : (
        <>
          <p className="px-1 text-[13px] text-muted-foreground">
            {t('client.search.found', { count: total })}
          </p>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <MasterCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
          {search.hasNextPage ? (
            <GlassButton
              block
              loading={search.isFetchingNextPage}
              onClick={() => void search.fetchNextPage()}
            >
              {t('client.search.loadMore')}
            </GlassButton>
          ) : null}
        </>
      )}

      <GlassSheet
        open={sheet}
        onOpenChange={setSheet}
        title={t('client.search.filters')}
        footer={
          <div className="flex gap-2">
            <GlassButton className="flex-1" onClick={() => setDraft(EMPTY_FILTERS)}>
              {t('common.reset')}
            </GlassButton>
            <GlassButton variant="primary" className="flex-1" onClick={() => apply()}>
              {t('common.apply')}
            </GlassButton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <CategoryChips
            value={draft.categoryIds}
            onChange={(categoryIds) => setDraft((d) => ({ ...d, categoryIds }))}
            className="flex-wrap overflow-visible"
          />
          <CountryPicker
            allowEmpty
            value={draft.countryId}
            onChange={(countryId) => setDraft((d) => ({ ...d, countryId, cityId: null }))}
          />
          <CityPicker
            allowEmpty
            countryId={draft.countryId}
            value={draft.cityId}
            onChange={(cityId) => setDraft((d) => ({ ...d, cityId }))}
          />
          <label className="flex min-h-11 items-center justify-between">
            <span className="text-[15px] font-medium">{t('client.home.onlineNow')}</span>
            <Switch
              checked={draft.onlineNow}
              onCheckedChange={(onlineNow) => setDraft((d) => ({ ...d, onlineNow }))}
            />
          </label>
        </div>
      </GlassSheet>
    </Page>
  );
}
