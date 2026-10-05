import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { cn } from '@/lib/utils';

/** Branded loading screen used for Suspense / boot / tab switches. */
export function LoadScreen({
  inset = 'none',
  className,
  label,
}: {
  inset?: 'tabbar' | 'none';
  className?: string;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-5 px-[var(--page-px)]',
        inset === 'tabbar'
          ? 'min-h-[calc(100dvh-var(--tg-safe-bottom)-96px)] pt-[calc(var(--tg-safe-top)+24px)]'
          : 'min-h-dvh',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? t('common.loading')}
    >
      <BrandLogo size={80} className="animate-pulse opacity-90" />
      <div className="text-center">
        <div className="font-heading text-[22px] font-semibold tracking-tight">
          {t('common.appName')}
        </div>
        <p className="mt-1.5 text-[14px] text-muted-foreground">{label ?? t('common.loading')}</p>
      </div>
    </div>
  );
}
