import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  AnalyticsDto,
  AppointmentPatchInput,
  AuthResponse,
  BlacklistCreateInput,
  BlacklistEntryDto,
  BlockedScreenDto,
  BlockedScreenInput,
  BroadcastCreateInput,
  BroadcastDto,
  BroadcastPreviewInput,
  BroadcastPreviewResponse,
  CategoryDto,
  ClientPatchInput,
  CreatePaymentResponse,
  DashboardDto,
  InviteByUsernameResponse,
  LoyaltyRuleDto,
  LoyaltyRuleInput,
  MasterAppointmentCreateInput,
  MasterAppointmentDto,
  MasterClientDetailDto,
  MasterClientDto,
  MasterOnboardingInput,
  MasterProfileDto,
  MasterProfilePatchInput,
  MasterSettingsDto,
  OnboardingDraftDto,
  Paginated,
  PaymentDto,
  PromotionDto,
  PromotionInput,
  ReviewDto,
  SalonInviteDto,
  SalonMasterDto,
  SalonOnboardingInput,
  SalonProfileDto,
  SalonProfilePatchInput,
  ScheduleDayDto,
  ScheduleDayResponse,
  ServiceCreateInput,
  ServiceDto,
  SettingsPatchInput,
  ShareDto,
  SlotsResponse,
  SubscriptionDto,
  ThemeDto,
  ThemePatchInput,
  ThemePreset,
  TimeBlockDto,
  WeeklyScheduleInput,
} from '@nail-crm/shared';
import { useAuth } from '@/store/auth';
import { api } from './client';

export type CabinetBase = '/api/master' | '/api/salon';

function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: QueryKey[]) => keys.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
}

/* ───────────── Onboarding ───────────── */

export const useOnboardingDraft = (base: CabinetBase) =>
  useQuery({
    queryKey: [base, 'draft'],
    queryFn: () => api.get<OnboardingDraftDto>(`${base}/onboarding/draft`),
    staleTime: 0,
  });

export const useSaveDraft = (base: CabinetBase) =>
  useMutation({
    mutationFn: (input: { step: number; data: Record<string, unknown> }) =>
      api.post<OnboardingDraftDto>(`${base}/onboarding/step`, input),
    meta: { silent: true },
  });

export async function checkSlug(base: CabinetBase, slug: string): Promise<boolean> {
  const res = await api.get<{ available: boolean }>(`${base}/onboarding/slug-check`, { slug });
  return res.available;
}

export function useCompleteOnboarding<T extends MasterOnboardingInput | SalonOnboardingInput>(
  base: CabinetBase,
) {
  const setSession = useAuth((s) => s.setSession);
  return useMutation({
    mutationFn: (input: T) => api.post<AuthResponse>(`${base}/onboarding/complete`, input),
    onSuccess: (res) => setSession(res),
  });
}

/* ───────────── Profile ───────────── */

export const useMasterProfile = () =>
  useQuery({
    queryKey: ['/api/master', 'profile'],
    queryFn: () => api.get<MasterProfileDto>('/api/master/profile'),
  });

export function usePatchMasterProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MasterProfilePatchInput) =>
      api.patch<MasterProfileDto>('/api/master/profile', input),
    onSuccess: (p) => {
      qc.setQueryData(['/api/master', 'profile'], p);
      void qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export const useSalonProfile = () =>
  useQuery({
    queryKey: ['/api/salon', 'profile'],
    queryFn: () => api.get<SalonProfileDto>('/api/salon/profile'),
  });

export function usePatchSalonProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SalonProfilePatchInput) =>
      api.patch<SalonProfileDto>('/api/salon/profile', input),
    onSuccess: (p) => qc.setQueryData(['/api/salon', 'profile'], p),
  });
}

export const useMasterCategories = () =>
  useQuery({
    queryKey: ['/api/master', 'categories'],
    queryFn: () =>
      api.get<{ selectedIds: string[]; selected: CategoryDto[]; all: CategoryDto[] }>(
        '/api/master/categories',
      ),
  });

