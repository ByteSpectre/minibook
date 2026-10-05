import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@/components/ui/glass';
import { haptic } from '@/lib/telegram';
import { useMe } from '@/store/auth';

export default function RoleSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const roles = [
    {
      key: 'client',
      emoji: '💅',
      title: t('start.client'),
      hint: t('start.clientHint'),
      to: me?.clientOnboarded ? '/client' : '/onboarding/client',
    },
    {
      key: 'master',
      emoji: '✂️',
      title: t('start.master'),
      hint: t('start.masterHint'),
      to: me?.master ? '/master' : '/onboarding/master',
    },
    {
      key: 'salon',
      emoji: '🏛',
      title: t('start.salon'),
      hint: t('start.salonHint'),
      to: me?.salon ? '/salon' : '/onboarding/salon',
    },
  ];
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-10">
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="bg-brand flex size-20 items-center justify-center rounded-[28px] text-white shadow-2xl shadow-pink-500/30">
            <Sparkles className="size-10" />
          </div>
          <h1 className="text-[30px] font-bold tracking-tight">{t('start.title')}</h1>
          <p className="max-w-xs text-[15px] text-muted-foreground">{t('start.subtitle')}</p>
        </motion.div>
        <div className="flex flex-col gap-3">
          <p className="px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('start.question')}
          </p>
          {roles.map((r, i) => (
            <motion.div
              key={r.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * (i + 1) }}
            >
              <GlassCard
                interactive
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center gap-4 p-4"
                onClick={() => {
                  haptic.impact('medium');
                  navigate(r.to);
                }}
                onKeyDown={(e) => e.key === 'Enter' && navigate(r.to)}
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-3xl">
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{r.title}</span>
                  <span className="block text-[13px] text-muted-foreground">{r.hint}</span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </GlassCard>
            </motion.div>
          ))}
          <p className="pt-2 text-center text-[12px] text-muted-foreground">
            {t('start.trialNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
