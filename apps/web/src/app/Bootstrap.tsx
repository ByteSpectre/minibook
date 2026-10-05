import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthResponse, MeDto } from '@nail-crm/shared';
import { request } from '@/api/client';
import { FullscreenSpinner } from '@/components/layout/states';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { initialLanguage, setLanguage } from '@/lib/i18n';
import { initTelegram, setHeaderColors } from '@/lib/telegram';
import { useAuth } from '@/store/auth';
import { DevLoginPage } from '@/pages/common/DevLoginPage';
import { OpenInTelegramPage } from '@/pages/common/OpenInTelegramPage';
import { setPendingStartParam } from './startParam';

const DEV_AUTH = (import.meta.env.VITE_DEV_AUTH as string | undefined) !== 'false';

function applyColorScheme(scheme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', scheme === 'dark');
  setHeaderColors(scheme === 'dark' ? '#0e0c13' : '#f7f4fb');
}

let booted = false;

async function boot(): Promise<void> {
  if (booted) return;
  booted = true;
  const env = initTelegram();
  applyColorScheme(env.colorScheme);
  setLanguage(initialLanguage(env.languageCode));
  setPendingStartParam(env.startParam);
  const store = useAuth.getState();

  if (env.inTelegram && env.initDataRaw) {
    try {
      const res = await request<AuthResponse>('/api/auth/init', {
        method: 'POST',
        body: { initData: env.initDataRaw },
        noRetry: true,
      });
      store.setSession(res);
    } catch {
      store.setStatus('error', 'unauthorized');
    }
    return;
  }
  if (!DEV_AUTH) {
    store.setStatus('outsideTelegram');
    return;
  }
  if (!store.token) {
    store.setStatus('needsLogin');
    return;
  }
  try {
    const me = await request<MeDto>('/api/auth/me', { noRetry: true });
    store.setMe(me);
    store.setStatus('ready');
  } catch {
    store.logout();
  }
}

export function Bootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const status = useAuth((s) => s.status);
  const language = useAuth((s) => s.me?.user.language);

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (language) setLanguage(language);
  }, [language]);

  useEffect(() => {
    if (initTelegram().inTelegram) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyColorScheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  if (status === 'booting') return <FullscreenSpinner />;
  if (status === 'needsLogin') return <DevLoginPage />;
  if (status === 'outsideTelegram') return <OpenInTelegramPage />;
  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <GlassCard className="flex max-w-sm flex-col items-center gap-3 p-6 text-center">
          <div className="text-4xl">🔐</div>
          <div className="text-[17px] font-semibold">{t('errors.unauthorized')}</div>
          <GlassButton
            variant="primary"
            onClick={() => window.location.assign(window.location.pathname)}
          >
            {t('common.retry')}
          </GlassButton>
        </GlassCard>
      </div>
    );
  }
  return <>{children}</>;
}
