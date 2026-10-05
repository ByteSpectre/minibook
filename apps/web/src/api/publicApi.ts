import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AvailabilityResponse,
  BookingCreateInput,
  BookingResponse,
  CheckAccessResponse,
  Paginated,
  PublicPageResponse,
  QuoteInput,
  QuoteResponse,
  ReviewDto,
  SlotsResponse,
} from '@nail-crm/shared';
import { api } from './client';

export const usePublicPage = (slug: string | undefined) =>
  useQuery({
    queryKey: ['public', 'page', slug],
    queryFn: () => api.get<PublicPageResponse>(`/api/public/${slug}`),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });

export const usePublicReviews = (slug: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['public', 'reviews', slug],
    queryFn: () => api.get<Paginated<ReviewDto>>(`/api/public/${slug}/reviews`, { pageSize: 50 }),
    enabled: !!slug && enabled,
  });

export const useCheckAccess = (slug: string | undefined) =>
  useQuery({
    queryKey: ['public', 'access', slug],
    queryFn: () => api.post<CheckAccessResponse>(`/api/public/${slug}/check-access`),
    enabled: !!slug,
    staleTime: 0,
  });

export const useAvailability = (slug: string | undefined, serviceIds: string[], from: string) =>
  useQuery({
    queryKey: ['public', 'availability', slug, serviceIds, from],
    queryFn: () =>
      api.get<AvailabilityResponse>(`/api/public/${slug}/availability`, {
        serviceIds,
        from,
        days: 42,
      }),
    enabled: !!slug && serviceIds.length > 0,
    staleTime: 30 * 1000,
  });

export const useSlots = (slug: string | undefined, serviceIds: string[], date: string | null) =>
  useQuery({
    queryKey: ['public', 'slots', slug, serviceIds, date],
    queryFn: () =>
      api.get<SlotsResponse>(`/api/public/${slug}/slots`, { serviceIds, date: date ?? undefined }),
    enabled: !!slug && serviceIds.length > 0 && !!date,
    staleTime: 15 * 1000,
  });

export const useQuote = (slug: string | undefined, input: QuoteInput | null) =>
  useQuery({
    queryKey: ['public', 'quote', slug, input],
    queryFn: () => api.post<QuoteResponse>(`/api/public/${slug}/quote`, input),
    enabled: !!slug && !!input && input.serviceIds.length > 0,
    staleTime: 15 * 1000,
  });

export function useCreateBooking(slug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingCreateInput) =>
      api.post<BookingResponse>(`/api/public/${slug}/appointments`, input),
    meta: { silent: true },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client'] });
      void qc.invalidateQueries({ queryKey: ['public', 'slots'] });
      void qc.invalidateQueries({ queryKey: ['public', 'availability'] });
    },
  });
}
