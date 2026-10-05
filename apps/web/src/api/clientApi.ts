import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthResponse,
  ClientAppointmentDto,
  ClientOnboardingInput,
  ClientProfileDto,
  ClientProfilePatchInput,
  MapPointDto,
  MyMasterDto,
  ReviewCreateInput,
  ReviewDto,
  SearchResponse,
  BookingResponse,
} from '@nail-crm/shared';
import { useAuth } from '@/store/auth';
import { api } from './client';

export interface SearchFilters {
  categoryIds: string[];
  countryId: string | null;
  cityId: string | null;
  onlineNow: boolean;
  q: string;
  lat?: number;
  lng?: number;
}

const filterQuery = (f: SearchFilters) => ({
  categoryIds: f.categoryIds.length ? f.categoryIds : undefined,
  countryId: f.countryId ?? undefined,
  cityId: f.cityId ?? undefined,
  onlineNow: f.onlineNow || undefined,
  q: f.q || undefined,
  lat: f.lat,
  lng: f.lng,
});

export const useSearch = (filters: SearchFilters) =>
  useInfiniteQuery({
    queryKey: ['search', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<SearchResponse>('/api/search/masters', {
        ...filterQuery(filters),
        page: pageParam,
        pageSize: 20,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 60 * 1000,
  });

export const useMapPoints = (filters: SearchFilters, enabled = true) =>
  useQuery({
    queryKey: ['search-map', filters],
    queryFn: () => api.get<MapPointDto[]>('/api/search/map', filterQuery(filters)),
    enabled,
    staleTime: 60 * 1000,
  });

export const useClientProfile = (enabled = true) =>
  useQuery({
    queryKey: ['client', 'profile'],
    queryFn: () => api.get<ClientProfileDto>('/api/client/profile'),
    enabled,
  });

export function useCompleteClientOnboarding() {
  const setSession = useAuth((s) => s.setSession);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientOnboardingInput) =>
      api.post<AuthResponse>('/api/client/onboarding/complete', input),
    onSuccess: (res) => {
      setSession(res);
      void qc.invalidateQueries({ queryKey: ['client'] });
    },
  });
}

export function usePatchClientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientProfilePatchInput) =>
      api.patch<ClientProfileDto>('/api/client/profile', input),
    onSuccess: (profile) => qc.setQueryData(['client', 'profile'], profile),
  });
}

export const useMyMasters = (enabled = true) =>
  useQuery({
    queryKey: ['client', 'my-masters'],
    queryFn: () => api.get<MyMasterDto[]>('/api/client/my-masters'),
    enabled,
  });

export function usePatchMyMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      masterId,
      notificationsEnabled,
    }: {
      masterId: string;
      notificationsEnabled: boolean;
    }) => api.patch(`/api/client/my-masters/${masterId}`, { notificationsEnabled }),
    onMutate: async ({ masterId, notificationsEnabled }) => {
      qc.setQueryData<MyMasterDto[]>(['client', 'my-masters'], (list) =>
        list?.map((m) => (m.master.id === masterId ? { ...m, notificationsEnabled } : m)),
      );
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['client', 'my-masters'] }),
  });
}

export const useMyAppointments = (enabled = true) =>
  useQuery({
    queryKey: ['client', 'appointments'],
    queryFn: () =>
      api.get<{ upcoming: ClientAppointmentDto[]; past: ClientAppointmentDto[] }>(
        '/api/client/my-appointments',
      ),
    enabled,
    staleTime: 30 * 1000,
  });

function useAppointmentMutation<V>(fn: (vars: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client'] });
      void qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export const useCancelAppointment = () =>
  useAppointmentMutation((id: string) => api.post(`/api/client/appointments/${id}/cancel`, {}));

export const useRescheduleAppointment = () =>
  useAppointmentMutation(({ id, startAt }: { id: string; startAt: string }) =>
    api.post<ClientAppointmentDto>(`/api/client/appointments/${id}/reschedule`, { startAt }),
  );

export const useConfirmVisit = () =>
  useAppointmentMutation((id: string) => api.post(`/api/client/appointments/${id}/confirm`, {}));

export const useReviewAppointment = () =>
  useAppointmentMutation(({ id, input }: { id: string; input: ReviewCreateInput }) =>
    api.post<ReviewDto>(`/api/client/appointments/${id}/review`, input),
  );

export interface RepeatPreview {
  masterSlug: string;
  serviceIds: string[];
  services: { id: string; name: string; price: number; duration: number }[];
  slot: { startAt: string; date: string; time: string; discountPct: number | null } | null;
  timezone: string;
}

export const useRepeatPreview = (id: string | null) =>
  useQuery({
    queryKey: ['client', 'repeat', id],
    queryFn: () => api.get<RepeatPreview>(`/api/client/appointments/${id}/repeat`),
    enabled: !!id,
    staleTime: 0,
  });

export const useRepeatBooking = () =>
  useAppointmentMutation(({ id, startAt }: { id: string; startAt?: string }) =>
    api.post<BookingResponse>(`/api/client/appointments/${id}/repeat`, { startAt }),
  );
