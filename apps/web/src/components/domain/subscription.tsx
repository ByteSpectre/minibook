import { Check, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { AccessDto } from '@nail-crm/shared';
import { GlassButton, GlassCard, GlassSheet } from '@/components/ui/glass';
import { formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

export function SubscriptionBanner({
  access,
  to,
  className,
}: {
  access: AccessDto;
  to: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const days = t('common.days', { count: access.daysLeft });
  const content = (() => {
    if (access.status === 'BANNED')
      return { tone: 'danger', text: t('components.subscription.banned'), cta: null };
    if (access.source === 'salon-member' && access.status !== 'EXPIRED')
      return { tone: 'info', text: t('components.subscription.salonMember'), cta: null };
    if (access.status === 'EXPIRED')
      return {
        tone: 'danger',
        text: t('components.subscription.expired'),
        cta: t('components.subscription.pay'),
      };
    if (access.status === 'TRIAL')
      return {
        tone: access.daysLeft <= 3 ? 'warn' : 'trial',
        text: t('components.subscription.trial', { days }),
        cta: t('components.subscription.pay'),
      };
    if (access.status === 'CANCELLED')
      return {
        tone: 'warn',
        text: t('components.subscription.cancelled', {
          date: access.endsAt ? formatDate(access.endsAt) : '',
        }),
        cta: t('components.subscription.renew'),
      };
    if (access.daysLeft <= 3)
      return {
        tone: 'warn',
        text: t('components.subscription.active', {
          date: access.endsAt ? formatDate(access.endsAt) : '',
        }),
        cta: t('components.subscription.renew'),
      };
    return null;
  })();
  if (!content) return null;
  const tone = {
    trial: 'from-violet-500/15 to-pink-500/15',
    warn: 'from-amber-400/25 to-orange-400/20',
    danger: 'from-rose-500/20 to-red-500/15',
    info: 'from-sky-400/15 to-violet-400/15',
  }[content.tone];
  return (
    <GlassCard className={cn('flex items-center gap-3 bg-gradient-to-r p-3.5', tone, className)}>
      <Sparkles className="size-5 shrink-0 text-primary" />
      <span className="flex-1 text-[14px] font-medium">{content.text}</span>
      {content.cta ? (
        <GlassButton asChild size="sm" variant="primary">
          <Link to={to}>{content.cta}</Link>
        </GlassButton>
      ) : null}
    </GlassCard>
  );
}

export function PaywallSheet({
  open,
  onOpenChange,
  priceRub,
  title,
  text,
  onPay,
  paying,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceRub: number;
  title?: string | null;
  text?: string | null;
  onPay: () => void;
  paying?: boolean;
}) {
  const { t } = useTranslation();
  const features = ['booking', 'search', 'marketing', 'analytics'] as const;
  return (
    <GlassSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t('components.paywall.title')}
      description={text ?? t('components.paywall.text')}
      footer={
        <div className="flex flex-col gap-2">
          <GlassButton variant="primary" size="lg" block loading={paying} onClick={onPay}>
            {t('components.paywall.pay', { price: formatPrice(priceRub) })}
          </GlassButton>
          <GlassButton variant="ghost" block onClick={() => onOpenChange(false)}>
            {t('components.paywall.later')}
          </GlassButton>
        </div>
      }
    >
      <div className="mb-4 text-center">
        <div className="text-brand text-[34px] font-bold tracking-tight">
          {formatPrice(priceRub)}
        </div>
        <div className="text-[13px] text-muted-foreground">{t('common.days', { count: 30 })}</div>
      </div>
      <ul className="flex flex-col gap-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[15px]">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <Check className="size-3.5" />
            </span>
            {t(`components.paywall.features.${f}`)}
          </li>
        ))}
      </ul>
    </GlassSheet>
  );
}
