import { Check, ChevronDown, Flame, MapPin, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import type { CategoryDto, CityDto, SearchCardDto } from '@nail-crm/shared';
import { useSearch } from '@/api/clientApi';
import { useCategories, useCities, useCountries } from '@/api/common';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import { Page } from '@/components/layout/Page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/layout/states';
import { categoryName, tenantPath } from '@/components/domain/MasterCard';
import { OnlineBadge, RatingStars, SalonBadge } from '@/components/domain/badges';
import { Chip, GlassButton, GlassCard, GlassInput, GlassSheet } from '@/components/ui/glass';
import { assetUrl } from '@/lib/assets';
import { formatPrice } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import {
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToParams,
  saveFilters,
  savedFilters,
} from '@/features/search/filters';

const POPULAR = [
  'Москва',
  'Санкт-Петербург',
  'Новосибирск',
  'Екатеринбург',
  'Казань',
  'Красноярск',
  'Нижний Новгород',
  'Челябинск',
  'Уфа',
  'Краснодар',
  'Тюмень',
  'Ростов-на-Дону',
];

function SearchMasterCard({ item }: { item: SearchCardDto }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const primary = item.categories[0];
  const img = assetUrl(item.avatarUrl);
  const topRated = item.ratingAvg >= 4.8 && item.ratingCount >= 5;
  const inDemand = item.isOnlineNow || (item.ratingCount >= 20 && item.ratingAvg >= 4.5);

  return (
    <GlassCard className="overflow-hidden p-0">
      <Link
        to={tenantPath(item.type, item.slug)}
        onClick={() => haptic.impact('light')}
        className="block"
      >
        <div className="grid grid-cols-[1.4fr_1fr] gap-1 p-1.5">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            {img ? (
              <img src={img} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-4xl">
                <MonoEmoji>{primary?.emoji ?? '✦'}</MonoEmoji>
              </div>
            )}
            {primary ? (
              <span className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-xl bg-black/45 text-lg backdrop-blur-sm">
                <MonoEmoji>{primary.emoji}</MonoEmoji>
              </span>
            ) : null}
          </div>
          <div className="grid grid-rows-2 gap-1">
            {[0, 1].map((i) => {
              const cat = item.categories[i + 1] ?? item.categories[i] ?? primary;
              return (
                <div key={i} className="relative overflow-hidden rounded-2xl bg-muted">
                  {i === 0 && item.ratingCount > 0 ? (
                    <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur-sm">
                      <Star className="size-3 fill-foreground" />
                      {item.ratingAvg.toFixed(1)}
                      <span className="text-white/70">· {item.ratingCount}</span>
                    </span>
                  ) : null}
                  <div className="flex size-full items-center justify-center text-2xl opacity-80">
                    <MonoEmoji>{cat?.emoji ?? '✦'}</MonoEmoji>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 px-3.5 pt-2 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[18px] font-semibold">{item.name}</h3>
              {item.type === 'salon' ? <SalonBadge /> : null}
            </div>
            {primary ? (
              <p className="text-[13px] text-muted-foreground">
                {categoryName(primary, i18n.language)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {topRated ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold">
                <Star className="size-3 fill-current" /> {t('client.search.topRated')}
              </span>
            ) : null}
            {inDemand ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-muted px-2 py-0.5 text-[11px] font-semibold">
                <Flame className="size-3" /> {t('client.search.inDemand')}
              </span>
            ) : null}
            {item.isOnlineNow ? <OnlineBadge /> : null}
            {item.categories.slice(0, 3).map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {c.emoji ? <MonoEmoji>{c.emoji}</MonoEmoji> : null} {categoryName(c, i18n.language)}
              </span>
            ))}
          </div>

          {item.priceFrom !== null ? (
            <p className="text-[14px] text-muted-foreground">
              {t('client.search.priceFrom', {
                price: formatPrice(item.priceFrom, item.currency),
              })}
            </p>
          ) : null}

          <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
            {item.ratingCount > 0 ? (
              <RatingStars value={item.ratingAvg} count={item.ratingCount} />
            ) : null}
            <span className="flex min-w-0 items-center gap-1 truncate">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {item.cityName}
                {item.address ? ` · ${item.address}` : ''}
              </span>
            </span>
          </div>
        </div>
      </Link>
      {item.categories.length > 3 ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 border-t border-border/60 py-2 text-[13px] font-medium text-primary"
          onClick={() => setExpanded((v) => !v)}
        >
          {t('client.search.more')}
          <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      ) : null}
      {expanded ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-3.5 py-2.5">
          {item.categories.map((c) => (
            <span key={c.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {c.emoji ? <MonoEmoji>{c.emoji}</MonoEmoji> : null} {categoryName(c, i18n.language)}
            </span>
          ))}
        </div>
      ) : null}
    </GlassCard>
  );
}

function CategoryExpandPanel({
  categories,
  value,
  onChange,
  onClose,
}: {
  categories: CategoryDto[];
  value: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const allActive = value.length === 0;
  return (
    <GlassCard className="flex flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('client.search.whatLooking')}
        </p>
        <button
          type="button"
          className="text-[13px] font-medium text-muted-foreground"
          onClick={onClose}
        >
          {t('client.search.hideCategories')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'flex min-h-12 items-center gap-2 rounded-2xl px-3 text-left text-[14px] font-medium transition-all',
            allActive ? 'bg-primary/15 text-foreground ring-1 ring-primary/40' : 'bg-muted/60',
          )}
        >
          <span className="flex size-5 items-center justify-center">
            <Search className="size-4" />
          </span>
          <span className="flex-1">{t('client.search.allCategories')}</span>
          {allActive ? <Check className="size-4 text-foreground" /> : null}
        </button>
        {categories.map((c) => {
          const active = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                haptic.select();
                if (active) onChange(value.filter((id) => id !== c.id));
                else onChange([...value, c.id]);
              }}
              className={cn(
                'flex min-h-12 items-center gap-2 rounded-2xl px-3 text-left text-[14px] font-medium transition-all',
                active ? 'bg-primary/15 text-foreground ring-1 ring-primary/40' : 'bg-muted/60',
              )}
            >
              <MonoEmoji className="text-[18px]">{c.emoji}</MonoEmoji>
              <span className="min-w-0 flex-1 truncate">{categoryName(c, i18n.language)}</span>
              {active ? <Check className="size-4 shrink-0 text-foreground" /> : null}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [q, setQ] = useState(filters.q);
  const [citySheet, setCitySheet] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [catsOpen, setCatsOpen] = useState(false);
  const countries = useCountries();
  const categories = useCategories();

  const defaultCountryId = useMemo(() => {
    const list = countries.data ?? [];
    return list.find((c) => c.code === 'RU')?.id ?? list[0]?.id ?? null;
  }, [countries.data]);

  const countryId = filters.countryId ?? defaultCountryId;
  const cities = useCities(countryId);
  const search = useSearch(filters);

  // Hydrate from saved filters / default country once
  useEffect(() => {
    if (filters.countryId || filters.cityId || !defaultCountryId) return;
    const saved = savedFilters();
    if (saved.cityId || saved.countryId) {
      const next = {
        ...filters,
        countryId: saved.countryId ?? defaultCountryId,
        cityId: saved.cityId,
        categoryIds: saved.categoryIds,
        onlineNow: saved.onlineNow,
      };
      setParams(filtersToParams(next), { replace: true });
    }
  }, [defaultCountryId, filters, setParams]);

  const apply = (next: typeof filters) => {
    saveFilters(next);
    setParams(filtersToParams(next), { replace: true });
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (q !== filters.q) apply({ ...filters, q });
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const cityName = (c: CityDto) => (i18n.language === 'en' && c.nameEn ? c.nameEn : c.name);
  const selectedCity = cities.data?.find((c) => c.id === filters.cityId);
  const cityList = cities.data ?? [];
  const popular = POPULAR.map((name) =>
    cityList.find((c) => c.name === name || c.nameEn === name),
  ).filter(Boolean) as CityDto[];
  const filteredCities = cityQuery.trim()
    ? cityList.filter((c) => cityName(c).toLowerCase().includes(cityQuery.trim().toLowerCase()))
    : cityList;

  const pickCity = (cityId: string) => {
    haptic.select();
    apply({ ...filters, countryId: countryId!, cityId, q: filters.q });
    setCitySheet(false);
    setCityQuery('');
  };

  const setCategories = (categoryIds: string[]) => apply({ ...filters, categoryIds });
  const catList = categories.data ?? [];
  const chipCats = catList.slice(0, 6);
  const items = search.data?.pages.flatMap((p) => p.items) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;
  const hasCity = !!filters.cityId;

  return (
    <Page
      header={
        <header className="pt-safe sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-xl">
          <div className="flex flex-col gap-2.5 px-[var(--page-px)] pt-4 pb-3">
            <button
              type="button"
              onClick={() => setCitySheet(true)}
              className="flex items-center gap-1.5 self-start text-[16px] font-semibold"
            >
              <MapPin className="size-4 text-foreground" />
              {selectedCity ? cityName(selectedCity) : t('client.search.pickCity')}
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <GlassInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('client.search.searchPlaceholder')}
                className="pl-10"
                disabled={!hasCity}
              />
            </div>
            {hasCity ? (
              <>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  <Chip active={filters.categoryIds.length === 0} onClick={() => setCategories([])}>
                    {t('client.search.allCategories')}
                  </Chip>
                  {chipCats.map((c) => (
                    <Chip
                      key={c.id}
                      active={filters.categoryIds.includes(c.id)}
                      onClick={() => {
                        const ids = filters.categoryIds.includes(c.id)
                          ? filters.categoryIds.filter((id) => id !== c.id)
                          : [...filters.categoryIds, c.id];
                        setCategories(ids);
                      }}
                    >
                      {c.emoji ? <MonoEmoji>{c.emoji}</MonoEmoji> : null}{' '}
                      {categoryName(c, i18n.language)}
                    </Chip>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
                    <Chip
                      active={filters.onlineNow}
                      onClick={() => apply({ ...filters, onlineNow: !filters.onlineNow })}
                    >
                      <span className="size-2 rounded-full bg-foreground" />{' '}
                      {t('client.search.onlineToday')}
                    </Chip>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[13px] font-medium text-muted-foreground"
                    onClick={() => setCatsOpen((v) => !v)}
                  >
                    {catsOpen
                      ? t('client.search.hideCategories')
                      : t('client.search.showAllCategories')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>
      }
      bottomInset="tabbar"
    >
      {!hasCity ? (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-[20px] font-semibold">{t('client.search.pickCity')}</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {t('client.search.pickCityHint')}
            </p>
          </div>
          {popular.length ? (
            <section>
              <p className="mb-2 px-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t('client.search.popularCities')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {popular.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCity(c.id)}
                    className="glass rounded-2xl px-3 py-3 text-left text-[14px] font-medium active:scale-[0.98]"
                  >
                    {cityName(c)}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <ListSkeleton count={4} />
          )}
          <GlassButton onClick={() => setCitySheet(true)}>
            {t('client.search.changeCity')}
          </GlassButton>
        </div>
      ) : (
        <>
          {catsOpen ? (
            <CategoryExpandPanel
              categories={catList}
              value={filters.categoryIds}
              onChange={setCategories}
              onClose={() => setCatsOpen(false)}
            />
          ) : null}
          {search.isLoading && !search.data ? (
            <ListSkeleton count={4} />
          ) : search.isError ? (
            <ErrorState onRetry={() => void search.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              emoji="✦"
              title={t('client.search.empty')}
              text={t('client.search.emptyText')}
              action={
                <GlassButton
                  size="sm"
                  onClick={() =>
                    apply({
                      ...EMPTY_FILTERS,
                      countryId: filters.countryId,
                      cityId: filters.cityId,
                    })
                  }
                >
                  {t('client.search.reset')}
                </GlassButton>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-[14px] font-medium">
                  {t('client.search.found', { count: total })}
                </p>
                <span className="text-[13px] text-muted-foreground">
                  {t('client.search.sortRecommended')}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <SearchMasterCard key={`${item.type}-${item.id}`} item={item} />
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
        </>
      )}

      <GlassSheet open={citySheet} onOpenChange={setCitySheet} title={t('client.search.pickCity')}>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <GlassInput
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={t('client.home.city')}
              className="pl-10"
              autoFocus
            />
          </div>
          {!cityQuery && popular.length ? (
            <>
              <p className="px-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t('client.search.popularCities')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {popular.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCity(c.id)}
                    className={cn(
                      'rounded-2xl px-3 py-3 text-left text-[14px] font-medium',
                      c.id === filters.cityId ? 'bg-primary/15 ring-1 ring-primary/40' : 'glass',
                    )}
                  >
                    {cityName(c)}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <div className="glass flex flex-col divide-y divide-border overflow-hidden rounded-2xl">
            {filteredCities.slice(0, 40).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCity(c.id)}
                className="flex min-h-12 items-center justify-between px-4 py-3 text-left text-[15px] active:bg-muted"
              >
                {cityName(c)}
                {c.id === filters.cityId ? <Check className="size-4 text-primary" /> : null}
              </button>
            ))}
          </div>
        </div>
      </GlassSheet>
    </Page>
  );
}