export function useSetMasterCategories() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (categoryIds: string[]) => api.put('/api/master/categories', { categoryIds }),
    onSuccess: () => invalidate(['/api/master', 'categories'], ['/api/master', 'profile']),
  });
}

/* ───────────── Theme ───────────── */

export const useTheme = (base: CabinetBase) =>
  useQuery({ queryKey: [base, 'theme'], queryFn: () => api.get<ThemeDto>(`${base}/theme`) });

export function usePatchTheme(base: CabinetBase) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ThemePatchInput) => api.patch<ThemeDto>(`${base}/theme`, input),
    onSuccess: (theme) => {
      qc.setQueryData([base, 'theme'], theme);
      void qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export function useApplyPreset(base: CabinetBase) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preset: ThemePreset) => api.post<ThemeDto>(`${base}/theme/preset`, { preset }),
    onSuccess: (theme) => {
      qc.setQueryData([base, 'theme'], theme);
      void qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

/* ───────────── Services ───────────── */

export const useServices = () =>
  useQuery({
    queryKey: ['/api/master', 'services'],
    queryFn: () => api.get<ServiceDto[]>('/api/master/services'),
  });

export function useServiceMutations() {
  const invalidate = useInvalidate();
  const done = () => invalidate(['/api/master', 'services'], ['public']);
  return {
    create: useMutation({
      mutationFn: (input: ServiceCreateInput) =>
        api.post<ServiceDto>('/api/master/services', input),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<ServiceCreateInput> }) =>
        api.patch<ServiceDto>(`/api/master/services/${id}`, input),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/master/services/${id}`),
      onSuccess: done,
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) =>
        api.post<ServiceDto[]>('/api/master/services/reorder', { ids }),
      onSuccess: done,
    }),
  };
}

export const useSalonServices = () =>
  useQuery({
    queryKey: ['/api/salon', 'services'],
    queryFn: () =>
      api.get<(ServiceDto & { masterId: string; masterName: string })[]>('/api/salon/services'),
  });

/* ───────────── Schedule ───────────── */

export const useWeeklySchedule = () =>
  useQuery({
    queryKey: ['/api/master', 'weekly'],
    queryFn: () => api.get<ScheduleDayDto[]>('/api/master/schedule/weekly'),
  });

export function useSaveWeeklySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WeeklyScheduleInput) =>
      api.put<ScheduleDayDto[]>('/api/master/schedule/weekly', input),
    onSuccess: (days) => {
      qc.setQueryData(['/api/master', 'weekly'], days);
      void qc.invalidateQueries({ queryKey: ['/api/master', 'day'] });
      void qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export const useScheduleDay = (base: CabinetBase, date: string, masterId?: string) =>
  useQuery({
    queryKey: [base, 'day', date, masterId ?? null],
    queryFn: () => api.get<ScheduleDayResponse>(`${base}/schedule/day`, { date, masterId }),
    staleTime: 15 * 1000,
  });

export const useScheduleOverview = (base: CabinetBase, from: string, masterId?: string) =>
  useQuery({
    queryKey: [base, 'overview', from, masterId ?? null],
    queryFn: () =>
      api.get<{ date: string; count: number; pending: number }[]>(`${base}/schedule/overview`, {
        from,
        days: 42,
        masterId,
      }),
    staleTime: 30 * 1000,
  });

export const useMasterSlots = (serviceIds: string[], date: string | null) =>
  useQuery({
    queryKey: ['/api/master', 'slots', serviceIds, date],
    queryFn: () =>
      api.get<SlotsResponse>('/api/master/slots', { serviceIds, date: date ?? undefined }),
    enabled: serviceIds.length > 0 && !!date,
  });

export const useSettings = () =>
  useQuery({
    queryKey: ['/api/master', 'settings'],
    queryFn: () => api.get<MasterSettingsDto>('/api/master/settings'),
  });

export function usePatchSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsPatchInput) =>
      api.patch<MasterSettingsDto>('/api/master/settings', input),
    onSuccess: (s) => {
      qc.setQueryData(['/api/master', 'settings'], s);
      void qc.invalidateQueries({ queryKey: ['public'] });
    },
  });
}

export function useTimeBlockMutations() {
  const invalidate = useInvalidate();
  const done = () => invalidate(['/api/master', 'day'], ['/api/master', 'blocks'], ['public']);
  return {
    create: useMutation({
      mutationFn: (input: { startAt: string; endAt: string; reason?: string | null }) =>
        api.post<TimeBlockDto>('/api/master/time-blocks', input),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/master/time-blocks/${id}`),
      onSuccess: done,
    }),
  };
}

