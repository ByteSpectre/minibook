import { useQuery } from '@tanstack/react-query';
import type { CategoryDto, CityDto, CountryDto } from '@nail-crm/shared';
import { api } from './client';

export interface MetaDto {
  botUsername: string;
  miniAppShortName: string | null;
  devAuthEnabled: boolean;
  paymentProvider: 'yookassa' | 'mock';
  botConnected: boolean;
}

export const useMeta = () =>
  useQuery({
    queryKey: ['meta'],
    queryFn: () => api.get<MetaDto>('/api/meta'),
    staleTime: Infinity,
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['dict', 'categories'],
    queryFn: () => api.get<CategoryDto[]>('/api/search/categories'),
    staleTime: 30 * 60 * 1000,
  });

export const useCountries = () =>
  useQuery({
    queryKey: ['dict', 'countries'],
    queryFn: () => api.get<CountryDto[]>('/api/search/countries'),
    staleTime: 30 * 60 * 1000,
  });

export const useCities = (countryId?: string | null) =>
  useQuery({
    queryKey: ['dict', 'cities', countryId ?? 'all'],
    queryFn: () => api.get<CityDto[]>('/api/search/cities', { countryId: countryId ?? undefined }),
    enabled: !!countryId,
    staleTime: 30 * 60 * 1000,
  });
