import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminCategoryDto,
  AdminCityDto,
  AdminCountryDto,
  AdminPaymentRowDto,
  AdminStatsDto,
  AdminTenantRowDto,
  CategoryUpsertInput,
  CityUpsertInput,
  CountryUpsertInput,
  ExperimentDto,
  ExperimentUpsertInput,
  FunnelDto,
  Paginated,
  PlatformSettingsDto,
  PlatformSettingsPatchInput,
  PromoCodeDto,
  PromoCodeUpsertInput,
  SubStatus,
  TenantActionInput,
  TenantKind,
} from '@nail-crm/shared';
import { api } from './client';

const A = '/api/admin';

export const useAdminStats = () =>
  useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<AdminStatsDto>(`${A}/stats`) });
export const useFunnel = () =>
  useQuery({ queryKey: ['admin', 'funnel'], queryFn: () => api.get<FunnelDto>(`${A}/funnel`) });

export const useTenants = (kind: TenantKind, q: { q?: string; status?: SubStatus; page: number }) =>
  useQuery({
    queryKey: ['admin', 'tenants', kind, q],
    queryFn: () => api.get<Paginated<AdminTenantRowDto>>(`${A}/${kind}s`, { ...q, pageSize: 30 }),
    placeholderData: keepPreviousData,
  });

export function useTenantAction(kind: TenantKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TenantActionInput }) =>
      api.post<{ ok: true; status: SubStatus }>(`${A}/${kind}s/${id}/action`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'tenants', kind] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export const useAdminPayments = (q: { status?: string; page: number }) =>
  useQuery({
    queryKey: ['admin', 'payments', q],
    queryFn: () => api.get<Paginated<AdminPaymentRowDto>>(`${A}/payments`, { ...q, pageSize: 30 }),
    placeholderData: keepPreviousData,
  });

function crud<TDto, TInput>(path: string, key: string) {
  return function useCrud(query?: Record<string, string | undefined>) {
    const qc = useQueryClient();
    const done = () => {
      void qc.invalidateQueries({ queryKey: ['admin', key] });
      void qc.invalidateQueries({ queryKey: ['meta'] });
      void qc.invalidateQueries({ queryKey: ['dict'] });
    };
    return {
      list: useQuery({
        queryKey: ['admin', key, query ?? null],
        queryFn: () => api.get<TDto[]>(`${A}/${path}`, query),
      }),
      save: useMutation({
        mutationFn: ({ id, input }: { id: string | null; input: TInput }) =>
          id ? api.patch<TDto>(`${A}/${path}/${id}`, input) : api.post<TDto>(`${A}/${path}`, input),
        onSuccess: done,
      }),
      remove: useMutation({
        mutationFn: (id: string) => api.delete(`${A}/${path}/${id}`),
        onSuccess: done,
      }),
    };
  };
}

export const useAdminCategories = crud<AdminCategoryDto, CategoryUpsertInput>(
  'categories',
  'categories',
);
export const useAdminCountries = crud<AdminCountryDto, CountryUpsertInput>(
  'countries',
  'countries',
);
export const useAdminCities = crud<AdminCityDto, CityUpsertInput>('cities', 'cities');
export const usePromoCodes = crud<PromoCodeDto, PromoCodeUpsertInput>('promo-codes', 'promo-codes');
export const useExperiments = crud<ExperimentDto, ExperimentUpsertInput>(
  'experiments',
  'experiments',
);

export const useAdminSettings = () =>
  useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<PlatformSettingsDto>(`${A}/settings`),
  });

export function usePatchAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformSettingsPatchInput) =>
      api.patch<PlatformSettingsDto>(`${A}/settings`, input),
    onSuccess: (s) => qc.setQueryData(['admin', 'settings'], s),
  });
}

export const useSendDigest = () =>
  useMutation({ mutationFn: () => api.post<{ sent: number }>(`${A}/digest/send`, {}) });