/* ───────────── Appointments ───────────── */

export function useAppointmentMutations(base: CabinetBase) {
  const invalidate = useInvalidate();
  const done = () =>
    invalidate(
      [base, 'day'],
      [base, 'overview'],
      [base, 'dashboard'],
      [base, 'clients'],
      [base, 'client'],
      ['public'],
    );
  return {
    create: useMutation({
      mutationFn: (input: MasterAppointmentCreateInput & { masterId?: string }) =>
        api.post<MasterAppointmentDto>(`${base}/appointments`, input),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: AppointmentPatchInput }) =>
        api.patch<MasterAppointmentDto>(`${base}/appointments/${id}`, input),
      onSuccess: done,
    }),
    photos: useMutation({
      mutationFn: ({
        id,
        beforePhotoUrl,
        afterPhotoUrl,
      }: {
        id: string;
        beforePhotoUrl?: string | null;
        afterPhotoUrl?: string | null;
      }) =>
        api.put<MasterAppointmentDto>(`/api/master/appointments/${id}/photos`, {
          beforePhotoUrl,
          afterPhotoUrl,
        }),
      onSuccess: done,
    }),
  };
}

/* ───────────── Clients ───────────── */

export const useClients = (base: CabinetBase, q: { q?: string; filter?: string; page?: number }) =>
  useQuery({
    queryKey: [base, 'clients', q],
    queryFn: () => api.get<Paginated<MasterClientDto>>(`${base}/clients`, { ...q, pageSize: 50 }),
    staleTime: 30 * 1000,
  });

export const useClientDetail = (base: CabinetBase, id: string | undefined) =>
  useQuery({
    queryKey: [base, 'client', id],
    queryFn: () => api.get<MasterClientDetailDto>(`${base}/clients/${id}`),
    enabled: !!id,
  });

export function useClientMutations(base: CabinetBase) {
  const invalidate = useInvalidate();
  return {
    create: useMutation({
      mutationFn: (input: ClientPatchInput & { firstName: string }) =>
        api.post<MasterClientDetailDto>(`${base}/clients`, input),
      onSuccess: () => invalidate([base, 'clients']),
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ClientPatchInput }) =>
        api.patch<MasterClientDetailDto>(`${base}/clients/${id}`, input),
      onSuccess: () => invalidate([base, 'clients'], [base, 'client']),
    }),
    remind: useMutation({
      mutationFn: ({ id, text }: { id: string; text?: string }) =>
        api.post(`${base}/clients/${id}/remind`, { text }),
    }),
  };
}

/* ───────────── Reviews ───────────── */

export const useReviews = (base: CabinetBase) =>
  useQuery({ queryKey: [base, 'reviews'], queryFn: () => api.get<ReviewDto[]>(`${base}/reviews`) });

