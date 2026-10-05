import type { SearchFilters } from '@/api/clientApi';

export const EMPTY_FILTERS: SearchFilters = {
  categoryIds: [],
  countryId: null,
  cityId: null,
  onlineNow: false,
  q: '',
};

export function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.categoryIds.length) p.set('categories', f.categoryIds.join(','));
  if (f.countryId) p.set('country', f.countryId);
  if (f.cityId) p.set('city', f.cityId);
  if (f.onlineNow) p.set('online', '1');
  if (f.q) p.set('q', f.q);
  return p;
}

export function filtersFromParams(p: URLSearchParams): SearchFilters {
  return {
    categoryIds: (p.get('categories') ?? '').split(',').filter(Boolean),
    countryId: p.get('country'),
    cityId: p.get('city'),
    onlineNow: p.get('online') === '1',
    q: p.get('q') ?? '',
  };
}

const KEY = 'glow.searchFilters';

export function savedFilters(): SearchFilters {
  try {
    return {
      ...EMPTY_FILTERS,
      ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SearchFilters>),
    };
  } catch {
    return EMPTY_FILTERS;
  }
}

export function saveFilters(f: SearchFilters): void {
  localStorage.setItem(KEY, JSON.stringify({ ...f, q: '' }));
}
