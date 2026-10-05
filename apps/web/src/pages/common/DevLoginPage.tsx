import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Sparkles, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AuthResponse } from '@nail-crm/shared';
import { request } from '@/api/client';
import { errorMessage } from '@/api/queryClient';
import { Backdrop } from '@/components/layout/AppShell';
import { UserAvatar } from '@/components/domain/badges';
import { GlassCard } from '@/components/ui/glass';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/store/auth';

interface Persona {
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  isOwner: boolean;
  master: string | null;
  salon: string | null;
  client: boolean;
}

export function DevLoginPage() {
  const { t } = useTranslation();
  const setSession = useAuth((s) => s.setSession);
  const [busy, setBusy] = useState<string | null>(null);
  const { data: personas = [], isLoading } = useQuery({
    queryKey: ['dev-personas'],
    queryFn: () => request<Persona[]>('/api/auth/dev-personas', { noRetry: true }),
  });

  const login = async (body: {
    telegramId: number;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) => {
    setBusy(String(body.telegramId));
    try {
      const res = await request<AuthResponse>('/api/auth/dev-login', {
        method: 'POST',
        body: { ...body, languageCode: navigator.language?.slice(0, 2) ?? 'ru' },
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
      setBusy(null);
    }
  };

  const roleLine = (p: Persona) =>
    [
      p.isOwner && t('dev.owner'),
      p.master && `${t('dev.master')}: ${p.master}`,
      p.salon && `${t('dev.salon')}: ${p.salon}`,
      p.client && t('dev.client'),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-10 pb-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-brand flex size-16 items-center justify-center rounded-[22px] text-3xl text-white shadow-xl">
            <Sparkles className="size-8" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight">{t('dev.title')}</h1>
          <p className="max-w-sm text-[14px] text-muted-foreground">{t('dev.subtitle')}</p>
        </div>
        <GlassCard
          interactive
          className="flex cursor-pointer items-center gap-3"
          onClick={() =>
            void login({
              telegramId: 500_000 + Math.floor(Math.random() * 400_000),
              firstName: 'Гость',
              username: undefined,
            })
          }
        >
          <span className="bg-brand flex size-12 items-center justify-center rounded-full text-white">
            <UserPlus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">{t('dev.newUser')}</span>
            <span className="block text-[13px] text-muted-foreground">{t('dev.newUserHint')}</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </GlassCard>
        <div className="flex flex-col gap-2">
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => (
                <GlassCard key={i} className="h-[72px] animate-pulse" />
              ))
            : personas.map((p) => (
                <GlassCard
                  key={p.telegramId}
                  interactive
                  className="flex cursor-pointer items-center gap-3 p-3"
                  aria-busy={busy === p.telegramId}
                  onClick={() =>
                    void login({
                      telegramId: Number(p.telegramId),
                      firstName: p.firstName ?? undefined,
                      lastName: p.lastName ?? undefined,
                      username: p.username ?? undefined,
                    })
                  }
                >
                  <UserAvatar
                    src={p.photoUrl}
                    name={`${p.firstName ?? ''} ${p.lastName ?? ''}`}
                    size={48}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {p.firstName} {p.lastName}
                      {p.username ? (
                        <span className="font-normal text-muted-foreground"> @{p.username}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {roleLine(p) || '—'}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </GlassCard>
              ))}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