export function useReviewMutations() {
  const invalidate = useInvalidate();
  const done = () => invalidate(['/api/master', 'reviews'], ['public']);
  return {
    toggle: useMutation({
      mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
        api.patch<ReviewDto>(`/api/master/reviews/${id}`, { isPublished }),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/master/reviews/${id}`),
      onSuccess: done,
    }),
  };
}

/* ───────────── Dashboard & analytics ───────────── */

export const useDashboard = (base: CabinetBase) =>
  useQuery({
    queryKey: [base, 'dashboard'],
    queryFn: () => api.get<DashboardDto>(`${base}/dashboard`),
    staleTime: 60 * 1000,
  });

export const useAnalytics = (base: CabinetBase, days: number) =>
  useQuery({
    queryKey: [base, 'analytics', days],
    queryFn: () => api.get<AnalyticsDto>(`${base}/analytics`, { days }),
  });

/* ───────────── Blacklist ───────────── */

export const useBlacklist = () =>
  useQuery({
    queryKey: ['/api/master', 'blacklist'],
    queryFn: () => api.get<BlacklistEntryDto[]>('/api/master/blacklist'),
  });

export function useBlacklistMutations() {
  const invalidate = useInvalidate();
  const done = () =>
    invalidate(['/api/master', 'blacklist'], ['/api/master', 'clients'], ['/api/master', 'client']);
  return {
    add: useMutation({
      mutationFn: (input: BlacklistCreateInput) =>
        api.post<BlacklistEntryDto>('/api/master/blacklist', input),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/master/blacklist/${id}`),
      onSuccess: done,
    }),
  };
}

export const useBlockedScreen = () =>
  useQuery({
    queryKey: ['/api/master', 'blocked-screen'],
    queryFn: () => api.get<BlockedScreenDto>('/api/master/blacklist/screen'),
  });

export function useSaveBlockedScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlockedScreenInput) =>
      api.put<BlockedScreenDto>('/api/master/blacklist/screen', input),
    onSuccess: (s) => qc.setQueryData(['/api/master', 'blocked-screen'], s),
  });
}

/* ───────────── Loyalty & promotions ───────────── */

export const useLoyaltyRules = () =>
  useQuery({
    queryKey: ['/api/master', 'loyalty'],
    queryFn: () => api.get<LoyaltyRuleDto[]>('/api/master/loyalty-rules'),
  });

