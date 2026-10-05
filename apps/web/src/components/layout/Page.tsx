import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '@/hooks/telegram';
import { telegramEnv } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export interface PageProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** `true` → history back, a function → custom handler, `false`/undefined → no back button. */
  back?: boolean | (() => void);
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra bottom padding for the tab bar or a main button. */
  bottomInset?: 'tabbar' | 'button' | 'none';
  largeTitle?: boolean;
  header?: ReactNode;
}

export function Page({
  title,
  subtitle,
  back,
  actions,
  children,
  className,
  bottomInset = 'tabbar',
  largeTitle = true,
  header,
}: PageProps) {
  const navigate = useNavigate();
  const handler = typeof back === 'function' ? back : back ? () => navigate(-1) : false;
  useBackButton(handler);
  const showInlineBack = !!handler && !telegramEnv().inTelegram;

  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh w-full max-w-xl flex-col',
        bottomInset === 'tabbar' && 'pb-[calc(var(--tg-safe-bottom)+96px)]',
        bottomInset === 'button' && 'pb-[calc(var(--tg-safe-bottom)+96px)]',
        bottomInset === 'none' && 'pb-[calc(var(--tg-safe-bottom)+16px)]',
      )}
    >
      {header ?? (
        <header className="pt-safe sticky top-0 z-30">
          <div className="flex min-h-14 items-center gap-2 px-4 pt-3 pb-2">
            {showInlineBack ? (
              <button
                type="button"
                aria-label="Back"
                onClick={() => (handler as () => void)()}
                className="glass -ml-1 flex size-10 items-center justify-center rounded-full active:scale-95"
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {title ? (
                <h1
                  className={cn(
                    'truncate font-semibold tracking-tight',
                    largeTitle ? 'text-[26px] leading-tight' : 'text-[18px]',
                  )}
                >
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        </header>
      )}
      <main className={cn('flex flex-1 flex-col gap-4 px-4 pt-1', className)}>{children}</main>
    </div>
  );
}
