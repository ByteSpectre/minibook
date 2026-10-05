import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';
import { haptic } from '@/lib/telegram';
import { ApiError } from './client';

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const key = `errors.${err.code}`;
    const translated = i18n.t(key as 'errors.internal');
    if (translated !== key) return translated;
    if (err.status === 404) return i18n.t('errors.notFound');
    return err.message || i18n.t('errors.internal');
  }
  return i18n.t('common.offline');
}

export function toastError(err: unknown): void {
  haptic.notify('error');
  toast.error(errorMessage(err));
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      toastError(err);
    },
  }),
});

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}