export function useLoyaltyMutations() {
  const invalidate = useInvalidate();
  const done = () => invalidate(['/api/master', 'loyalty'], ['public']);
  return {
    create: useMutation({
      mutationFn: (input: LoyaltyRuleInput) =>
        api.post<LoyaltyRuleDto>('/api/master/loyalty-rules', input),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: { threshold?: number | null; discountPct?: number; isActive?: boolean };
      }) => api.patch<LoyaltyRuleDto>(`/api/master/loyalty-rules/${id}`, input),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/api/master/loyalty-rules/${id}`),
      onSuccess: done,
    }),
  };
}

export const usePromotions = (base: CabinetBase) =>
  useQuery({
    queryKey: [base, 'promotions'],
    queryFn: () => api.get<PromotionDto[]>(`${base}/promotions`),
  });

export function usePromotionMutations(base: CabinetBase) {
  const invalidate = useInvalidate();
  const done = () => invalidate([base, 'promotions'], ['public']);
  return {
    create: useMutation({
      mutationFn: (input: PromotionInput & { masterId?: string }) =>
        api.post<PromotionDto>(`${base}/promotions`, input),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<PromotionInput> }) =>
        api.patch<PromotionDto>(`${base}/promotions/${id}`, input),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`${base}/promotions/${id}`),
      onSuccess: done,
    }),
  };
}

/* ───────────── Broadcasts ───────────── */

export const useBroadcasts = (base: CabinetBase) =>
  useQuery({
    queryKey: [base, 'broadcasts'],
    queryFn: () => api.get<BroadcastDto[]>(`${base}/broadcasts`),
  });

export const useBroadcastPreview = (
  base: CabinetBase,
  input: (BroadcastPreviewInput & { masterId?: string }) | null,
) =>
  useQuery({
    queryKey: [base, 'broadcast-preview', input],
    queryFn: () => api.post<BroadcastPreviewResponse>(`${base}/broadcasts/preview`, input),
    enabled: !!input,
    staleTime: 0,
  });

export function useSendBroadcast(base: CabinetBase) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: BroadcastCreateInput & { masterId?: string }) =>
      api.post<BroadcastDto>(`${base}/broadcasts`, input),
    onSuccess: () => invalidate([base, 'broadcasts'], [base, 'broadcast-preview']),
  });
}

/* ───────────── Online, share, export ───────────── */

export function useOnlineToggle() {
  const invalidate = useInvalidate();
  const done = () =>
    invalidate(['/api/master', 'dashboard'], ['/api/master', 'profile'], ['public'], ['search']);
  return {
    open: useMutation({
      mutationFn: (hours?: number) =>
        api.post<{ onlineOpenUntil: string }>('/api/master/online/open', { hours }),
      onSuccess: done,
    }),
    close: useMutation({
      mutationFn: () => api.post('/api/master/online/close', {}),
      onSuccess: done,
    }),
  };
}

export const useShare = () =>
  useQuery({
    queryKey: ['/api/master', 'share'],
    queryFn: () => api.get<ShareDto>('/api/master/qr'),
  });

export const exportLink = (entity: 'clients' | 'appointments') =>
  api.post<{ url: string }>('/api/master/export/link', { entity });

/* ───────────── Subscription ───────────── */

export const useSubscription = (base: CabinetBase) =>
  useQuery({
    queryKey: [base, 'subscription'],
    queryFn: () => api.get<SubscriptionDto>(`${base}/subscription`),
    staleTime: 0,
  });

export const usePayments = (base: CabinetBase) =>
  useQuery({
    queryKey: [base, 'payments'],
    queryFn: () => api.get<PaymentDto[]>(`${base}/subscription/payments`),
  });

export function useSubscriptionMutations(base: CabinetBase) {
  const invalidate = useInvalidate();
  const done = () => invalidate([base, 'subscription'], [base, 'payments'], [base, 'profile']);
  return {
    pay: useMutation({
      mutationFn: (autoRenew: boolean) =>
        api.post<CreatePaymentResponse>(`${base}/subscription/create-payment`, { autoRenew }),
    }),
    cancel: useMutation({
      mutationFn: () => api.post<SubscriptionDto>(`${base}/subscription/cancel`, {}),
      onSuccess: done,
    }),
    autoRenew: useMutation({
      mutationFn: (enabled: boolean) =>
        api.post<SubscriptionDto>(`${base}/subscription/auto-renew`, { enabled }),
      onSuccess: done,
    }),
    promo: useMutation({
      mutationFn: (code: string) =>
        api.post<{
          type: 'FREE_DAYS' | 'DISCOUNT_PERCENT';
          value: number;
          accessEndsAt: string | null;
        }>(`${base}/subscription/apply-promo`, { code }),
      onSuccess: done,
    }),
  };
}

/* ───────────── Salon members ───────────── */

export const useSalonMasters = () =>
  useQuery({
    queryKey: ['/api/salon', 'masters'],
    queryFn: () => api.get<SalonMasterDto[]>('/api/salon/masters'),
  });

export const useSalonInvites = () =>
  useQuery({
    queryKey: ['/api/salon', 'invites'],
    queryFn: () => api.get<SalonInviteDto[]>('/api/salon/invites'),
  });

export function useSalonMemberMutations() {
  const invalidate = useInvalidate();
  const done = () =>
    invalidate(
      ['/api/salon', 'masters'],
      ['/api/salon', 'invites'],
      ['/api/salon', 'profile'],
      ['/api/salon', 'dashboard'],
    );
  return {
    inviteByUsername: useMutation({
      mutationFn: (username: string) =>
        api.post<InviteByUsernameResponse>('/api/salon/masters/invite-by-username', { username }),
      onSuccess: done,
    }),
    inviteLink: useMutation({
      mutationFn: (ttlDays?: number) =>
        api.post<SalonInviteDto>('/api/salon/masters/invite-link', { ttlDays }),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (masterId: string) => api.delete(`/api/salon/masters/${masterId}`),
      onSuccess: done,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => api.delete(`/api/salon/invites/${id}`),
      onSuccess: done,
    }),
  };
}
