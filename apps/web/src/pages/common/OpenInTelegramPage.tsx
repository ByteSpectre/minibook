import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Backdrop } from '@/components/layout/AppShell';
import { GlassButton, GlassCard } from '@/components/ui/glass';

export function OpenInTelegramPage() {
  const { t } = useTranslation();
  const bot = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'glow_beauty_bot';
  return (
    <div className="relative flex min-h-dvh items-center justify-center p-6">
      <Backdrop />
      <GlassCard strong className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
        <div className="text-5xl">✨</div>
        <h1 className="text-[22px] font-semibold">{t('start.openInTelegram')}</h1>
        <p className="text-[15px] text-muted-foreground">{t('start.openInTelegramText')}</p>
        <GlassButton asChild variant="primary" className="mt-2">
          <a href={`https://t.me/${bot}`}>
            <Send /> {t('start.openBot')}
          </a>
        </GlassButton>
      </GlassCard>
    </div>
  );
}
