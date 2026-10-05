import type { TFunction } from 'i18next';
import { Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LoyaltyProgress, LoyaltyRuleDto, LoyaltyType } from '@nail-crm/shared';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/ui/glass';
import { cn } from '@/lib/utils';

export function loyaltyText(
  t: TFunction,
  rule: Pick<LoyaltyRuleDto, 'type' | 'threshold' | 'discountPct'>,
): string {
  const key: `enums.loyaltyDescription.${LoyaltyType}` = `enums.loyaltyDescription.${rule.type}`;
  return t(key, { n: rule.threshold ?? 7, pct: rule.discountPct });
}

export function LoyaltyProgressBar({
  progress,
  className,
  compact,
}: {
  progress: LoyaltyProgress;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const label =
    progress.type === 'EVERY_N_VISIT'
      ? progress.remaining === 0
        ? t('components.loyalty.next', { pct: progress.discountPct })
        : t('components.loyalty.remaining', { count: progress.remaining, total: progress.total })
      : progress.unlocked
        ? t('components.loyalty.unlocked', { pct: progress.discountPct })
        : t('components.loyalty.cumulative', {
            count: progress.remaining,
            pct: progress.discountPct,
          });
  const steps = progress.type === 'EVERY_N_VISIT' ? progress.total : Math.min(progress.total, 10);
  const filled =
    progress.type === 'EVERY_N_VISIT'
      ? progress.current
      : Math.round((progress.current / progress.total) * steps);
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Gift className="size-4 text-primary" />
        <span className={cn(compact && 'text-[12px]')}>{label}</span>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: steps }, (_, i) => {
          const isGift = progress.type === 'EVERY_N_VISIT' && i === steps - 1;
          return (
            <span
              key={i}
              className={cn(
                'flex h-2.5 flex-1 items-center justify-center rounded-full transition-colors',
                i < filled ? 'bg-brand' : isGift ? 'bg-primary/25' : 'bg-muted',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export function LoyaltyRuleCard({
  rule,
  onToggle,
  onEdit,
  className,
}: {
  rule: LoyaltyRuleDto;
  onToggle?: (active: boolean) => void;
  onEdit?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const emoji = {
    EVERY_N_VISIT: '🔁',
    REFERRAL: '👯‍♀️',
    CUMULATIVE: '📈',
    FIRST_VISIT: '🌱',
    BIRTHDAY: '🎂',
  }[rule.type];
  return (
    <GlassCard className={cn('flex items-center gap-3', !rule.isActive && 'opacity-60', className)}>
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-xl">
          <MonoEmoji>{emoji}</MonoEmoji>
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">
            {t(`enums.loyaltyType.${rule.type}`)}
          </span>
          <span className="block text-[13px] text-muted-foreground">{loyaltyText(t, rule)}</span>
        </span>
      </button>
      <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-[13px] font-bold text-white">
        −{rule.discountPct}%
      </span>
      {onToggle ? (
        <Switch
          checked={rule.isActive}
          onCheckedChange={onToggle}
          aria-label={t(`enums.loyaltyType.${rule.type}`)}
        />
      ) : null}
    </GlassCard>
  );
}
