import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassButton } from '@/components/ui/glass';
import { Toaster } from '@/components/ui/sonner';
import { telegramEnv } from '@/lib/telegram';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';

export function Backdrop() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-background" />;
}

function MainButtonFallback() {
  const config = useUi((s) => s.mainButton);
  return (
    <AnimatePresence>
      {config ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[calc(var(--tg-safe-bottom)+14px)]"
        >
          <div className="mx-auto max-w-xl">
            <GlassButton
              variant="primary"
              size="lg"
              block
              disabled={config.enabled === false}
              loading={config.loading}
              hapticStyle="medium"
              onClick={config.onClick}
            >
              {config.text}
            </GlassButton>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DevBanner() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  if (telegramEnv().inTelegram || !me) return null;
  return (
    <div className="fixed top-2 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-medium text-foreground shadow-lg backdrop-blur">
      {t('common.devBanner')}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <DevBanner />
      {children}
      <MainButtonFallback />
      <Toaster />
    </div>
  );
}
