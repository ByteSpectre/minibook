import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ChevronRight, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthResponse } from '@nail-crm/shared';
import { request } from '@/api/client';
import { errorMessage } from '@/api/queryClient';
import { Backdrop } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/glass';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/store/auth';

export function DevLoginPage() {
  const { t } = useTranslation();
  const setSession = useAuth((s) => s.setSession);
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    try {
      const res = await request<AuthResponse>('/api/auth/dev-login', {
        method: 'POST',
        body: {
          telegramId: 500_000 + Math.floor(Math.random() * 400_000),
          firstName: 'Гость',
          languageCode: navigator.language?.slice(0, 2) ?? 'ru',
        },
        noRetry: true,
      });
      setSession(res);
      window.history.replaceState(
        null,
        '',
        window.location.pathname === '/dev-login'
          ? '/'
          : window.location.pathname + window.location.search,
      );
    } catch (err) {
      toast.error(`${t('dev.loginFailed')}: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-10 pb-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLogo size={64} className="rounded-lg" />
          <h1 className="font-heading text-[26px] font-semibold tracking-tight">
            {t('dev.title')}
          </h1>
          <p className="max-w-sm text-[14px] text-muted-foreground">{t('dev.subtitle')}</p>
        </div>
        <GlassCard
          interactive
          aria-busy={busy}
          className="flex cursor-pointer items-center gap-3"
          onClick={() => void login()}
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-border bg-foreground text-background">
            <UserPlus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">{t('dev.newUser')}</span>
            <span className="block text-[13px] text-muted-foreground">{t('dev.newUserHint')}</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </GlassCard>
      </div>
      <Toaster />
    </div>
  );
}
