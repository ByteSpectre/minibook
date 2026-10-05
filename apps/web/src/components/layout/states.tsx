import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function EmptyState({
  emoji = '✨',
  title,
  text,
  action,
  className,
}: {
  emoji?: string;
  title?: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <GlassCard className={cn('flex flex-col items-center gap-2 px-6 py-8 text-center', className)}>
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <div className="text-[16px] font-semibold">{title ?? t('common.emptyTitle')}</div>
      {text ? <p className="max-w-xs text-[14px] text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </GlassCard>
  );
}

export function ErrorState({
  onRetry,
  text,
  className,
}: {
  onRetry?: () => void;
  text?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <GlassCard className={cn('flex flex-col items-center gap-2 px-6 py-8 text-center', className)}>
      <div className="text-4xl" aria-hidden>
        😕
      </div>
      <div className="text-[16px] font-semibold">{t('common.errorTitle')}</div>
      <p className="max-w-xs text-[14px] text-muted-foreground">{text ?? t('common.errorText')}</p>
      {onRetry ? (
        <GlassButton size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw /> {t('common.retry')}
        </GlassButton>
      ) : null}
    </GlassCard>
  );
}

export function CardSkeleton({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <GlassCard className={cn('flex items-center gap-3', className)}>
      <Skeleton className="size-14 shrink-0 rounded-2xl bg-muted" />
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            className={cn('h-3.5 rounded-full bg-muted', i === 0 ? 'w-2/3' : 'w-1/2')}
          />
        ))}
      </div>
    </GlassCard>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pt-[calc(var(--tg-safe-top)+24px)]">
      <Skeleton className="h-8 w-1/2 rounded-full bg-muted" />
      <ListSkeleton count={4} />
    </div>
  );
}

export function FullscreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="size-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  );
}
